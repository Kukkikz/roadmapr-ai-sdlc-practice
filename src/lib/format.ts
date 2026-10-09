const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });

/** "Oct 9, 2026". UTC so the server and the browser agree. */
export function formatDate(date: Date): string {
  return dateFormat.format(date);
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
