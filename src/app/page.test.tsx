import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Redact home", () => {
  it("introduces Redact by name", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Redact" }),
    ).toBeInTheDocument();
  });
});

