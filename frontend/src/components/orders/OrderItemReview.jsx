import { useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, Send, Star } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { submitStorefrontProductReview } from "../../services/storefrontCommerceApiService";
import {
  getReviewProductId,
  isProductReviewSubmitted,
  markProductReviewSubmitted,
  markReviewReminderRead,
} from "../../services/customerReviewUiService";

function OrderItemReview({ order, item }) {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const productId = getReviewProductId(item);
  const orderId = String(order.orderNumber || order.id || "");
  const status = String(order.status || order.fulfillmentStatus || "").toLowerCase();
  const eligible = status.includes("ship") || status.includes("deliver");
  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState("info");
  const [submitted, setSubmitted] = useState(() => isProductReviewSubmitted(user, productId));
  const [form, setForm] = useState(() => ({
    reviewerName: String(user?.name || user?.fullName || user?.full_name || ""),
    rating: 5,
    title: "",
    comment: "",
  }));

  useEffect(() => {
    setSubmitted(isProductReviewSubmitted(user, productId));
  }, [user?.email, user?.id, productId]);

  useEffect(() => {
    if (!form.reviewerName && (user?.name || user?.fullName || user?.full_name)) {
      setForm((current) => ({ ...current, reviewerName: String(user.name || user.fullName || user.full_name) }));
    }
  }, [user?.name, user?.fullName, user?.full_name, form.reviewerName]);

  useEffect(() => {
    const targetOrderId = searchParams.get("reviewOrder");
    const targetProductId = searchParams.get("productId");
    if (
      eligible && !submitted && productId &&
      targetOrderId === orderId && targetProductId === String(productId)
    ) setIsOpen(true);
  }, [eligible, submitted, productId, orderId, searchParams]);

  if (["cancelled", "returned", "refunded"].some((word) => status.includes(word))) return null;

  if (!eligible) {
    return (
      <p className="order-review-locked">
        Review option unlocks once this item has shipped.
      </p>
    );
  }

  if (!productId) {
    return <p className="order-review-locked">Review will be available once product details are synced to this order.</p>;
  }

  if (submitted) {
    return (
      <div className="order-review-submitted" role="status">
        <CheckCircle2 size={16} />
        <span><strong>Review submitted</strong><small>It will appear on the product page after moderation.</small></span>
      </div>
    );
  }

  const updateForm = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: name === "rating" ? Number(value) : value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!productId || submitting) return;
    setSubmitting(true);
    setNotice("");
    try {
      await submitStorefrontProductReview(productId, form);
      markProductReviewSubmitted(user, productId, orderId);
      markReviewReminderRead(user, orderId, productId);
      setSubmitted(true);
      setNotice("Your review has been submitted and is awaiting moderation.");
      setNoticeType("success");
      setIsOpen(false);
    } catch (error) {
      setNotice(error?.message || "We could not submit your review. Please try again.");
      setNoticeType("error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="order-review-box">
      <button
        type="button"
        className="order-review-toggle"
        aria-expanded={isOpen}
        aria-controls={`order-review-${encodeURIComponent(orderId)}-${productId}`}
        onClick={() => setIsOpen((current) => !current)}
      >
        <Star size={15} /> Write a review <ChevronDown size={15} className={isOpen ? "is-open" : ""} />
      </button>

      {isOpen && (
        <div className="order-review-panel" id={`order-review-${encodeURIComponent(orderId)}-${productId}`}>
          <div className="order-review-panel-heading">
            <h5>Review {item.name || "this product"}</h5>
            <p>Your feedback helps other customers make an informed choice.</p>
          </div>
          <form className="storefront-review-form" onSubmit={handleSubmit}>
            <label>
              <span>Your display name</span>
              <input name="reviewerName" value={form.reviewerName} onChange={updateForm} minLength={2} maxLength={100} required placeholder="e.g. Rahul S." />
            </label>
            <label>
              <span>Rating</span>
              <select name="rating" value={form.rating} onChange={updateForm}>
                {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} star{value === 1 ? "" : "s"}</option>)}
              </select>
            </label>
            <label className="storefront-review-form-wide">
              <span>Review title</span>
              <input name="title" value={form.title} onChange={updateForm} minLength={3} maxLength={120} required placeholder="Summarise your experience" />
            </label>
            <label className="storefront-review-form-wide">
              <span>Your review</span>
              <textarea name="comment" value={form.comment} onChange={updateForm} minLength={10} maxLength={2000} rows={4} required placeholder="Share useful details about the product" />
            </label>
            <button type="submit" disabled={submitting}><Send size={15} /> {submitting ? "Submitting…" : "Submit review"}</button>
          </form>
          {notice && <p className={`storefront-review-notice ${noticeType}`} role="status">{notice}</p>}
          <p className="order-review-moderation-note">Reviews appear publicly after the store team approves them.</p>
        </div>
      )}
      {notice && noticeType === "error" && !isOpen && <p className="storefront-review-notice error" role="alert">{notice}</p>}
    </div>
  );
}

export default OrderItemReview;
