import { authenticateStaffUser, listStaffUsers } from "../services/staffUserService";

// DEMO-ONLY accounts for frontend development. These credentials are public
// because they live in the browser bundle and must never be used in production.
export const DEMO_USERS = [
  { id: "demo-admin-1", name: "Aarav Admin", email: "admin@techgear.demo", password: "Demo@123", role: "ADMIN" },
  { id: "demo-manager-1", name: "Maya Manager", email: "manager@techgear.demo", password: "Demo@123", role: "CRM_MANAGER" },
  { id: "demo-support-1", name: "Sam Support", email: "support@techgear.demo", password: "Demo@123", role: "SUPPORT_AGENT" },
  { id: "demo-marketing-1", name: "Mira Marketing", email: "marketing@techgear.demo", password: "Demo@123", role: "MARKETING_MANAGER" },
  { id: "demo-analyst-1", name: "Aadi Analyst", email: "analyst@techgear.demo", password: "Demo@123", role: "ANALYST" },
];

export function authenticateDemoCrmUser(email, password) {
  return authenticateStaffUser(email, password, DEMO_USERS);
}

export function getAvailableCrmLoginUsers() {
  return listStaffUsers(DEMO_USERS).filter((user) => user.active);
}
