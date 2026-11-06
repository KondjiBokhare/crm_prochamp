import { LogOut } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { PAGE_PERMISSION_REGISTRY, ROLE_LABELS } from "../auth/roles";
import { useSiteSettings } from "../services/siteSettingsService";
import { canUserAccessPage } from "../services/staffUserService";

const navigationItems = Object.entries(PAGE_PERMISSION_REGISTRY)
  .filter(([, page]) => page.sidebar)
  .map(([key, page]) => ({
    key,
    label: page.sidebar.label,
    to: page.route,
    end: page.sidebar.end,
  }));

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
          <span>
        {ROLE_LABELS[user?.backendRole] ||
          ROLE_LABELS[user?.role] ||
          user?.role ||
          "CRM User"}
      </span>
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
