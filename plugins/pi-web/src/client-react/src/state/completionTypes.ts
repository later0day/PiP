// Phase 4b: the completion item shape the composer inserts. Mirrors the legacy
// CompletionItem (src/client/src/components/shared.ts) verbatim, kept in the
// React tree so the completions hook + AutocompleteMenu don't import the
// Lit-flavored shared module.
export interface CompletionItem {
  kind: "command" | "file" | "model";
  replaceFrom: number;
  replaceTo: number;
  insertText: string;
  detail: string;
  description?: string;
  cursorOffset?: number;
}
