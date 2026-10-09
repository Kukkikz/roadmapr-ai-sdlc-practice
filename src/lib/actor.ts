/** Comments and Ideas written by a Member carry a `member:<id>` Actor; Visitors carry `anon:<id>`. */
export function isMemberActor(actorId: string): boolean {
  return actorId.startsWith("member:");
}
