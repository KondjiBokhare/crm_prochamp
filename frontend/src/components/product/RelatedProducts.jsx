import { Link } from "react-router-dom";
import ProductCard from "../home/ProductCard";
import { useProductCatalog } from "../../services/productCatalogService";

function RelatedProducts({ product }) {
  const products = useProductCatalog();
  const relatedProducts = products.filter((item) => item.id !== product.id && (item.category === product.category || item.brand === product.brand)).sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0)).slice(0, 4);

  if (!relatedProducts.length) {
    return null;
  }

  return (
    <section className="product-section-block">
      <div className="section-heading">
        <div>
          <h2>Related Products</h2>

          <p className="section-subtitle">
            You may also like these products.
          </p>
        </div>

        <Link
          to="/products"
          className="view-all-button"
        >
          View All →
        </Link>
      </div>

      <div className="product-grid related-product-grid">
        {relatedProducts.map((item) => (
          <ProductCard
            key={item.id}
            product={item}
          />
        ))}
      </div>
    </section>
  );
}

export default RelatedProducts;