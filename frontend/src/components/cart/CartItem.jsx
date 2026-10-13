import {
  Heart,
  Trash2,
  Minus,
  Plus,
} from "lucide-react";

import { useCart } from "../../context/CartContext";
import { useWishlist } from "../../context/WishlistContext";

function CartItem({ item, onRemove }) {
  const { updateQuantity } = useCart();

  const { addToWishlist } = useWishlist();

  const decreaseQuantity = () => {
    updateQuantity(
      item.id,
      Math.max(1, item.quantity - 1)
    );
  };

  const increaseQuantity = () => {
    updateQuantity(
      item.id,
      item.quantity + 1
    );
  };

  const handleMoveToWishlist = () => {
    // Add product to wishlist
    addToWishlist(item.id);

    // Remove product from cart
    onRemove(item.id);
  };

  const itemTotal =
    item.price * item.quantity;

  return (
    <article className="cart-item">

      {/* =========================
          PRODUCT IMAGE
      ========================= */}
      <div className="cart-item-image">
        <img
          src={item.image}
          alt={item.name}
        />
      </div>


      {/* =========================
          PRODUCT INFO
      ========================= */}
      <div className="cart-item-details">

        <h3>
          {item.name}
        </h3>

        <p>
          {item.specs}
        </p>

        <span className="cart-stock">
          In Stock
        </span>

        <div className="cart-item-actions">

          {/* Move to Wishlist */}
          <button
            className="cart-wishlist-button"
            type="button"
            onClick={handleMoveToWishlist}
          >
            <Heart size={16} />

            Move to Wishlist
          </button>

          {/* Remove */}
          <button
            className="cart-remove-button"
            type="button"
            onClick={() =>
              onRemove(item.id)
            }
          >
            <Trash2 size={16} />

            Remove
          </button>

        </div>

      </div>


      {/* =========================
          PRICE + QUANTITY
      ========================= */}
      <div className="cart-item-purchase">

        <div className="cart-item-price">

          <strong>
            ₹
            {item.price.toLocaleString(
              "en-IN"
            )}
          </strong>

          {item.mrp && (
            <del>
              ₹
              {item.mrp.toLocaleString(
                "en-IN"
              )}
            </del>
          )}

        </div>


        {/* Quantity */}
        <div className="cart-quantity">

          <button
            type="button"
            onClick={decreaseQuantity}
            disabled={item.quantity <= 1}
            aria-label="Decrease quantity"
          >
            <Minus size={15} />
          </button>

          <span>
            {item.quantity}
          </span>

          <button
            type="button"
            onClick={increaseQuantity}
            disabled={
              item.quantity >=
              (item.stock || 99)
            }
            aria-label="Increase quantity"
          >
            <Plus size={15} />
          </button>

        </div>


        {/* Item total */}
        <strong className="cart-total-price">
          ₹
          {itemTotal.toLocaleString(
            "en-IN"
          )}
        </strong>

      </div>

    </article>
  );
}

export default CartItem;