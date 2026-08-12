import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { RedactApp } from "./RedactApp";

describe("Redact application", () => {
  beforeEach(() => localStorage.clear());

  it("presents an intake tray and honest redaction workspace", async () => {
    render(<RedactApp />);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Redact" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Intake tray" }),
    ).toBeInTheDocument();
    expect(screen.getByText("3 marks placed")).toBeInTheDocument();
    expect(screen.getByText(/visual review workspace/i)).toBeInTheDocument();
  });

  it("adds, removes, and persists manual marks", async () => {
    const user = userEvent.setup();
    const view = render(<RedactApp />);
    await screen.findByRole("heading", { name: "Redact" });

    await user.click(screen.getByRole("button", { name: "Add manual mark" }));
    expect(screen.getByText("4 marks placed")).toBeInTheDocument();

    view.unmount();
    render(<RedactApp />);
    expect(await screen.findByText("4 marks placed")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Remove other mark/ }));
    expect(screen.getByText("3 marks placed")).toBeInTheDocument();
  });

  it("labels preview and export limitations clearly", async () => {
    const user = userEvent.setup();
    render(<RedactApp />);
    await screen.findByRole("heading", { name: "Redact" });

    await user.click(
      screen.getByRole("button", { name: "Safe-share preview" }),
    );
    expect(
      screen.getByText(/does not securely rewrite the source file/i),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Record simulated export" }),
    );
    expect(screen.getByText("Simulation recorded")).toBeInTheDocument();
  });

  it("resets the dossier to deterministic demo data", async () => {
    const user = userEvent.setup();
    render(<RedactApp />);
    await screen.findByRole("heading", { name: "Redact" });
    await user.click(screen.getByRole("button", { name: "Add manual mark" }));

    await user.click(screen.getByRole("button", { name: "Reset demo data" }));

    await waitFor(() =>
      expect(screen.getByText("3 marks placed")).toBeInTheDocument(),
    );
  });
});
