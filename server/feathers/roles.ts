/** Who counts as CMS staff. Kept apart from hooks.ts so any module can import it. */

/** Admin-account roles allowed to change content through the admin API. */
export const STAFF_ROLES = ["admin", "editor"];

/** Is this call from CMS staff (or from inside the server)?
 * Calls made by server code carry no provider and are always allowed; the
 * internal server marks its own connections `internal`. */
export function isStaff(params: any, roles: string[] = STAFF_ROLES): boolean {
  if (!params?.provider) return true;
  if (params.internal || params.user?.internal) return true;
  return !!params.user && roles.includes(params.user.role);
}
