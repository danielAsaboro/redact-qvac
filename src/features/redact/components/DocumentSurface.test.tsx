import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DocumentSurface } from "./DocumentSurface";
import type { RasterPage, RedactionMark } from "../workflow-domain";

const page: RasterPage = {
  id: "page-1",
  documentId: "document-1",
  pageNumber: 1,
  width: 1200,
  height: 1600,
  pngBytes: new Uint8Array([137, 80, 78, 71]).buffer,
};

const mark: RedactionMark = {
  id: "mark-1",
  documentId: "document-1",
  pageId: "page-1",
  pageNumber: 1,
  x: 10,
  y: 20,
  width: 30,
  height: 20,
  label: "other",
  source: "manual",
  createdAt: "2026-08-14T10:00:00.000Z",
};

function setSurfaceBounds(element: HTMLElement) {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 200,
    bottom: 100,
    width: 200,
    height: 100,
    toJSON: () => ({}),
  });
}

describe("direct redaction manipulation", () => {
  beforeEach(() => {
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:local-page"),
      revokeObjectURL: vi.fn(),
    });
  });

  it("draws a new percentage-based region on empty document space", () => {
    const onCreate = vi.fn();
    render(
      <DocumentSurface
        page={page}
        marks={[]}
        mode="original"
        onCreate={onCreate}
      />,
    );
    const surface = screen.getByLabelText("Redaction canvas");
    setSurfaceBounds(surface);

    fireEvent.pointerDown(surface, { pointerId: 1, clientX: 20, clientY: 20 });
    fireEvent.pointerMove(surface, { pointerId: 1, clientX: 80, clientY: 60 });
    fireEvent.pointerUp(surface, { pointerId: 1, clientX: 80, clientY: 60 });

    expect(onCreate).toHaveBeenCalledWith({
      x: 10,
      y: 20,
      width: 30,
      height: 40,
    });
  });

  it("drags an existing region while retaining its size", () => {
    const onChange = vi.fn();
    render(
      <DocumentSurface
        page={page}
        marks={[mark]}
        mode="original"
        onChange={onChange}
      />,
    );
    const surface = screen.getByLabelText("Redaction canvas");
    setSurfaceBounds(surface);
    const region = screen.getByRole("button", { name: "Move redaction 1" });

    fireEvent.pointerDown(region, { pointerId: 2, clientX: 30, clientY: 25 });
    fireEvent.pointerMove(surface, { pointerId: 2, clientX: 70, clientY: 45 });
    fireEvent.pointerUp(surface, { pointerId: 2, clientX: 70, clientY: 45 });

    expect(onChange).toHaveBeenLastCalledWith("mark-1", {
      x: 30,
      y: 40,
      width: 30,
      height: 20,
    });
  });

  it("resizes a region from its southeast corner", () => {
    const onChange = vi.fn();
    render(
      <DocumentSurface
        page={page}
        marks={[mark]}
        mode="original"
        onChange={onChange}
      />,
    );
    const surface = screen.getByLabelText("Redaction canvas");
    setSurfaceBounds(surface);
    const handle = screen.getByRole("button", {
      name: "Resize redaction 1 southeast",
    });

    fireEvent.pointerDown(handle, { pointerId: 3, clientX: 80, clientY: 40 });
    fireEvent.pointerMove(surface, { pointerId: 3, clientX: 100, clientY: 50 });
    fireEvent.pointerUp(surface, { pointerId: 3, clientX: 100, clientY: 50 });

    expect(onChange).toHaveBeenLastCalledWith("mark-1", {
      x: 10,
      y: 20,
      width: 40,
      height: 30,
    });
  });
});

it("previews the same outward-rounded pixels used by the flattened mask", () => {
  const { container } = render(<DocumentSurface page={page} marks={[{...mark,x:10.04,y:20.04,width:0.01,height:0.01}]} mode="safe" />);
  const mask = container.querySelector('[data-mode="safe"]') as HTMLElement;
  expect(parseFloat(mask.style.left)).toBeCloseTo(10,6);
  expect(parseFloat(mask.style.top)).toBeCloseTo(20,6);
  expect(parseFloat(mask.style.width)).toBeCloseTo(100/1200,6);
  expect(parseFloat(mask.style.height)).toBeCloseTo(100/1600,6);
});
