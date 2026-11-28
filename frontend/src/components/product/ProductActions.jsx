import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingCart, Zap } from "lucide-react";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";

function ProductActions({ product }) {
  const [quantity, setQuantity] = useState(1);

  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { user, isInitializing } = useAuth();

  const inStock = Number(product.stock) > 0;

  const decreaseQuantity = () => {
    setQuantity((current) => Math.max(1, current - 1));
  };

  const increaseQuantity = () => {
    setQuantity((current) =>
      Math.min(Number(product.stock) || 1, 100, current + 1)
    );
  };

  const handleAddToCart = () => {
    if (!inStock) return;

    addToCart(
      product,
      Math.min(quantity, Number(product.stock))
    );

    alert("Product added to cart");
  };

  const handleBuyNow = () => {
    if (!inStock || isInitializing) return;

    const selectedQuantity = Math.min(
      quantity,
      Number(product.stock),
      100
    );

    const params = new URLSearchParams({
      mode: "buy_now",
      productId: String(product.id),
      quantity: String(selectedQuantity),
    });

    const checkoutPath = `/checkout?${params.toString()}`;

    if (!user) {
      navigate("/login", {
        state: { from: checkoutPath },
      });
      return;
    }

    if (user.role !== "CUSTOMER") {
      alert("Please sign in using a customer account.");
      return;
    }

    navigate(checkoutPath);
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
          disabled={
            !inStock ||
            quantity >= Math.min(Number(product.stock), 100)
          }
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
        onClick={handleBuyNow}
        disabled={!inStock || isInitializing}
      >
        <Zap size={18} />
        Buy Now
      </button>
    </div>
  );
}

export default ProductActions;