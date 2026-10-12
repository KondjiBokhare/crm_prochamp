import { Star, Truck, ShieldCheck, RotateCcw } from "lucide-react";
import ProductActions from "./ProductActions.jsx";

function ProductInfo({ product }) {
  return (
    <div className="product-info-details">

      <span className="product-brand">
        {product.brand}
      </span>

      <h1>{product.name}</h1>

      <div className="product-meta">
        <div className="detail-rating">
          <span className="rating-box">
            {product.rating}
            <Star size={14} fill="currentColor" />
          </span>

          <span>
            {product.reviews.toLocaleString("en-IN")} Ratings & Reviews
          </span>
        </div>

        <span className="product-sku">
          SKU: {product.sku}
        </span>
      </div>

      <p className="detail-description">
        {product.shortDescription}
      </p>

      <div className="detail-price">

  <strong>
    ₹{product.price.toLocaleString("en-IN")}
  </strong>

  {product.mrp && (
    <del>
      ₹{product.mrp.toLocaleString("en-IN")}
    </del>
  )}

  {product.discount && (
    <span>
      {product.discount}% OFF
    </span>
  )}

</div>

      <div className="tax-note">
        Inclusive of applicable taxes
      </div>

      <div className="stock-status">
        <span className="stock-dot"></span>

        {product.stock > 0
          ? `In Stock (${product.stock} available)`
          : "Out of Stock"}
      </div>

      <div className="delivery-info">

        <div>
          <Truck size={19} />
          <span>
            Free delivery on eligible orders
          </span>
        </div>

        <div>
          <ShieldCheck size={19} />
          <span>
            Genuine product with manufacturer warranty
          </span>
        </div>

        <div>
          <RotateCcw size={19} />
          <span>
            Easy returns on eligible products
          </span>
        </div>

      </div>

     <ProductActions product={product} />

    </div>
  );
}

export default ProductInfo;