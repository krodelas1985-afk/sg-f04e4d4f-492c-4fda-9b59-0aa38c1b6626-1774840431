/**
 * Where a signed-in user lands.
 *
 * One answer, shared by every path that sends someone "home" -- login, the root
 * route, email confirmation, setting a password, the middleware, and the sidebar
 * logo -- so they cannot drift apart. Before this they each hard-coded
 * /dashboard, which is why moving the landing page meant touching six files.
 *
 * client_admin and manager open on the workspace Overview. Agents open on their
 * own Dashboard: Overview is team-wide and hidden from them. BaMo staff open on
 * /admin. A missing or unrecognised role falls back to /dashboard, the one page
 * every role can use.
 */
export function homeRouteFor(role: string | null | undefined): string {
  if (role === "baymo_admin") return "/admin";
  if (role === "client_admin" || role === "manager") return "/overview";
  return "/dashboard";
}
