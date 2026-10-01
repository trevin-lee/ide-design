// Where a review comment was left beyond its source line: a later page of a flowing doc page,
// a narrower viewport of a responsive screen. Shared by the CLI, MCP and the viewer.

export function commentPlace(c: { target?: { page?: number; viewport?: string } | null }): string {
  return [c.target?.page ? `page ${c.target.page + 1}` : "", c.target?.viewport ? `on ${c.target.viewport}` : ""].filter(Boolean).join(", ");
}
