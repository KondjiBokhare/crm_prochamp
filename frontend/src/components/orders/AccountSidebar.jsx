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
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const menuItems = [
    { label: "My Account", icon: User, path: "/profile" },
    { label: "My Orders", icon: Package, path: "/orders" },

    // Profile sidebar wishlist
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
        <div className="account-avatar">AG</div>

        <div>
          <strong>Ankit Kumar Gupta</strong>
          <span>ankit23@gmail.com</span>
        </div>
      </div>

      <nav className="account-menu">
        {menuItems.map(({ label, icon: Icon, path }) => (
          <NavLink
            key={label}
            to={path}
            className={({ isActive }) =>
              isActive
                ? "account-menu-link active"
                : "account-menu-link"
            }
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <button
        type="button"
        className="account-logout"
        onClick={handleLogout}
      >
        <LogOut size={20} />
        <span>Logout</span>
      </button>

      <div className="support-box">
        <Headphones size={28} />
        <strong>Need Help?</strong>
        <p>We're here to help you 24×7.</p>
        <button type="button">Contact Support</button>
      </div>
    </aside>
  );
}

export default AccountSidebar;