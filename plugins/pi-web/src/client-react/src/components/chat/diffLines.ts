// Diff classification helpers ported verbatim from the legacy ToolExecutionView,
// used by ToolExecutionCard to color unified-diff lines and count +/- stats.

export function countDiffLines(diff: string): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const line of diff.split("\n")) {
    if (isAddedDiffLine(line)) added++;
    else if (isRemovedDiffLine(line)) removed++;
  }
  return { added, removed };
}

export function diffLineClass(line: string): "added" | "removed" | "hunk" | "file" | "meta" | "context" {
  if (isAddedDiffLine(line)) return "added";
  if (isRemovedDiffLine(line)) return "removed";
  if (line.startsWith("@@")) return "hunk";
  if (line.startsWith("+++") || line.startsWith("---")) return "file";
  if (line.startsWith("diff ") || line.startsWith("index ")) return "meta";
  return "context";
}

function isAddedDiffLine(line: string): boolean {
  return line.startsWith("+") && !line.startsWith("+++");
}

function isRemovedDiffLine(line: string): boolean {
  return line.startsWith("-") && !line.startsWith("---");
}
