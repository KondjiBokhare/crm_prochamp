import { Star, Edit3, CheckCircle2 } from "lucide-react";

const reviews = [
  {
    id: 1,
    product: "Lenovo LOQ Gaming Laptop",
    rating: 5,
    date: "12 Sep 2026",
    title: "Excellent performance",
    review:
      "The laptop performs very well for gaming, coding and everyday work. Build quality is also good.",
    verified: true,
  },
  {
    id: 2,
    product: "ZOTAC RTX 4060 Twin Edge",
    rating: 4,
    date: "28 Aug 2026",
    title: "Great GPU for the price",
    review:
      "Very good performance and thermals. Installation was easy and the card works smoothly.",
    verified: true,
  },
  {
    id: 3,
    product: "Intel Core i5-12400F",
    rating: 4,
    date: "10 Aug 2026",
    title: "Good processor",
    review:
      "Excellent processor for a mid-range PC build. Works well for gaming and development.",
    verified: true,
  },
];

function MyReviews() {
  return (
    <div className="account-detail-page">

      <div className="account-page-header">
         

        <h1 className="account-page-title">
          My Reviews
        </h1>

        <p className="account-page-subtitle">
          View and manage your product reviews and ratings.
        </p>
      </div>

      <div className="reviews-summary account-card">
        <div className="reviews-summary-rating">
          <strong>4.6</strong>

          <div className="reviews-summary-stars">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={17}
                fill={star <= 5 ? "currentColor" : "none"}
              />
            ))}
          </div>

          <span>Average Rating</span>
        </div>

        <div className="reviews-summary-divider"></div>

        <div className="reviews-summary-stat">
          <strong>{reviews.length}</strong>
          <span>Total Reviews</span>
        </div>

        <div className="reviews-summary-stat">
          <strong>100%</strong>
          <span>Verified Purchases</span>
        </div>
      </div>

      <div className="reviews-list">

        {reviews.map((review) => (
          <article
            key={review.id}
            className="review-card account-card"
          >

            <div className="review-card-header">

              <div>
                <h2>{review.product}</h2>

                <div className="review-meta">
                  <div className="review-stars">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={15}
                        fill={
                          star <= review.rating
                            ? "currentColor"
                            : "none"
                        }
                      />
                    ))}
                  </div>

                  <span>{review.date}</span>
                </div>
              </div>

              {review.verified && (
                <span className="verified-review">
                  <CheckCircle2 size={14} />
                  Verified Purchase
                </span>
              )}

            </div>

            <div className="review-content">
              <h3>{review.title}</h3>
              <p>{review.review}</p>
            </div>

            <div className="review-card-footer">
              <button
                type="button"
                className="review-edit-button"
              >
                <Edit3 size={14} />
                Edit Review
              </button>
            </div>

          </article>
        ))}

      </div>

    </div>
  );
}

export default MyReviews;