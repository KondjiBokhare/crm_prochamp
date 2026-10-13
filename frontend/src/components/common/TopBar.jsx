import { Link } from "react-router-dom";
import { useSiteSettings } from "../../services/siteSettingsService";

function TopBar() {
  const settings = useSiteSettings();
  const topBar = settings.topBar || {};
  return (
    <div className="top-bar">
      <div className="top-bar-left">{topBar.message || "Welcome to our store"}</div>
      <nav className="top-bar-right" aria-label="Quick links">
        <Link to="/contact">{topBar.helpLabel || "Help Center"}</Link>
        <Link to="/orders">{topBar.trackLabel || "Track Order"}</Link>
      </nav>
    </div>
  );
}

export default TopBar;
