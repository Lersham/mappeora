/**
 * The Camera plugin returns plain file paths on Android ("/data/user/0/…"),
 * while ML Kit parses its input with Uri.parse() and needs a scheme.
 * Paths that already have one (file://, content://) are left untouched.
 */
export function toFileUri(pathOrUri: string): string {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(pathOrUri)) return pathOrUri;
  return `file://${encodeURI(pathOrUri)}`;
}
