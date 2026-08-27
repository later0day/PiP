import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FineTuneCard } from "./FineTuneCard";

// Ports FineTuneCard (beautifului #19) to RTL: the segmented layout control, the
// four scrub fields (as sliders + numeric inputs), the type dropdown, and the
// Adjust→Edited header flip once any value changes.
describe("FineTuneCard", () => {
  it("renders the layout segments and scrub fields in the pristine state", () => {
    render(<FineTuneCard />);
    expect(screen.getByText("Flavor card")).toBeInTheDocument();
    expect(screen.getByText("Adjust")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "row layout" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("slider", { name: "W" })).toHaveAttribute("aria-valuenow", "324");
  });

  it("flips the header to Edited when a segment changes", async () => {
    const user = userEvent.setup();
    render(<FineTuneCard />);
    await user.click(screen.getByRole("button", { name: "grid layout" }));
    expect(screen.getByText("Edited")).toBeInTheDocument();
    expect(screen.queryByText("Adjust")).not.toBeInTheDocument();
  });

  it("flips to Edited when a scrub field value is typed", async () => {
    const user = userEvent.setup();
    render(<FineTuneCard />);
    const widthInput = screen.getByRole("textbox", { name: "W value" });
    await user.clear(widthInput);
    await user.type(widthInput, "400");
    expect(screen.getByText("Edited")).toBeInTheDocument();
  });

  it("opens the type dropdown and selects a value", async () => {
    const user = userEvent.setup();
    render(<FineTuneCard initialSegment={0} />);
    const picker = screen.getByRole("button", { name: /Select type/ });
    await user.click(picker);
    await user.click(screen.getByRole("button", { name: "Seasonal" }));
    expect(screen.getByText("Seasonal")).toBeInTheDocument();
  });

  it("moves a slider with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<FineTuneCard />);
    const slider = screen.getByRole("slider", { name: "Radius" });
    slider.focus();
    await user.keyboard("{ArrowUp}");
    expect(slider).toHaveAttribute("aria-valuenow", "29");
  });
});
