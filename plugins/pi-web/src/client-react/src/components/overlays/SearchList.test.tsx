import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchList } from "./SearchList";

const ITEMS = ["Alpha task", "Beta task", "Gamma report", "Delta report"];

// Ports the SearchList (beautifului #15) interaction to RTL: default results,
// live filtering, the clear button, adopting a result into the query, and the
// >2-char empty state.
describe("SearchList", () => {
  it("shows the first results by default", () => {
    render(<SearchList items={ITEMS} />);
    expect(screen.getByRole("button", { name: "Alpha task" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delta report" })).toBeInTheDocument();
  });

  it("filters the list as the query changes", async () => {
    const user = userEvent.setup();
    render(<SearchList items={ITEMS} />);
    await user.type(screen.getByRole("textbox", { name: "Search flavors" }), "report");
    expect(screen.getByRole("button", { name: "Gamma report" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Alpha task" })).not.toBeInTheDocument();
  });

  it("clears the query with the clear button", async () => {
    const user = userEvent.setup();
    render(<SearchList items={ITEMS} />);
    const search = screen.getByRole("textbox", { name: "Search flavors" });
    await user.type(search, "beta");
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(search).toHaveValue("");
  });

  it("adopts a result into the query when clicked", async () => {
    const user = userEvent.setup();
    render(<SearchList items={ITEMS} />);
    await user.click(screen.getByRole("button", { name: "Alpha task" }));
    expect(screen.getByRole("textbox", { name: "Search flavors" })).toHaveValue("Alpha task");
  });

  it("shows the empty state once the query is longer than two characters", async () => {
    const user = userEvent.setup();
    render(<SearchList items={ITEMS} />);
    await user.type(screen.getByRole("textbox", { name: "Search flavors" }), "zzz");
    expect(screen.getByText("No results found")).toBeInTheDocument();
  });
});
