import { PATHS } from "./paths";

export const RESPONDER_ROLES = ["tanod", "responder", "police", "fire"];

export function getRoleHome(role) {
  if (role === "admin") return PATHS.admin;
  if (role === "resident") return PATHS.resident;
  if (role === "bdrrmo") return PATHS.bdrrmo;
  if (RESPONDER_ROLES.includes(role)) return PATHS.responder;
  return null;
}
