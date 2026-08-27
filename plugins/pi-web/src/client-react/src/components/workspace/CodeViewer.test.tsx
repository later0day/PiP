import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { CodeViewer } from "./CodeViewer";

// Ports the read-only CodeMirror 6 source view to RTL. CodeMirror owns the DOM
// inside the ref host, so we assert against its rendered structure: the document
// text lands in a .cm-content line, a line-number gutter is present, and the
// editor is non-editable. The view is torn down on unmount.
describe("CodeViewer", () => {
  it("renders the document content inside a CodeMirror editor", () => {
    const { container } = render(<CodeViewer content={"const answer = 42"} language="typescript" />);
    const content = container.querySelector(".cm-content");
    expect(content).not.toBeNull();
    expect(container.textContent).toContain("const answer = 42");
  });

  it("renders a line-number gutter", () => {
    const { container } = render(<CodeViewer content={"one\ntwo\nthree"} language="typescript" />);
    expect(container.querySelector(".cm-gutters")).not.toBeNull();
    expect(container.querySelector(".cm-lineNumbers")).not.toBeNull();
  });

  it("mounts a read-only, non-editable editor", () => {
    const { container } = render(<CodeViewer content="readonly" />);
    const content = container.querySelector(".cm-content");
    expect(content).not.toBeNull();
    expect(content?.getAttribute("contenteditable")).toBe("false");
  });

  it("tears the editor down on unmount", () => {
    const { container, unmount } = render(<CodeViewer content="bye" language="json" />);
    expect(container.querySelector(".cm-editor")).not.toBeNull();
    unmount();
    expect(container.querySelector(".cm-editor")).toBeNull();
  });
});
