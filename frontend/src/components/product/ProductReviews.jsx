import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Star } from "lucide-react";
import {
  storefrontReviewsApiEnabled,
  getStorefrontProductReviews,
} from "../../services/storefrontCommerceApiService";

// Used only in demo mode. In API mode the review endpoint is expected to return
// the public/approved reviews only.
const DEMO_REVIEWS = [
  { id: "demo-1", name: "Rahul S.", rating: 5, title: "Excellent product", comment: "Performance is very good and the product was packed safely." },
  { id: "demo-2", name: "Priya K.", rating: 4, title: "Good value", comment: "Great performance for the price." },
  { id: "demo-3", name: "Amit R.", rating: 5, title: "Worth buying", comment: "Works as expected for my setup." },
];

function Stars({ rating = 0, size = 15 }) {
  return (
    <div className="rating-stars" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} size={size} fill={star <= Math.round(Number(rating) || 0) ? "#f59e0b" : "none"} color="#f59e0b" />
      ))}
    </div>
  );
}

function isPublicReview(review = {}) {
  const status = String(review.status || review.moderationStatus || review.moderation_status || "").trim().toUpperCase();
  return !status || ["APPROVED", "PUBLISHED", "PUBLIC"].includes(status);
}

function ProductReviews({ productId, rating = 0, totalReviews = 0 }) {
  const [reviewData, setReviewData] = useState({
    items: [],
    summary: { rating: Number(rating) || 0, count: Number(totalReviews) || 0 },
  });
  const [loading, setLoading] = useState(storefrontReviewsApiEnabled);
  const [loadError, setLoadError] = useState("");

  const refreshReviews = useCallback(async () => {
    if (!storefrontReviewsApiEnabled || !productId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError("");
    try {
      const result = await getStorefrontProductReviews(productId);
      const items = (Array.isArray(result?.items) ? result.items : []).filter(isPublicReview);
      setReviewData({
        items,
        summary: {
          rating: Number(result?.summary?.rating) || 0,
          count: items.length,
        },
      });
    } catch (error) {
      setLoadError(error?.message || "Could not load product reviews.");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    if (storefrontReviewsApiEnabled) refreshReviews();
    else {
      setReviewData({ items: DEMO_REVIEWS, summary: { rating: Number(rating) || 0, count: DEMO_REVIEWS.length } });
      setLoading(false);
    }
  }, [refreshReviews, rating]);

  const visibleReviews = storefrontReviewsApiEnabled
    ? reviewData.items.map((review) => ({
        id: review.id,
        name: review.reviewerName || review.reviewer_name || review.name || "Customer",
        rating: Number(review.rating) || 0,
        title: review.title || "",
        comment: review.comment || review.body || "",
        verifiedPurchase: Boolean(review.verifiedPurchase ?? review.verified_purchase),
      }))
    : DEMO_REVIEWS;
  const displayedRating = storefrontReviewsApiEnabled && !loading
    ? reviewData.summary.rating
    : (Number(rating) || 0);
  const displayedCount = storefrontReviewsApiEnabled && !loading
    ? reviewData.summary.count
    : (storefrontReviewsApiEnabled ? Number(totalReviews) || 0 : visibleReviews.length);

  return (
    <section className="product-section-block reviews-section" aria-labelledby="product-reviews-title">
      <div className="reviews-header">
        <div>
          <h2 id="product-reviews-title">Ratings &amp; Reviews</h2>
          <p className="section-subtitle">Customer ratings and published reviews for this product.</p>
        </div>
        <div className="overall-rating">
          <strong>{Number(displayedRating).toFixed(1)}</strong>
          <Stars rating={displayedRating} />
          <span>{displayedCount.toLocaleString("en-IN")} approved reviews</span>
        </div>
      </div>

      <div className="review-list">
        {loading && <p className="section-subtitle reviews-state-message">Loading published reviews…</p>}
        {!loading && loadError && (
          <div className="crm-empty-state reviews-state-message" role="alert">
            <h3>Reviews could not be loaded</h3>
            <p>{loadError}</p>
            <button type="button" onClick={refreshReviews} className="crm-button crm-button-secondary crm-button-small">
              <RefreshCw size={13} /> Try again
            </button>
          </div>
        )}
        {!loading && !loadError && visibleReviews.map((review) => (
          <article className="review-card" key={review.id}>
            <div className="review-top">
              <strong>{review.name}</strong>
              <div className="review-rating">{review.rating}<Star size={13} fill="currentColor" /></div>
            </div>
            <Stars rating={review.rating} size={13} />
            {review.title && <h3>{review.title}</h3>}
            <p>{review.comment}</p>
            {review.verifiedPurchase && <span className="verified-review-badge">Verified purchase</span>}
          </article>
        ))}
        {!loading && !loadError && visibleReviews.length === 0 && (
          <div className="crm-empty-state reviews-state-message">
            <h3>No published reviews yet</h3>
            <p>Published customer reviews will appear here. After your order ships, you can review it from My Orders.</p>
            {storefrontReviewsApiEnabled && (
              <button type="button" onClick={refreshReviews} className="crm-button crm-button-secondary crm-button-small">
                <RefreshCw size={13} /> Refresh reviews
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default ProductReviews;
