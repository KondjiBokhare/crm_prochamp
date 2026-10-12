import { Link } from "react-router-dom";
import { useSiteSettings } from "../../services/siteSettingsService";

const variants = {
  navbar: { root: "navbar-logo", mark: "logo-icon", name: "logo-text", tagline: "logo-tagline" },
  cart: { root: "cart-header-logo", mark: "cart-logo-icon", name: "cart-logo-text", tagline: "cart-logo-tagline" },
  checkout: { root: "checkout-header-logo", mark: "checkout-logo-icon", name: "checkout-logo-text", tagline: "checkout-logo-tagline" },
};

function StoreLogo({ variant = "navbar" }) {
  const settings = useSiteSettings();
  const classes = variants[variant] || variants.navbar;
  const brand = settings.brand || {};
  return (
    <Link to="/" className={`${classes.root} store-dynamic-logo`} aria-label={`${brand.name || "Store"} home`}>
      {brand.logoImage ? (
        <img src={brand.logoImage} alt="" className="store-brand-image" />
      ) : (
        <div className={classes.mark}>{brand.logoMark || "▣"}</div>
      )}
      <div className="store-brand-copy">
        <div className={classes.name}>{brand.name || "Store"}</div>
        {brand.tagline && <div className={classes.tagline}>{brand.tagline}</div>}
      </div>
    </Link>
  );
}

export default StoreLogo;
