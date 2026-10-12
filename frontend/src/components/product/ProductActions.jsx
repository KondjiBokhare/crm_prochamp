import { useState } from "react";
import { ShoppingCart, Zap } from "lucide-react";
import { useCart } from "../../context/CartContext";

function ProductActions({ product }) {
  const [quantity, setQuantity] = useState(1);
  const inStock = Number(product.stock) > 0;
  const { addToCart } = useCart();

  const decreaseQuantity = () => {
    setQuantity((current) => Math.max(1, current - 1));
  };

  const increaseQuantity = () => {
    setQuantity((current) =>
      Math.min(Number(product.stock) || 1, current + 1)
    );
  };

  const handleAddToCart = () => {
    if (!inStock) return;
    addToCart(product, Math.min(quantity, Number(product.stock)));
    alert("Product added to cart");
  };

  return (
    <div className="product-actions">

      <div className="quantity-selector">
        <button
          type="button"
          onClick={decreaseQuantity}
          disabled={!inStock || quantity <= 1}
          aria-label="Decrease quantity"
        >
          −
        </button>

        <span>{quantity}</span>

        <button
          type="button"
          onClick={increaseQuantity}
          disabled={!inStock || quantity >= Number(product.stock)}
          aria-label="Increase quantity"
        >
          +
        </button>
      </div>

      <button
        type="button"
        className="detail-cart-button"
        onClick={handleAddToCart}
        disabled={!inStock}
      >
        <ShoppingCart size={18} />
        Add to Cart
      </button>

      <button
        type="button"
        className="buy-now-button"
        disabled={!inStock}
      >
        <Zap size={18} />
        Buy Now
      </button>

    </div>
  );
}

export default ProductActions;