// Task names always start with a capital letter ("create a blog" → "Create a
// blog"). Only the first character changes; the rest is left as typed.
export function capitalizeFirst(text: string) {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}
