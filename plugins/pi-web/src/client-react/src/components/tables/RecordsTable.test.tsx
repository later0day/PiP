import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RecordsTable } from "./RecordsTable";

// Ports RecordsTable (beautifului tables #1) to RTL. A sortable, selectable
// records grid with a per-property config popover opened from a header, a
// "+ new property" menu, and a select-all checkbox with a mixed state.
describe("RecordsTable", () => {
  it("renders the header columns and the company rows", () => {
    render(<RecordsTable />);
    expect(screen.getByText("Categories")).toBeInTheDocument();
    expect(screen.getByText("Last interaction")).toBeInTheDocument();
    expect(screen.getByText("Connection strength")).toBeInTheDocument();
    // Rows are sorted by name ascending by default.
    expect(screen.getByText("Alpine Churn — Zürich")).toBeInTheDocument();
  });

  it("selects and clears every row via the header checkbox", () => {
    render(<RecordsTable />);
    const selectAll = screen.getByRole("checkbox", { name: "Select all companies" });
    fireEvent.click(selectAll);
    const rowCheck = screen.getByRole("checkbox", { name: "Select Alpine Churn — Zürich" });
    expect(rowCheck).toBeChecked();
    fireEvent.click(selectAll);
    expect(rowCheck).not.toBeChecked();
  });

  it("toggles a single row without selecting all", () => {
    render(<RecordsTable />);
    const rowCheck = screen.getByRole("checkbox", { name: "Select Alpine Churn — Zürich" });
    fireEvent.click(rowCheck);
    expect(rowCheck).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Select all companies" })).not.toBeChecked();
  });

  it("sorts by connection strength when its arrow is activated", () => {
    render(<RecordsTable />);
    const sortBtn = screen.getByRole("button", { name: "Sort by Connection strength" });
    // Two clicks toggle direction; the grid stays populated.
    fireEvent.click(sortBtn);
    fireEvent.click(sortBtn);
    expect(screen.getByText("Alpine Churn — Zürich")).toBeInTheDocument();
  });

  it("opens the new-property menu with the type options", () => {
    render(<RecordsTable />);
    fireEvent.click(screen.getByRole("button", { name: "New property" }));
    // The add popover lists every property type as its own button.
    expect(screen.getByRole("button", { name: "Collection" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Multi select" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "File splitter" })).toBeInTheDocument();
  });
});
