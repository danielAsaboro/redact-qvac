import { useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { OCRBlock, RasterPage, RedactionMark } from "../workflow-domain";

export type RedactionGeometry = Pick<
  RedactionMark,
  "x" | "y" | "width" | "height"
>;

type Corner = "northwest" | "northeast" | "southwest" | "southeast";

type Interaction =
  | { kind: "draw"; pointerId: number; start: Point; current: Point }
  | { kind: "move"; pointerId: number; start: Point; mark: RedactionMark }
  | { kind: "resize"; pointerId: number; corner: Corner; mark: RedactionMark };

type Point = { x: number; y: number };

export function DocumentSurface({
  page,
  marks,
  evidence = [],
  mode,
  onCreate,
  onChange,
}: {
  page: RasterPage;
  marks: RedactionMark[];
  evidence?: OCRBlock[];
  mode: "original" | "safe";
  onCreate?(geometry: RedactionGeometry): void;
  onChange?(id: string, geometry: RedactionGeometry): void;
}) {
  const [source] = useState(() =>
    URL.createObjectURL(new Blob([page.pngBytes], { type: "image/png" })),
  );
  const [interaction, setInteraction] = useState<Interaction | null>(null);
  useEffect(() => () => URL.revokeObjectURL(source), [source]);
  const interactive = mode === "original" && Boolean(onCreate || onChange);

  function pointFromEvent(event: ReactPointerEvent<HTMLElement>): Point {
    const bounds = event.currentTarget.closest(".document-surface")!.getBoundingClientRect();
    return {
      x: round(clamp(((event.clientX - bounds.left) / bounds.width) * 100, 0, 100)),
      y: round(clamp(((event.clientY - bounds.top) / bounds.height) * 100, 0, 100)),
    };
  }

  function beginDraw(event: ReactPointerEvent<HTMLDivElement>) {
    if (!interactive || !onCreate || event.button !== 0) return;
    const start = pointFromEvent(event);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setInteraction({ kind: "draw", pointerId: event.pointerId, start, current: start });
  }

  function beginMove(event: ReactPointerEvent<HTMLDivElement>, mark: RedactionMark) {
    if (!onChange || event.button !== 0) return;
    event.stopPropagation();
    const surface = event.currentTarget.closest(".document-surface") as HTMLDivElement;
    surface.setPointerCapture?.(event.pointerId);
    setInteraction({ kind: "move", pointerId: event.pointerId, start: pointFromEvent(event), mark });
  }

  function beginResize(
    event: ReactPointerEvent<HTMLButtonElement>,
    mark: RedactionMark,
    corner: Corner,
  ) {
    if (!onChange || event.button !== 0) return;
    event.stopPropagation();
    const surface = event.currentTarget.closest(".document-surface") as HTMLDivElement;
    surface.setPointerCapture?.(event.pointerId);
    setInteraction({ kind: "resize", pointerId: event.pointerId, corner, mark });
  }

  function continueInteraction(event: ReactPointerEvent<HTMLDivElement>) {
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    const point = pointFromEvent(event);
    if (interaction.kind === "draw") {
      setInteraction({ ...interaction, current: point });
      return;
    }
    if (interaction.kind === "move") {
      const dx = point.x - interaction.start.x;
      const dy = point.y - interaction.start.y;
      onChange?.(interaction.mark.id, {
        x: round(clamp(interaction.mark.x + dx, 0, 100 - interaction.mark.width)),
        y: round(clamp(interaction.mark.y + dy, 0, 100 - interaction.mark.height)),
        width: interaction.mark.width,
        height: interaction.mark.height,
      });
      return;
    }
    onChange?.(
      interaction.mark.id,
      resizedGeometry(interaction.mark, interaction.corner, point),
    );
  }

  function finishInteraction(event: ReactPointerEvent<HTMLDivElement>) {
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    if (interaction.kind === "draw") {
      const geometry = geometryBetween(interaction.start, pointFromEvent(event));
      if (geometry.width >= 0.5 && geometry.height >= 0.5) onCreate?.(geometry);
    }
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setInteraction(null);
  }

  const draft = interaction?.kind === "draw"
    ? geometryBetween(interaction.start, interaction.current)
    : null;

  return (
    <div
      aria-label={interactive ? "Redaction canvas" : undefined}
      className="document-surface"
      data-interactive={interactive}
      onPointerDown={beginDraw}
      onPointerMove={continueInteraction}
      onPointerUp={finishInteraction}
      onPointerCancel={() => setInteraction(null)}
      style={{ aspectRatio: `${page.width} / ${page.height}` }}
    >
      {/* Blob URLs are private in-memory document surfaces and cannot use Next image optimization. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={source} alt={`Document page ${page.pageNumber}`} draggable={false} />
      {mode === "original" && evidence.map((block) => <span aria-label={`OCR evidence ${block.text}`} className="ocr-surface-evidence" key={block.id} style={{ left: `${block.bbox.x}%`, top: `${block.bbox.y}%`, width: `${block.bbox.width}%`, height: `${block.bbox.height}%` }} />)}
      {marks.map((mark, index) => (
        <div
          aria-label={mode === "original" ? `Move redaction ${index + 1}` : undefined}
          className="surface-mark"
          data-mode={mode}
          key={mark.id}
          onKeyDown={(event) => {
            if (!onChange || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
            event.preventDefault();
            const step = event.shiftKey ? 2 : 0.5;
            onChange(mark.id, {
              x: clamp(mark.x + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0), 0, 100 - mark.width),
              y: clamp(mark.y + (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0), 0, 100 - mark.height),
              width: mark.width,
              height: mark.height,
            });
          }}
          onPointerDown={(event) => beginMove(event, mark)}
          role={mode === "original" ? "button" : undefined}
          style={{ left: `${mark.x}%`, top: `${mark.y}%`, width: `${mark.width}%`, height: `${mark.height}%` }}
          tabIndex={mode === "original" ? 0 : undefined}
        >
          <span>{mode === "original" ? mark.label : ""}</span>
          {mode === "original" && onChange && (["northwest", "northeast", "southwest", "southeast"] as Corner[]).map((corner) => (
            <button
              aria-label={`Resize redaction ${index + 1} ${corner}`}
              className="resize-handle"
              data-corner={corner}
              key={corner}
              onPointerDown={(event) => beginResize(event, mark, corner)}
              type="button"
            />
          ))}
        </div>
      ))}
      {draft && <div className="surface-mark drawing-mark" style={{ left: `${draft.x}%`, top: `${draft.y}%`, width: `${draft.width}%`, height: `${draft.height}%` }} />}
    </div>
  );
}

function geometryBetween(start: Point, end: Point): RedactionGeometry {
  return {
    x: round(Math.min(start.x, end.x)),
    y: round(Math.min(start.y, end.y)),
    width: round(Math.abs(end.x - start.x)),
    height: round(Math.abs(end.y - start.y)),
  };
}

function resizedGeometry(mark: RedactionMark, corner: Corner, point: Point): RedactionGeometry {
  const right = mark.x + mark.width;
  const bottom = mark.y + mark.height;
  const movesWest = corner.endsWith("west");
  const movesNorth = corner.startsWith("north");
  const x = movesWest ? clamp(point.x, 0, right - 0.5) : mark.x;
  const y = movesNorth ? clamp(point.y, 0, bottom - 0.5) : mark.y;
  const nextRight = movesWest ? right : clamp(point.x, mark.x + 0.5, 100);
  const nextBottom = movesNorth ? bottom : clamp(point.y, mark.y + 0.5, 100);
  return { x: round(x), y: round(y), width: round(nextRight - x), height: round(nextBottom - y) };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function round(value: number) {
  return Math.round(value * 10_000) / 10_000;
}
