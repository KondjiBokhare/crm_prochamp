import { Link } from "react-router-dom";
import { Heart } from "lucide-react";

import ProductCard from "../../components/home/ProductCard";
import { useWishlist } from "../../context/WishlistContext";
import { useProductCatalog } from "../../services/productCatalogService";

function Wishlist() {
  const { wishlistIds } = useWishlist();
  const products = useProductCatalog();

  const wishlistProducts = products.filter((product) =>
    wishlistIds.includes(product.id)
  );

  return (
    <div className="wishlist-page-content">

      {/* Page Header */}
      <div className="account-page-header">
        

        <h1 className="account-page-title">
          My Wishlist
        </h1>

        <p className="account-page-subtitle">
          {wishlistProducts.length}{" "}
          {wishlistProducts.length === 1
            ? "product"
            : "products"}{" "}
          saved for later.
        </p>
      </div>

      {/* Empty Wishlist */}
      {wishlistProducts.length === 0 ? (
        <div className="wishlist-empty">

          <div className="wishlist-empty-icon">
            <Heart size={34} />
          </div>

          <h2>Your wishlist is empty</h2>

          <p>
            Save products you love and come back
            to them anytime.
          </p>

          <Link
            to="/products"
            className="wishlist-shop-button"
          >
            Start Shopping
          </Link>

        </div>
      ) : (
        <div className="wishlist-product-grid">

          {wishlistProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
            />
          ))}

        </div>
      )}

    </div>
  );
}

export default Wishlist;