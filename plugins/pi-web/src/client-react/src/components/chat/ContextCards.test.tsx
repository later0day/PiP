import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ContextCards } from "./ContextCards";

// Ports ContextCards (beautifului #10) to RTL. The chunk cards and their bodies
// are always rendered (the useStage timeline only fades the source chips in), so
// this asserts the count header, both chunk titles/bodies, and the source chips
// with their file badges — no timers needed.
describe("ContextCards", () => {
  it("renders the chunk count header", () => {
    render(<ContextCards />);
    expect(screen.getByText("All chunks")).toBeInTheDocument();
    expect(screen.getByText("32")).toBeInTheDocument();
  });

  it("renders each retrieved chunk with its title, char count, and body", () => {
    render(<ContextCards />);
    expect(screen.getByText("Vendor onboarding rule")).toBeInTheDocument();
    expect(screen.getByText("290 characters")).toBeInTheDocument();
    expect(screen.getByText(/Cold-chain certification/)).toBeInTheDocument();
    expect(screen.getByText("Seasonal demand row")).toBeInTheDocument();
    expect(screen.getByText("1,250 characters")).toBeInTheDocument();
  });

  it("renders the source chips with their file-type badges", () => {
    render(<ContextCards />);
    expect(screen.getByText("Dairy Onboarding SOP.pdf")).toBeInTheDocument();
    expect(screen.getByText("PDF")).toBeInTheDocument();
    expect(screen.getByText("Sales Velocity Export.csv")).toBeInTheDocument();
    expect(screen.getByText("CSV")).toBeInTheDocument();
  });
});
