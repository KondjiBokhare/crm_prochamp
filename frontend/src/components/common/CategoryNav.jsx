import { NavLink, useLocation } from "react-router-dom";
import { Laptop, Monitor, Cpu, CircuitBoard, MemoryStick, HardDrive, Fan, Zap, Package, Keyboard, Mouse, Wifi, Printer, Gamepad2 } from "lucide-react";
import { useCategories } from "../../services/siteSettingsService";

const ICONS = { laptop: Laptop, monitor: Monitor, cpu: Cpu, circuit: CircuitBoard, memory: MemoryStick, drive: HardDrive, fan: Fan, zap: Zap, package: Package, keyboard: Keyboard, mouse: Mouse, wifi: Wifi, printer: Printer, gamepad: Gamepad2 };

function CategoryNav() {
  const categories = useCategories();
  const location = useLocation();
  const selectedCategory = new URLSearchParams(location.search).get("category") || "";
  return (
    <nav className="category-nav" aria-label="Product categories">
      <div className="category-links">
        {categories.map((category) => {
          const Icon = ICONS[category.iconKey] || Package;
          const active = selectedCategory.toLowerCase() === category.name.toLowerCase();
          return <NavLink key={category.id} to={`/products?category=${encodeURIComponent(category.name)}`} className={`category-item${active ? " active" : ""}`}>
            <span className="category-icon-wrap"><Icon size={23}/></span>
            <span className="category-label">{category.name}</span>
          </NavLink>;
        })}
      </div>
    </nav>
  );
}

export default CategoryNav;
