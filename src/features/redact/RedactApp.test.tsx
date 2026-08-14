import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RedactApp, type RedactAppAdapters } from "./RedactApp";
import type { AnalysisClient } from "./analysis-client";
import type { RasterPage } from "./workflow-domain";

const page: RasterPage = {
  id: "page-1",
  documentId: "document-1",
  pageNumber: 1,
  width: 1200,
  height: 1600,
  pngBytes: new Uint8Array([137, 80, 78, 71]).buffer,
};

function adapters(
  overrides: Partial<RedactAppAdapters> = {},
): RedactAppAdapters {
  const analysis: AnalysisClient = {
    health: vi.fn().mockResolvedValue({
      service: "ready",
      busy: false,
      models: [{ kind: "ocr", id: "qvac-ocr-latin", state: "not_loaded" }],
    }),
    analyzePage: vi.fn().mockResolvedValue({
      run: {
        id: "run-1",
        documentId: "document-sha256-source",
        status: "ready",
        startedAt: "2026-08-14T10:00:00.000Z",
        completedAt: "2026-08-14T10:00:01.000Z",
        ocrModel: "qvac-ocr-latin",
        ocrMs: 1000,
        reasoningModel: "qwen3-600m-instruct-q4",
        reasoningMs: 200,
        error: null,
      },
      page: { id: "page-1", number: 1, width: 1200, height: 1600 },
      ocrBlocks: [
        { text: "Maya Chen", bbox: [211, 114, 397, 158], confidence: 0.93 },
        { text: "maya.chen@example com", bbox: [213, 166, 478, 194], confidence: 0.46 },
      ],
      candidates: [
        { blockIndex: 0, label: "name", explanation: "A direct personal identifier", confidence: 0.96 },
        { blockIndex: 1, label: "email", explanation: "A personal contact address", confidence: 0.91 },
      ],
    }),
  };
  return {
    inspect: vi.fn().mockResolvedValue({
      kind: "image",
      mimeType: "image/png",
      pageCount: 1,
      encrypted: false,
    }),
    rasterize: vi.fn().mockResolvedValue([page]),
    exportCopy: vi.fn().mockResolvedValue({
      name: "chat-private.redacted.png",
      mimeType: "image/png",
      blob: new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }),
      pageCount: 1,
    }),
    clipboard: {
      writePng: vi.fn().mockResolvedValue(undefined),
    },
    downloader: { save: vi.fn() },
    digest: vi.fn().mockResolvedValue("sha256-source"),
    now: () => "2026-08-14T10:00:00.000Z",
    analysis,
    ...overrides,
  };
}

