import { Link } from "react-router-dom";
import { useProductCatalog } from "../../services/productCatalogService";

function FeaturedBrands({ title = "Featured Brands", subtitle = "Shop brands available in our catalogue." }) {
  const products = useProductCatalog();
  const brands = [...new Set(products.map((product) => String(product.brand || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 12);
  if (!brands.length) return null;
  return (
    <section className="brands-section">
      <div className="section-heading"><div><h2>{title}</h2>{subtitle && <p className="section-subtitle">{subtitle}</p>}</div><Link to="/products" className="view-all-button">View All Brands →</Link></div>
      <div className="brands-grid">
        {brands.map((brand) => <Link key={brand} to={`/products?search=${encodeURIComponent(brand)}`} className="brand-card">
          <div className="brand-logo-wrapper"><span className="brand-initials" aria-hidden="true">{brand.split(/\s+/).map((part) => part[0]).join("").slice(0, 3).toUpperCase()}</span></div>
          <span>{brand}</span>
        </Link>)}
      </div>
    </section>
  );
}

export default FeaturedBrands;
