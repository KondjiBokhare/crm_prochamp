export const CRM_ROLES = [
  "ADMIN",
  "CRM_MANAGER",
  "SUPPORT_AGENT",
  "MARKETING_MANAGER",
  "ANALYST",
  "OPERATIONS",
];

export const ROLE_LABELS = {
  ADMIN: "Administrator",
  CRM_MANAGER: "CRM Manager",
  SUPPORT_AGENT: "Support Agent",
  MARKETING_MANAGER: "Marketing Manager",
  ANALYST: "Analyst / Management",
  OPERATIONS: "Operations",
  CUSTOMER: "Customer",
};

// Frontend navigation rules for the demo. The Django API must independently
// enforce the same authorization rules; these checks only control the UI.
export const PAGE_ROLES = {
  dashboard: CRM_ROLES,
  customers: ["ADMIN", "CRM_MANAGER", "SUPPORT_AGENT", "MARKETING_MANAGER"],
  leads: ["ADMIN", "CRM_MANAGER", "MARKETING_MANAGER"],
  orders: ["ADMIN", "CRM_MANAGER", "SUPPORT_AGENT"],
  shipments: ["ADMIN", "CRM_MANAGER", "SUPPORT_AGENT", "OPERATIONS"],
  returns: ["ADMIN", "CRM_MANAGER", "SUPPORT_AGENT", "OPERATIONS"],
  orderActivity: ["ADMIN", "CRM_MANAGER", "SUPPORT_AGENT", "OPERATIONS"],
  support: ["ADMIN", "CRM_MANAGER", "SUPPORT_AGENT"],
  customerDetails: ["ADMIN", "CRM_MANAGER", "SUPPORT_AGENT", "MARKETING_MANAGER"],
  interactions: ["ADMIN", "CRM_MANAGER", "SUPPORT_AGENT"],
  segments: ["ADMIN", "CRM_MANAGER", "MARKETING_MANAGER"],
  campaigns: ["ADMIN", "CRM_MANAGER", "MARKETING_MANAGER"],
  communications: ["ADMIN", "CRM_MANAGER", "SUPPORT_AGENT", "MARKETING_MANAGER"],
  analytics: ["ADMIN", "ANALYST"],
  auditLogs: ["ADMIN", "ANALYST"],
  banners: ["ADMIN", "MARKETING_MANAGER"],
  products: ["ADMIN", "CRM_MANAGER"],
  productReviews: ["ADMIN", "MARKETING_MANAGER", "ANALYST"],
  categories: ["ADMIN", "CRM_MANAGER"],
  storefrontSettings: ["ADMIN"],
  userManagement: ["ADMIN"],
  homepagePromotions: ["ADMIN", "MARKETING_MANAGER"],
  inventory: ["ADMIN", "CRM_MANAGER", "OPERATIONS"],
  coupons: ["ADMIN", "MARKETING_MANAGER"],
  abandonedCarts: ["ADMIN", "CRM_MANAGER", "MARKETING_MANAGER", "ANALYST", "OPERATIONS"],
};
