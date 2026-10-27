// Sidebar preferences live in cookies so the server renders the right layout
// on first paint (no flash of the wide sidebar). Shared by the server layout
// and the client shell, so this file must stay free of "use client".
export const RAIL_COOKIE = "pleasant_nav_rail";
export const CLOSED_COOKIE = "pleasant_nav_closed";
