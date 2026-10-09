/** A text field from a submitted form, or undefined if it is missing or not text. */
export function formText(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
}

/**
 * The honeypot field ("website"). A bot can send it as a file part, so any non-text value
 * counts as filled: a missing field is undefined, anything else is a non-empty string.
 */
export function honeypotValue(formData: FormData): string | undefined {
  return formData.get("website") instanceof File ? "file" : formText(formData, "website");
}
