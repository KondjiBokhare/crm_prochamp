import { Link } from "react-router-dom";
import ProductCard from "./ProductCard";
import { useProductCatalog } from "../../services/productCatalogService";

function DealsSection({ title = "Deals of the Day", subtitle = "Explore current price drops and product offers." }) {
  const catalogue = useProductCatalog();
  const products = catalogue
    .filter((product) => Number(product.discount || 0) > 0)
    .sort((a, b) => Number(b.discount || 0) - Number(a.discount || 0))
    .slice(0, 10);
  if (!products.length) return null;
  return (
    <section className="deals-section">
      <div className="deals-heading">
        <div className="deals-title"><h2>{title}</h2>{subtitle && <p className="section-subtitle">{subtitle}</p>}</div>
        <Link to="/products?sort=discount" className="view-all-button">View All →</Link>
      </div>
      <div className="deals-grid">
        {products.map((product) => <ProductCard key={product.id} product={product} />)}
      </div>
    </section>
  );
}

export default DealsSection;
