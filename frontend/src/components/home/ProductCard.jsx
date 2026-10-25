import { Heart, Star } from "lucide-react";

import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useWishlist } from "../../context/WishlistContext";
import { recordWishlistChange } from "../../services/customerBehaviorService";

function ProductCard({ product }) {
  const navigate = useNavigate();
const location = useLocation();
  const { isAuthenticated } = useAuth();

  const {
    toggleWishlist,
    isWishlisted,
  } = useWishlist();

  const wishlisted = isWishlisted(product.id);

  const handleWishlistClick = () => {
    // Guest user → Login page
    if (!isAuthenticated) {
     navigate("/login", {
  state: { backgroundLocation: location },
});
      return;
    }

    // Logged-in user → Add / Remove wishlist
    toggleWishlist(product.id);
    recordWishlistChange(product, !wishlisted);
  };

  return (
    <article className="product-card">

      {/* =========================
          TOP BADGES
      ========================= */}
      <div className="product-top-row">
        {Number(product.discount) > 0 && (
  <span className="discount-badge">
    {product.discount}% OFF
  </span>
)}

        {product.badge && (
          <span className="product-badge">
            {product.badge}
          </span>
        )}
      </div>

      {/* =========================
          WISHLIST
      ========================= */}
      <button
        type="button"
        className={
          wishlisted
            ? "wishlist-button active"
            : "wishlist-button"
        }
        onClick={handleWishlistClick}
        aria-label={
          wishlisted
            ? `Remove ${product.name} from wishlist`
            : `Add ${product.name} to wishlist`
        }
      >
        <Heart
          size={19}
          fill={
            wishlisted
              ? "currentColor"
              : "none"
          }
        />
      </button>

      {/* =========================
          PRODUCT IMAGE
      ========================= */}
      <Link
        to={`/product/${product.id}`}
        className="product-image-container"
      >
        <img
          src={product.images?.[0] || product.image}
          alt={product.name}
          className="product-image"
        />
      </Link>

      {/* =========================
          PRODUCT INFORMATION
      ========================= */}
      <div className="product-info">

        {/* Product Name */}
        <Link
          to={`/product/${product.id}`}
          className="product-name"
        >
          {product.name}
        </Link>

        {/* Product Specs */}
        <p className="product-specs">
          {product.specs}
        </p>

        {/* Rating */}
        <div className="product-rating">
          <div className="stars">
            {[...Array(5)].map(
              (_, index) => (
                <Star
                  key={index}
                  size={14}
                  fill={
                    index <
                    Math.round(
                      product.rating
                    )
                      ? "#f59e0b"
                      : "none"
                  }
                  color="#f59e0b"
                />
              )
            )}
          </div>

          <span>
            {product.rating} (
            {product.reviews})
          </span>
        </div>

        {/* Price */}
        <div className="product-price">
          <strong>
            ₹
            {product.price.toLocaleString(
              "en-IN"
            )}
          </strong>

          {product.mrp && (
            <del>
              ₹
              {product.mrp.toLocaleString(
                "en-IN"
              )}
            </del>
          )}
        </div>

        {/* Shop Now */}
        <Link
          to={`/product/${product.id}`}
          className="add-cart-button"
        >
          Shop Now
        </Link>

      </div>
    </article>
  );
}

export default ProductCard;