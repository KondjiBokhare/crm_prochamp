import { Link } from "react-router-dom";
import { Laptop, Monitor, Cpu, CircuitBoard, Fan, HardDrive, MemoryStick, Keyboard, Mouse, Wifi, Package, Zap, Printer, Gamepad2 } from "lucide-react";
import { useCategories } from "../../services/siteSettingsService";

const ICONS = { laptop: Laptop, monitor: Monitor, cpu: Cpu, circuit: CircuitBoard, fan: Fan, drive: HardDrive, memory: MemoryStick, keyboard: Keyboard, mouse: Mouse, wifi: Wifi, package: Package, zap: Zap, printer: Printer, gamepad: Gamepad2 };

function CategoryStrip() {
  const categories = useCategories();
  return <section className="category-strip">{categories.map((category) => {
    const Icon = ICONS[category.iconKey] || Package;
    return <Link className="category-card" key={category.id} to={`/products?category=${encodeURIComponent(category.name)}`}><div className="category-icon"><Icon size={35} strokeWidth={1.5}/></div><span>{category.name}</span></Link>;
  })}</section>;
}
export default CategoryStrip;
