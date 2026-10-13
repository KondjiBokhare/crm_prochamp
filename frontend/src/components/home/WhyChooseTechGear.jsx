import { ShieldCheck, Truck, CreditCard, RotateCcw, Headphones, Package } from "lucide-react";

const iconMap = { shield: ShieldCheck, truck: Truck, "credit-card": CreditCard, return: RotateCcw, support: Headphones, package: Package };
const fallbackItems = [
  { id: "authentic", title: "Genuine Products", description: "Authentic hardware from trusted brands.", icon: "shield" },
  { id: "delivery", title: "Reliable Delivery", description: "Clear delivery information for every order.", icon: "truck" },
  { id: "payment", title: "Payment Options", description: "Choose from supported checkout payment methods.", icon: "credit-card" },
  { id: "returns", title: "Return Support", description: "Find help for eligible product returns.", icon: "return" },
  { id: "support", title: "Customer Support", description: "Get help with product selection and orders.", icon: "support" },
];

function WhyChooseTechGear({ title = "Why Choose Us?", subtitle = "A reliable experience at every step.", items = fallbackItems }) {
  const entries = Array.isArray(items) ? items : fallbackItems;
  return (
    <section className="why-techgear-section">
      <div className="section-heading"><div><h2>{title}</h2>{subtitle && <p className="section-subtitle">{subtitle}</p>}</div></div>
      <div className="benefits-grid">
        {entries.map((item, index) => {
          const Icon = iconMap[item.icon] || Package;
          return <div className="benefit-card" key={item.id || `${item.title}-${index}`}><div className="benefit-icon"><Icon size={28} /></div><div><h3>{item.title}</h3><p>{item.description}</p></div></div>;
        })}
      </div>
    </section>
  );
}

export default WhyChooseTechGear;
