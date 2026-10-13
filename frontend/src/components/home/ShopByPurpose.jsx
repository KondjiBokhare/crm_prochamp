import { Link } from "react-router-dom";
import { Gamepad2, BriefcaseBusiness, Video, GraduationCap, Tv, Package, ArrowRight } from "lucide-react";

const iconMap = { gamepad: Gamepad2, briefcase: BriefcaseBusiness, video: Video, education: GraduationCap, tv: Tv, package: Package };
const fallbackItems = [
  { id: "gaming", title: "Gaming", description: "High-performance PCs, GPUs and monitors", category: "Graphics Cards", icon: "gamepad" },
  { id: "business", title: "Office & Business", description: "Reliable systems for everyday productivity", category: "Laptops", icon: "briefcase" },
  { id: "creator", title: "Content Creation", description: "Powerful hardware for editing and design", category: "Monitors", icon: "video" },
  { id: "students", title: "Students", description: "Affordable laptops and accessories", category: "Laptops", icon: "education" },
  { id: "home", title: "Home & Entertainment", description: "Devices for work, media and everyday use", category: "Monitors", icon: "tv" },
];

function ShopByPurpose({ title = "Shop by Purpose", subtitle = "Find hardware built for what you do.", items = fallbackItems }) {
  const entries = Array.isArray(items) ? items : fallbackItems;
  if (!entries.length) return null;
  return (
    <section className="purpose-section">
      <div className="section-heading"><div><h2>{title}</h2>{subtitle && <p className="section-subtitle">{subtitle}</p>}</div><Link to="/products" className="view-all-button">Explore All →</Link></div>
      <div className="purpose-grid">
        {entries.map((item, index) => {
          const Icon = iconMap[item.icon] || Package;
          const to = item.category ? `/products?category=${encodeURIComponent(item.category)}` : `/products?search=${encodeURIComponent(item.title || "")}`;
          return <Link className="purpose-card" key={item.id || `${item.title}-${index}`} to={to}>
            <div className="purpose-icon"><Icon size={30} /></div>
            <div className="purpose-content"><h3>{item.title}</h3><p>{item.description}</p></div>
            <span className="purpose-arrow" aria-hidden="true"><ArrowRight size={17}/></span>
          </Link>;
        })}
      </div>
    </section>
  );
}

export default ShopByPurpose;
