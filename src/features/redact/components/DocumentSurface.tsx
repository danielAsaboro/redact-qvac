import { useEffect, useState } from "react";
import type { RasterPage, RedactionMark } from "../workflow-domain";

export function DocumentSurface({ page, marks, mode }: { page: RasterPage; marks: RedactionMark[]; mode: "original" | "safe" }) {
  const [source] = useState(() => URL.createObjectURL(new Blob([page.pngBytes], { type: "image/png" })));
  useEffect(() => () => URL.revokeObjectURL(source), [source]);
  return (
    <div className="document-surface" style={{ aspectRatio: `${page.width} / ${page.height}` }}>
      {/* Blob URLs are private in-memory document surfaces and cannot use Next image optimization. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={source} alt={`Document page ${page.pageNumber}`} />
      {marks.map((mark) => <div key={mark.id} className="surface-mark" data-mode={mode} style={{ left: `${mark.x}%`, top: `${mark.y}%`, width: `${mark.width}%`, height: `${mark.height}%` }}><span>{mode === "original" ? mark.label : ""}</span></div>)}
    </div>
  );
}
