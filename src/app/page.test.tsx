import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Redact home", () => {
  it("opens the real document upload workflow", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "What do you need to share safely?",
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Choose a document")).toBeInTheDocument();
  });
});
