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

  CRM_MANAGER: "Sales",
  SUPPORT_AGENT: "Support",
  MARKETING_MANAGER: "Marketing",
  ANALYST_LEGACY: "Analyst",
};

export const PAGE_PERMISSION_REGISTRY = {
  dashboard: { label: "Dashboard", route: "/crm", sidebar: { label: "Dashboard", end: true }, apiModule: "analytics" },
  customers: { label: "Customers", route: "/crm/customers", sidebar: { label: "Customers" }, apiModule: "customers" },
  leads: { label: "Leads", route: "/crm/leads", sidebar: { label: "Leads" }, apiModule: "leads" },
  orders: { label: "Orders", route: "/crm/orders", sidebar: { label: "Orders" }, apiModule: "orders" },
  shipments: { label: "Shipments", route: "/crm/shipments", sidebar: { label: "Shipment tracking" }, apiModule: "shipments" },
  returns: { label: "Returns", route: "/crm/returns", sidebar: { label: "Returns & RMA" }, apiModule: "returns" },
  orderActivity: { label: "Order activity", route: "/crm/order-activity", sidebar: { label: "Order activity" }, apiModule: "order-activity" },
  support: { label: "Support tickets", route: "/crm/support", sidebar: { label: "Support Tickets" }, apiModule: "support-tickets" },
  customerDetails: { label: "Customer details", route: "/crm/customers/:id", apiModule: "customers/:id/profile-overview" },
  interactions: { label: "Interactions", route: "/crm/interactions", sidebar: { label: "Interactions" }, apiModule: "interactions" },
  segments: { label: "Customer segments", route: "/crm/segments", sidebar: { label: "Segments" }, apiModule: "segments" },
  campaigns: { label: "Campaigns", route: "/crm/campaigns", sidebar: { label: "Campaigns" }, apiModule: "campaigns" },
  communications: { label: "Communications", route: "/crm/communications", sidebar: { label: "Communications" }, apiModule: "communications" },
  banners: { label: "Banner management", route: "/crm/banners", sidebar: { label: "Banners" }, apiModule: "banners" },
  products: { label: "Product management", route: "/crm/products", sidebar: { label: "Products" }, apiModule: "products" },
  productReviews: { label: "Product reviews", route: "/crm/product-reviews", sidebar: { label: "Product reviews" }, apiModule: "product-reviews" },
  categories: { label: "Category management", route: "/crm/categories", sidebar: { label: "Categories" }, apiModule: "categories" },
  storefrontSettings: { label: "Global storefront settings", route: "/crm/storefront-settings", sidebar: { label: "Storefront settings" }, apiModule: "storefront-settings" },
  homepagePromotions: { label: "Homepage promotions", route: "/crm/homepage-promotions", sidebar: { label: "Homepage promotions" }, apiModule: "homepage-promotions" },
  userManagement: { label: "User and permissions management", route: "/crm/users", sidebar: { label: "User & permissions" }, apiModule: "accounts.staff" },
  analytics: { label: "Analytics and reports", route: "/crm/analytics", sidebar: { label: "Analytics" }, apiModule: "analytics" },
  auditLogs: { label: "Audit logs", route: "/crm/audit-logs", sidebar: { label: "Audit Logs" }, apiModule: "audit-logs" },
  inventory: { label: "Inventory and stock movements", route: "/crm/inventory", sidebar: { label: "Inventory" }, apiModule: "inventory/movements" },
  coupons: { label: "Coupons and discounts", route: "/crm/coupons", sidebar: { label: "Coupons & discounts" }, apiModule: "coupons" },
  abandonedCarts: { label: "Abandoned cart reporting", route: "/crm/abandoned-carts", sidebar: { label: "Abandoned carts" }, apiModule: "abandoned-carts" },
};

export const CRM_PAGE_KEYS = Object.keys(PAGE_PERMISSION_REGISTRY);
