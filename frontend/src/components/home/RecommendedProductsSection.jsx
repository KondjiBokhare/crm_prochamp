import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ProductCard from "./ProductCard";
import { getStorefrontRecommendations, recommendationsApiEnabled } from "../../services/behaviorApiService";

function RecommendedProductsSection() {
  const [result, setResult] = useState({ items: [], source: "", eventCount: 0 });
  const [loading, setLoading] = useState(recommendationsApiEnabled);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!recommendationsApiEnabled) return undefined;
    let active = true;
    setLoading(true);
    getStorefrontRecommendations(8)
      .then((data) => { if (active) setResult(data); })
      .catch((loadError) => { if (active) setError(loadError?.message || "Recommendations are temporarily unavailable."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (!recommendationsApiEnabled) return null;
  if (!loading && !result.items.length && !error) return null;

  return (
    <section className="product-section" aria-labelledby="storefront-recommendations-title">
      <div className="section-heading">
        <div>
          <h2 id="storefront-recommendations-title">Trending Products</h2>
          <p className="section-subtitle">Popular picks based on anonymous store activity and product ratings—not individually personalised.</p>
        </div>
        <Link to="/products" className="view-all-button">View All →</Link>
      </div>
      {loading && <p className="storefront-recommendations-status">Loading recommendations…</p>}
      {error && <p className="storefront-recommendations-status" role="status">{error}</p>}
      {!loading && !error && result.items.length > 0 && <div className="product-grid">
        {result.items.map((product) => <ProductCard key={product.id} product={product} />)}
      </div>}
    </section>
  );
}

export default RecommendedProductsSection;
