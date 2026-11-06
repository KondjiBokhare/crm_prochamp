export const CRM_ROLES = [
  "ADMIN",
  "SALES",
  "SUPPORT",
  "MARKETING",
  "OPERATIONS",
  "MANAGEMENT",
  "ANALYST",
];

export const LEGACY_ROLE_ALIASES = {
  CRM_MANAGER: "SALES",
  SUPPORT_AGENT: "SUPPORT",
  MARKETING_MANAGER: "MARKETING",
  ANALYST_LEGACY: "ANALYST",
};

export function normalizeRoleName(role) {
  const value = String(role ?? "").trim().toUpperCase();
  return LEGACY_ROLE_ALIASES[value] || value;
}

export const ROLE_LABELS = {
  ADMIN: "Administrator",
  SALES: "Sales",
  MARKETING: "Marketing",
  SUPPORT: "Support",
  OPERATIONS: "Operations",
  MANAGEMENT: "Management",
  ANALYST: "Analyst",
  CUSTOMER: "Customer",

  // Legacy frontend aliases kept for compatibility with older data and demo values.
  CRM_MANAGER: "Sales",
  SUPPORT_AGENT: "Support",
  MARKETING_MANAGER: "Marketing",
  ANALYST_LEGACY: "Analyst",
};

// Frontend navigation rules for the demo. The Django API must independently
// enforce the same authorization rules; these checks only control the UI.
export const PAGE_ROLES = {
  dashboard: CRM_ROLES,
  customers: ["ADMIN", "SALES", "SUPPORT", "MARKETING"],
  leads: ["ADMIN", "SALES", "MARKETING"],
  orders: ["ADMIN", "SALES", "SUPPORT"],
  shipments: ["ADMIN", "SALES", "SUPPORT", "OPERATIONS"],
  returns: ["ADMIN", "SALES", "SUPPORT", "OPERATIONS"],
  orderActivity: ["ADMIN", "SALES", "SUPPORT", "OPERATIONS"],
  support: ["ADMIN", "SALES", "SUPPORT"],
  customerDetails: ["ADMIN", "SALES", "SUPPORT", "MARKETING"],
  interactions: ["ADMIN", "SALES", "SUPPORT"],
  segments: ["ADMIN", "SALES", "MARKETING"],
  campaigns: ["ADMIN", "SALES", "MARKETING"],
  communications: ["ADMIN", "SALES", "SUPPORT", "MARKETING"],
  analytics: ["ADMIN", "ANALYST"],
  auditLogs: ["ADMIN", "ANALYST"],
  banners: ["ADMIN", "MARKETING"],
  products: ["ADMIN", "SALES"],
  productReviews: ["ADMIN", "MARKETING", "ANALYST"],
  categories: ["ADMIN", "SALES"],
  storefrontSettings: ["ADMIN"],
  userManagement: ["ADMIN"],
  homepagePromotions: ["ADMIN", "MARKETING"],
  inventory: ["ADMIN", "SALES", "OPERATIONS"],
  coupons: ["ADMIN", "MARKETING"],
  abandonedCarts: ["ADMIN", "SALES", "MARKETING", "ANALYST", "OPERATIONS"],
};
