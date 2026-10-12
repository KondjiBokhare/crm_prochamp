import { Link } from "react-router-dom";
import { Mail, MapPin, Phone } from "lucide-react";
import { DEFAULT_FOOTER_LINKS, useSiteSettings } from "../../services/siteSettingsService";

function StoreFooter() {
  const settings = useSiteSettings();
  const links = Array.isArray(settings.footer?.links) ? settings.footer.links : DEFAULT_FOOTER_LINKS;
  const brandName = settings.brand?.name || "Store";
  return (
    <footer className="store-footer">
      <div className="store-footer-main">
        <section className="store-footer-brand">
          <h2>{brandName}</h2>
          <p>{settings.footer?.description || "Shop with confidence."}</p>
          <p className="store-footer-tagline">{settings.brand?.tagline || ""}</p>
        </section>
        <nav className="store-footer-links" aria-label="Customer information">
          <h3>Information & Support</h3>
          {links.map((item) => <Link key={`${item.path}-${item.label}`} to={item.path}>{item.label}</Link>)}
        </nav>
        <section className="store-footer-contact">
          <h3>Contact Us</h3>
          {settings.contact?.email && <a href={`mailto:${settings.contact.email}`}><Mail size={16}/><span>{settings.contact.email}</span></a>}
          {settings.contact?.phone && <a href={`tel:${String(settings.contact.phone).replace(/[^+\d]/g, "")}`}><Phone size={16}/><span>{settings.contact.phone}</span></a>}
          {settings.contact?.address && <p><MapPin size={16}/><span>{settings.contact.address}</span></p>}
          {settings.contact?.hours && <small>{settings.contact.hours}</small>}
        </section>
      </div>
      <div className="store-footer-bottom"><span>© {new Date().getFullYear()} {brandName}. All rights reserved.</span><span>Company-owned storefront</span></div>
    </footer>
  );
}

export default StoreFooter;
