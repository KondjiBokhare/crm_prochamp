import {
  User,
  Package,
  Heart,
  MapPin,
  CreditCard,
  Star,
  Headphones,
  Settings,
  LogOut,
} from "lucide-react";

import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

function AccountSidebar() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const displayName = user?.name || user?.fullName || "Customer";
  const email = user?.email || "Sign in to see your account";
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "C";

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const menuItems = [
    { label: "My Account", icon: User, path: "/profile" },
    { label: "My Orders", icon: Package, path: "/orders" },
    { label: "Wishlist", icon: Heart, path: "/account/wishlist" },
    { label: "Saved Addresses", icon: MapPin, path: "/addresses" },
    { label: "Payment Methods", icon: CreditCard, path: "/payments" },
    { label: "My Reviews", icon: Star, path: "/reviews" },
    { label: "Support Tickets", icon: Headphones, path: "/support" },
    { label: "Settings", icon: Settings, path: "/settings" },
  ];

  return (
    <aside className="account-sidebar">
      <div className="account-user">
        <div className="account-avatar">{initials}</div>
        <div>
          <strong>{displayName}</strong>
          <span>{email}</span>
        </div>
      </div>

      <nav className="account-menu" aria-label="Account navigation">
        {menuItems.map(({ label, icon: Icon, path }) => (
          <NavLink
            key={label}
            to={path}
            className={({ isActive }) =>
              isActive ? "account-menu-link active" : "account-menu-link"
            }
          >
            <Icon size={20} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <button type="button" className="account-logout" onClick={handleLogout}>
        <LogOut size={20} aria-hidden="true" />
        <span>Logout</span>
      </button>

      <div className="support-box">
        <Headphones size={28} aria-hidden="true" />
        <strong>Need Help?</strong>
        <p>We&apos;re here to help you 24×7.</p>
        <button type="button" onClick={() => navigate("/support")}>
          Contact Support
        </button>
      </div>
    </aside>
  );
}

export default AccountSidebar;
