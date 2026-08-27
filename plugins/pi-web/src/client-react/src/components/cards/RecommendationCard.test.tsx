import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecommendationCard } from "./RecommendationCard";

// Ports RecommendationCard (beautifului #9) to RTL: the active recommendation
// body + confidence meter/label, the Alternatives drawer that reveals the other
// options, promoting an option to the recommendation, and the accept action.
describe("RecommendationCard", () => {
  it("renders the first recommendation and its confidence label", () => {
    render(<RecommendationCard />);
    expect(screen.getByText("Want me to place this restock order?")).toBeInTheDocument();
    expect(screen.getByText("High confidence")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument();
  });

  it("honors an override starting index", () => {
    render(<RecommendationCard initial={1} />);
    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Configure" })).toBeInTheDocument();
  });

  it("toggles the alternatives drawer", async () => {
    const user = userEvent.setup();
    render(<RecommendationCard />);
    const alt = screen.getByRole("button", { name: "Alternatives" });
    expect(alt).toHaveAttribute("aria-expanded", "false");
    await user.click(alt);
    expect(alt).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Other options")).toBeInTheDocument();
  });

  it("promotes a chosen alternative to the recommendation", async () => {
    const user = userEvent.setup();
    render(<RecommendationCard />);
    await user.click(screen.getByRole("button", { name: "Alternatives" }));
    await user.click(screen.getByText("Full restock across every SKU"));
    expect(screen.getByText("No signal")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept full restock" })).toBeInTheDocument();
  });

  it("confirms with the accept action", async () => {
    const user = userEvent.setup();
    render(<RecommendationCard />);
    await user.click(screen.getByRole("button", { name: "Accept" }));
    expect(screen.getByRole("button", { name: "Accepted" })).toBeInTheDocument();
  });
});