describe("Redact application", () => {
  beforeEach(() => {
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:local-page"),
      revokeObjectURL: vi.fn(),
    });
  });

  it("starts with a focused upload screen and no prototype language", () => {
    render(<RedactApp adapters={adapters()} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "What do you need to share safely?",
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Choose a document")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(
      /demo|fixture|dossier|simulated export|reset demo/i,
    );
  });

  it("accepts an image and configures privacy before preparation", async () => {
    const user = userEvent.setup();
    const appAdapters = adapters();
    render(<RedactApp adapters={appAdapters} />);

    await user.upload(
      screen.getByLabelText("Choose a document"),
      new File([new Uint8Array([1, 2, 3])], "chat-private.png", {
        type: "image/png",
      }),
    );

    expect(await screen.findByText("Privacy level")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Private/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Confidential/i })).toBeEnabled();
    expect(screen.getByLabelText("Additional direction")).toHaveAttribute(
      "maxlength",
      "500",
    );
    expect(screen.getByText(/original stays untouched/i)).toBeInTheDocument();
  });

  it("rejects unsupported uploads without leaving the upload stage", async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<RedactApp adapters={adapters()} />);

    await user.upload(
      screen.getByLabelText("Choose a document"),
      new File([new Uint8Array([1])], "records.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );

    expect(
      await screen.findByText("Choose a PNG, JPEG, or PDF file"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "What do you need to share safely?" }),
    ).toBeInTheDocument();
  });

  it("prepares, reviews, edits, and creates a real safe copy", async () => {
    const user = userEvent.setup();
    const appAdapters = adapters();
    render(<RedactApp adapters={appAdapters} />);

    await user.upload(
      screen.getByLabelText("Choose a document"),
      new File([new Uint8Array([1, 2, 3])], "chat-private.png", {
        type: "image/png",
      }),
    );
    await screen.findByText("Privacy level");
    await user.click(screen.getByRole("radio", { name: /Confidential/i }));
    await user.type(
      screen.getByLabelText("Additional direction"),
      "Hide Apollo references",
    );
    await user.click(screen.getByRole("button", { name: "Prepare for review" }));

    expect(await screen.findByText("Original")).toBeInTheDocument();
    expect(screen.getByText("Safe-share preview")).toBeInTheDocument();
    expect(appAdapters.rasterize).toHaveBeenCalledOnce();
    expect(appAdapters.analysis.analyzePage).toHaveBeenCalledWith(
      expect.objectContaining({
        pageId: "page-1",
        level: "confidential",
        direction: "Hide Apollo references",
      }),
      undefined,
    );
    expect(screen.getByText("2 text regions found locally")).toBeInTheDocument();
    expect(screen.getByText("2 suggested redactions")).toBeInTheDocument();
    expect(screen.getByLabelText("Suggested name: Maya Chen")).toBeInTheDocument();
    expect(screen.getByLabelText("OCR evidence Maya Chen")).toHaveStyle({
      left: "17.583333%",
      top: "7.125%",
      width: "15.5%",
      height: "2.75%",
    });

    expect(screen.getByRole("button", { name: "Done" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Accept name proposal" }));
    await user.click(screen.getByRole("button", { name: "Reject email proposal" }));
    expect(screen.getByRole("button", { name: "Done" })).toBeEnabled();
    expect(screen.getByText("Accepted local suggestion")).toBeInTheDocument();
    expect(screen.getByText("Rejected local suggestion")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add redaction" }));
    expect(screen.getAllByText("2 redactions")).toHaveLength(2);
    const widths = screen.getAllByLabelText("Redaction width");
    const width = widths[widths.length - 1];
    await user.clear(width);
    await user.type(width, "35");
    expect(width).toHaveValue(35);

    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(
      await screen.findByRole("heading", { name: "Your safe copy is ready" }),
    ).toBeInTheDocument();
    expect(appAdapters.exportCopy).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Copy to clipboard" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save copy" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Save copy" }));
    expect(appAdapters.downloader.save).toHaveBeenCalledOnce();
  });

  it("keeps moved geometry when a mark is dragged on the document", async () => {
    const user = userEvent.setup();
    render(<RedactApp adapters={adapters()} />);
    await user.upload(
      screen.getByLabelText("Choose a document"),
      new File([new Uint8Array([1, 2, 3])], "chat-private.png", {
        type: "image/png",
      }),
    );
    await screen.findByText("Privacy level");
    await user.click(screen.getByRole("button", { name: "Prepare for review" }));
    await screen.findByText("Safe-share preview");
    await user.click(screen.getByRole("button", { name: "Add redaction" }));

    const surface = screen.getByLabelText("Redaction canvas");
    vi.spyOn(surface, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, right: 200, bottom: 100,
      width: 200, height: 100, toJSON: () => ({}),
    });
    const region = screen.getByRole("button", { name: "Move redaction 1" });
    fireEvent.pointerDown(region, { pointerId: 1, clientX: 40, clientY: 25 });
    fireEvent.pointerMove(surface, { pointerId: 1, clientX: 60, clientY: 35 });
    fireEvent.pointerUp(surface, { pointerId: 1, clientX: 60, clientY: 35 });

    expect(screen.getByLabelText("Redaction horizontal position")).toHaveValue(26);
    expect(screen.getByLabelText("Redaction vertical position")).toHaveValue(33);
  });

  it("opens manual review when local inference is unavailable", async () => {
    const user = userEvent.setup();
    const appAdapters = adapters({
      analysis: {
        health: vi.fn().mockResolvedValue({ service: "ready", busy: false, models: [] }),
        analyzePage: vi.fn().mockRejectedValue(new Error("Local analysis is unavailable")),
      },
    });
    render(<RedactApp adapters={appAdapters} />);

    await user.upload(
      screen.getByLabelText("Choose a document"),
      new File([new Uint8Array([1])], "chat-private.png", { type: "image/png" }),
    );
    await screen.findByText("Privacy level");
    await user.click(screen.getByRole("button", { name: "Prepare for review" }));

    expect(await screen.findByText("Safe-share preview")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Local analysis is unavailable. Manual review remains available.",
    );
    await user.click(screen.getByRole("button", { name: "Add redaction" }));
    expect(screen.getAllByText("1 redaction")).toHaveLength(2);
  });

  it("keeps the generated copy available when clipboard access fails", async () => {
    const user = userEvent.setup();
    const appAdapters = adapters({
      clipboard: {
        writePng: vi.fn().mockRejectedValue(new Error("NotAllowedError")),
      },
    });
    render(<RedactApp adapters={appAdapters} />);

    await user.upload(
      screen.getByLabelText("Choose a document"),
      new File([new Uint8Array([1])], "chat-private.png", {
        type: "image/png",
      }),
    );
    await screen.findByText("Privacy level");
    await user.click(screen.getByRole("button", { name: "Prepare for review" }));
    await screen.findByText("Safe-share preview");
    await user.click(screen.getByRole("button", { name: "Accept name proposal" }));
    await user.click(screen.getByRole("button", { name: "Reject email proposal" }));
    await user.click(screen.getByRole("button", { name: "Done" }));
    await screen.findByRole("heading", { name: "Your safe copy is ready" });
    await user.click(screen.getByRole("button", { name: "Copy to clipboard" }));

    expect(
      await screen.findByText("Clipboard unavailable — save the copy instead"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save copy" })).toBeEnabled();
  });

  it("reports preparation failures without losing the chosen document", async () => {
    const user = userEvent.setup();
    const appAdapters = adapters({
      rasterize: vi.fn().mockRejectedValue(new Error("This PDF could not be read")),
    });
    render(<RedactApp adapters={appAdapters} />);

    await user.upload(
      screen.getByLabelText("Choose a document"),
      new File([new Uint8Array([1])], "statement.pdf", {
        type: "application/pdf",
      }),
    );
    await screen.findByText("Privacy level");
    await user.click(screen.getByRole("button", { name: "Prepare for review" }));

    expect(await screen.findByText("This PDF could not be read")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText(/statement\.pdf/)).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
  });
});
