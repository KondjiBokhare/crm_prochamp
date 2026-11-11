
import { useEffect, useState } from "react";
import { Star, CheckCircle2, MessageSquare, RefreshCw } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getStorefrontCustomerReviews } from "../../services/storefrontCommerceApiService";

const formatDate = (value) => {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const REVIEW_STATUS = {
  PENDING: "Awaiting Approval",
  APPROVED: "Published",
  REJECTED: "Not Approved",
};

function MyReviews() {
  const { user, authenticatedRequest } = useAuth();

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    const loadReviews = async () => {
      if (typeof authenticatedRequest !== "function") {
        setReviews([]);
        setError("Please sign in to view your reviews.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const result = await getStorefrontCustomerReviews(
          authenticatedRequest
        );

        if (active) {
          setReviews(Array.isArray(result) ? result : []);
        }
      } catch (err) {
        if (active) {
          setError(
            err?.message ||
              "Unable to load your reviews. Please try again."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadReviews();

    return () => {
      active = false;
    };
  }, [authenticatedRequest, user?.email, user?.id, reloadKey]);

  const totalReviews = reviews.length;

  const averageRating = totalReviews
    ? (
        reviews.reduce(
          (sum, review) => sum + (Number(review.rating) || 0),
          0
        ) / totalReviews
      ).toFixed(1)
    : "0.0";

  const verifiedCount = reviews.filter(
    (review) => review.verifiedPurchase
  ).length;

  const verifiedPercentage = totalReviews
    ? Math.round((verifiedCount / totalReviews) * 100)
    : 0;

  return (
    <div className="account-detail-page">
      <div className="account-page-header">
        <h1 className="account-page-title">
          My Reviews
        </h1>

        <p className="account-page-subtitle">
          View your submitted product reviews and ratings.
        </p>
      </div>

      {/* Actual customer review summary */}
      <div className="reviews-summary account-card">
        <div className="reviews-summary-rating">
          <strong>{averageRating}</strong>

          <div className="reviews-summary-stars">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={17}
                fill={
                  star <= Math.round(Number(averageRating))
                    ? "currentColor"
                    : "none"
                }
              />
            ))}
          </div>

          <span>Average Rating</span>
        </div>

        <div className="reviews-summary-divider" />

        <div className="reviews-summary-stat">
          <strong>{totalReviews}</strong>
          <span>Total Reviews</span>
        </div>

        <div className="reviews-summary-stat">
          <strong>{verifiedPercentage}%</strong>
          <span>Verified Purchases</span>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="account-card" style={{ padding: "30px", textAlign: "center" }}>
          <RefreshCw size={24} className="spin" />
          <p>Loading your reviews...</p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="account-card" style={{ padding: "25px", textAlign: "center" }}>
          <p>{error}</p>

          <button
            type="button"
            className="review-edit-button"
            onClick={() => setReloadKey((current) => current + 1)}
          >
            <RefreshCw size={15} />
            Try Again
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && reviews.length === 0 && (
        <div className="account-card" style={{ padding: "40px 20px", textAlign: "center" }}>
          <MessageSquare
            size={38}
            style={{ color: "#82936c", marginBottom: "12px" }}
          />

          <h2>No Reviews Yet</h2>

          <p>
            Your submitted product reviews will appear here.
            Once you receive an eligible order, you can share
            your experience with other customers.
          </p>
        </div>
      )}

      {/* Actual customer reviews */}
      {!loading && !error && reviews.length > 0 && (
        <div className="reviews-list">
          {reviews.map((review) => {
            const status = String(
              review.status || "PENDING"
            ).toUpperCase();

            return (
              <article
                key={review.id}
                className="review-card account-card"
              >
                <div className="review-card-header">
                  <div>
                    <h2>
                      {review.product_name || "Product"}
                    </h2>

                    <div className="review-meta">
                      <div className="review-stars">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            size={15}
                            fill={
                              star <= Number(review.rating)
                                ? "currentColor"
                                : "none"
                            }
                          />
                        ))}
                      </div>

                      <span>{formatDate(review.createdAt)}</span>
                    </div>

                    {review.order_number && (
                      <small>
                        Order: {review.order_number}
                      </small>
                    )}
                  </div>

                  {review.verifiedPurchase && (
                    <span className="verified-review">
                      <CheckCircle2 size={14} />
                      Verified Purchase
                    </span>
                  )}
                </div>

                <div className="review-content">
                  <h3>{review.title}</h3>
                  <p>{review.comment}</p>
                </div>

                <div className="review-card-footer">
                  <span className={`review-status-pill review-status-${status.toLowerCase()}`}>
                    {REVIEW_STATUS[status] || status}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MyReviews;
