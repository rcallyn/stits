// Set by GET /demo. Not a credential: it only lets page shells load without
// a session (they hold no user data) and tells the client to answer /api
// calls from the in-browser sample data. Every /api route still requires a
// real session.
export const DEMO_COOKIE_NAME = "stits_demo";
