import { Link } from "react-router-dom";
import ProductCard from "../home/ProductCard";
import { useProductCatalog } from "../../services/productCatalogService";

function RelatedProducts({ product }) {
  const products = useProductCatalog();
  const currentId = String(product?.id ?? "");
  const candidates = products.filter((item) => String(item.id) !== currentId);
  const category = String(product?.category || "").trim().toLowerCase();
  const brand = String(product?.brand || "").trim().toLowerCase();

  const sameCategoryOrBrand = candidates.filter((item) => {
    const itemCategory = String(item.category || "").trim().toLowerCase();
    const itemBrand = String(item.brand || "").trim().toLowerCase();
    return (category && itemCategory === category) || (brand && itemBrand === brand);
  });

  // When there are no matching brand/category items, keep the section useful by
  // falling back to other catalog products, similar to a marketplace carousel.
  const relatedProducts = (sameCategoryOrBrand.length ? sameCategoryOrBrand : candidates)
    .sort((a, b) => {
      const ratingDifference = Number(b.rating || 0) - Number(a.rating || 0);
      if (ratingDifference !== 0) return ratingDifference;
      return Number(b.reviews || 0) - Number(a.reviews || 0);
    })
    .slice(0, 4);

  if (!relatedProducts.length) return null;

  return (
    <section className="product-section-block related-products-section">
      <div className="section-heading">
        <div>
          <h2>You May Also Like</h2>
          <p className="section-subtitle">Similar products picked from the TechGear catalogue.</p>
        </div>
        <Link to="/products" className="view-all-button">View All →</Link>
      </div>
      <div className="product-grid related-product-grid">
        {relatedProducts.map((item) => <ProductCard key={item.id} product={item} />)}
      </div>
    </section>
  );
}

export default RelatedProducts;
