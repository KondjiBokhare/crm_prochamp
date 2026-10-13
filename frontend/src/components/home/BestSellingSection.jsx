import { Link } from "react-router-dom";
import ProductCard from "./ProductCard";
import { useProductCatalog } from "../../services/productCatalogService";

function reviewCount(value) {
  const raw = String(value || "0").trim().toLowerCase();
  const match = raw.match(/^([\d.]+)\s*k$/);
  return match ? Number(match[1]) * 1000 : Number(raw.replace(/[^0-9.]/g, "")) || 0;
}

function BestSellingSection({ title = "Best Selling Products", subtitle = "Popular picks from our catalogue." }) {
  const catalogue = useProductCatalog();
  const products = [...catalogue]
    .sort((a, b) => reviewCount(b.reviews) - reviewCount(a.reviews))
    .slice(0, 10);
  if (!products.length) return null;
  return (
    <section className="product-section">
      <div className="section-heading">
        <div><h2>{title}</h2>{subtitle && <p className="section-subtitle">{subtitle}</p>}</div>
        <Link to="/products" className="view-all-button">View All →</Link>
      </div>
      <div className="product-grid">
        {products.map((product) => <ProductCard key={product.id} product={product} />)}
      </div>
    </section>
  );
}

export default BestSellingSection;
