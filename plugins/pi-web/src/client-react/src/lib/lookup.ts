/**
 * Typed dynamic lookup into a `satisfies Record<string, T>` const. Plain
 * `table[key]` with a `string` key is an implicit-any index error under
 * strict mode; this keeps the value type without a type assertion (the
 * lint baseline bans `as`).
 */
export function lookup<T>(table: Record<string, T>, key: string): T | undefined {
  return table[key];
}
