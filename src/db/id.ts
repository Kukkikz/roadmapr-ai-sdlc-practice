/** Application-generated string id (portable across PGlite and Postgres). */
export function newId(): string {
  return crypto.randomUUID();
}
