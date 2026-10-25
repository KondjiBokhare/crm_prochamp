import { LogOut } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ROLE_LABELS } from "../auth/roles";
import { useSiteSettings } from "../services/siteSettingsService";
import { canUserAccessPage } from "../services/staffUserService";

const navigationItems = [
  { label: "Dashboard", to: "/crm", end: true, key: "dashboard" },
  { label: "Customers", to: "/crm/customers", key: "customers" },
  { label: "Leads", to: "/crm/leads", key: "leads" },
  { label: "Orders", to: "/crm/orders", key: "orders" },
  { label: "Shipment tracking", to: "/crm/shipments", key: "shipments" },
  { label: "Returns & RMA", to: "/crm/returns", key: "returns" },
  { label: "Order activity", to: "/crm/order-activity", key: "orderActivity" },
  { label: "Support Tickets", to: "/crm/support", key: "support" },
  { label: "Interactions", to: "/crm/interactions", key: "interactions" },
  { label: "Segments", to: "/crm/segments", key: "segments" },
  { label: "Campaigns", to: "/crm/campaigns", key: "campaigns" },
  { label: "Communications", to: "/crm/communications", key: "communications" },
  { label: "Banners", to: "/crm/banners", key: "banners" },
  { label: "Products", to: "/crm/products", key: "products" },
  { label: "Inventory", to: "/crm/inventory", key: "inventory" },
  { label: "Coupons & discounts", to: "/crm/coupons", key: "coupons" },
  { label: "Abandoned carts", to: "/crm/abandoned-carts", key: "abandonedCarts" },
  { label: "Product reviews", to: "/crm/product-reviews", key: "productReviews" },
  { label: "Categories", to: "/crm/categories", key: "categories" },
  { label: "Storefront settings", to: "/crm/storefront-settings", key: "storefrontSettings" },
  { label: "Homepage promotions", to: "/crm/homepage-promotions", key: "homepagePromotions" },
  { label: "User & permissions", to: "/crm/users", key: "userManagement" },
  { label: "Analytics", to: "/crm/analytics", key: "analytics" },
  { label: "Audit Logs", to: "/crm/audit-logs", key: "auditLogs" },
];

function Sidebar() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const siteSettings = useSiteSettings();
  const visibleItems = navigationItems.filter((item) => canUserAccessPage(user, item.key));
  const displayName = user?.name || user?.email || "CRM User";
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <aside className="sidebar crm-sidebar" aria-label="CRM navigation">
      <div className="crm-sidebar-brand">
        {siteSettings.brand?.logoImage ? <img className="crm-brand-image" src={siteSettings.brand.logoImage} alt="" /> : <span className="crm-brand-mark">{siteSettings.brand?.logoMark || "TG"}</span>}
        <div>
          <h2>{siteSettings.brand?.name || "Store"} CRM</h2>
          <p>Customer workspace</p>
        </div>
      </div>

      <p className="crm-sidebar-section-label">WORKSPACE</p>
      <nav className="sidebar-nav">
        {visibleItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="crm-sidebar-footer">
        <span className="crm-sidebar-avatar" aria-hidden="true">{initials}</span>
        <div className="crm-sidebar-footer-details">
          <strong>{displayName}</strong>
          <span>{ROLE_LABELS[user?.role] || user?.role || "Demo user"}</span>
        </div>
        <button
          type="button"
          className="crm-sidebar-logout"
          onClick={handleLogout}
          aria-label="Sign out of CRM"
          title="Sign out"
        >
          <LogOut size={17} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
