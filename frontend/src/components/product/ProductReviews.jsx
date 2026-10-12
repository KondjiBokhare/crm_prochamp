import { useCallback, useEffect, useState } from "react";
import { Star, Send, RefreshCw } from "lucide-react";
import {
  storefrontReviewsApiEnabled,
  getStorefrontProductReviews,
  submitStorefrontProductReview,
} from "../../services/storefrontCommerceApiService";

const DEMO_REVIEWS = [
  { id: "demo-1", name: "Rahul S.", rating: 5, title: "Excellent product", comment: "Performance is very good and the product was packed safely." },
  { id: "demo-2", name: "Priya K.", rating: 4, title: "Good value", comment: "Great performance for the price." },
  { id: "demo-3", name: "Amit R.", rating: 5, title: "Worth buying", comment: "Works as expected for my setup." },
];

function Stars({ rating = 0, size = 15 }) {
  return <div className="rating-stars" aria-label={`${rating} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((star) => <Star key={star} size={size} fill={star <= Math.round(Number(rating) || 0) ? "#f59e0b" : "none"} color="#f59e0b" />)}
  </div>;
}

function ProductReviews({ productId, rating = 0, totalReviews = 0 }) {
  const [reviewData, setReviewData] = useState({ items: [], summary: { rating: Number(rating) || 0, count: Number(totalReviews) || 0 } });
  const [loading, setLoading] = useState(storefrontReviewsApiEnabled);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState("info");
  const [form, setForm] = useState({ reviewerName: "", rating: 5, title: "", comment: "" });

  const refreshReviews = useCallback(async () => {
    if (!storefrontReviewsApiEnabled || !productId) return;
    setLoading(true);
    try {
      const result = await getStorefrontProductReviews(productId);
      setReviewData(result);
    } catch (error) {
      setNotice(error?.message || "Could not load product reviews.");
      setNoticeType("error");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    if (storefrontReviewsApiEnabled) refreshReviews();
  }, [refreshReviews]);

  const updateForm = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: name === "rating" ? Number(value) : value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!productId) return;
    setSubmitting(true);
    setNotice("");
    try {
      const result = await submitStorefrontProductReview(productId, form);
      setNotice(result?.detail || "Review submitted and awaiting moderation.");
      setNoticeType("success");
      setForm({ reviewerName: "", rating: 5, title: "", comment: "" });
    } catch (error) {
      setNotice(error?.message || "Could not submit your review.");
      setNoticeType("error");
    } finally {
      setSubmitting(false);
    }
  };

  const visibleReviews = storefrontReviewsApiEnabled
    ? reviewData.items.map((review) => ({
        id: review.id,
        name: review.reviewerName || "Customer",
        rating: Number(review.rating) || 0,
        title: review.title || "",
        comment: review.comment || "",
        verifiedPurchase: Boolean(review.verifiedPurchase),
      }))
    : DEMO_REVIEWS;
  const displayedRating = storefrontReviewsApiEnabled && !loading ? reviewData.summary.rating : (Number(rating) || 0);
  const displayedCount = storefrontReviewsApiEnabled && !loading ? reviewData.summary.count : (Number(totalReviews) || 0);

  return (
    <section className="product-section-block reviews-section">
      <div className="reviews-header">
        <div>
          <h2>Ratings & Reviews</h2>
          <p className="section-subtitle">See what other customers think about this product.</p>
        </div>
        <div className="overall-rating">
          <strong>{Number(displayedRating).toFixed(1)}</strong>
          <Stars rating={displayedRating} />
          <span>{displayedCount.toLocaleString("en-IN")} approved reviews</span>
        </div>
      </div>

      {storefrontReviewsApiEnabled ? (
        <div className="storefront-review-form-wrap">
          <h3>Write a review</h3>
          <p className="section-subtitle">Reviews are checked by the store team before being published. No email or phone number is requested.</p>
          <form className="storefront-review-form" onSubmit={handleSubmit}>
            <label><span>Your display name</span><input name="reviewerName" value={form.reviewerName} onChange={updateForm} minLength={2} maxLength={100} required placeholder="e.g. Rahul S." /></label>
            <label><span>Rating</span><select name="rating" value={form.rating} onChange={updateForm}>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} star{value === 1 ? "" : "s"}</option>)}</select></label>
            <label className="storefront-review-form-wide"><span>Review title</span><input name="title" value={form.title} onChange={updateForm} minLength={3} maxLength={120} required placeholder="Summarise your experience" /></label>
            <label className="storefront-review-form-wide"><span>Your review</span><textarea name="comment" value={form.comment} onChange={updateForm} minLength={10} maxLength={2000} rows={4} required placeholder="Share useful details about the product" /></label>
            <button type="submit" disabled={submitting}><Send size={15} /> {submitting ? "Submitting…" : "Submit review"}</button>
          </form>
          {notice && <p className={`storefront-review-notice ${noticeType}`} role="status">{notice}</p>}
        </div>
      ) : null}

      <div className="review-list">
        {loading ? <p className="section-subtitle">Loading approved reviews…</p> : visibleReviews.map((review) => (
          <article className="review-card" key={review.id}>
            <div className="review-top">
              <strong>{review.name}</strong>
              <div className="review-rating">{review.rating}<Star size={13} fill="currentColor" /></div>
            </div>
            <Stars rating={review.rating} size={13} />
            <h3>{review.title}</h3>
            <p>{review.comment}</p>
            {review.verifiedPurchase && <span className="verified-review-badge">Verified purchase</span>}
          </article>
        ))}
        {!loading && visibleReviews.length === 0 && storefrontReviewsApiEnabled && <div className="crm-empty-state"><h3>No approved reviews yet</h3><p>Your review can be the first once the store team approves it.</p><button type="button" onClick={refreshReviews} className="crm-button crm-button-secondary crm-button-small"><RefreshCw size={13} /> Refresh</button></div>}
      </div>
    </section>
  );
}

export default ProductReviews;
