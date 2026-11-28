import { Link } from "react-router-dom";
import { Minus, Plus } from "lucide-react";

function CheckoutItems({
  items = [],
  editableQuantity = false,
  onQuantityChange,
  quantityDisabled = false,
}) {
  return (
    <section className="checkout-section">

      <div className="checkout-section-header">
        <div>
          <span className="checkout-step">2</span>

          <div>
            <h2>Order Items</h2>

            <p>
              Review your products before placing the order.
            </p>
          </div>
        </div>
      </div>

      <div className="checkout-items">

        {items.map((item) => {
          const maxQuantity = Math.min(
            Number(item.stock) || 0,
            100
          );

          return (
            <div
              className="checkout-item"
              key={item.id}
            >

              <Link
                to={`/product/${item.id}`}
                className="checkout-item-image"
              >
                <img
                  src={item.images?.[0] || item.image}
                  alt={item.name}
                />
              </Link>

              <div className="checkout-item-info">

                <h3>{item.name}</h3>

                <p>{item.specs}</p>

                {editableQuantity ? (
                  <div className="checkout-quantity-control">

                    <div className="checkout-quantity-stock">
                      {maxQuantity > 0
                        ? `${item.stock} available`
                        : "Out of stock"}
                    </div>

                    <div className="checkout-quantity-row">

                      <span>Quantity:</span>

                      <div className="checkout-quantity-selector">

                        <button
                          type="button"
                          aria-label="Decrease quantity"
                          disabled={quantityDisabled || item.quantity <= 1}
                          onClick={() =>
                            onQuantityChange?.(
                              item.quantity - 1
                            )
                          }
                        >
                          <Minus size={15} />
                        </button>

                        <strong>{item.quantity}</strong>

                        <button
                          type="button"
                          aria-label="Increase quantity"
                          disabled={
  quantityDisabled ||
  item.quantity >= maxQuantity
}
                          onClick={() =>
                            onQuantityChange?.(
                              item.quantity + 1
                            )
                          }
                        >
                          <Plus size={15} />
                        </button>

                      </div>
                    </div>
                  </div>
                ) : (
                  <span>
                    Quantity: {item.quantity}
                  </span>
                )}

              </div>

              <strong className="checkout-item-price">
                ₹{(
                  item.price * item.quantity
                ).toLocaleString("en-IN")}
              </strong>

            </div>
          );
        })}

      </div>

    </section>
  );
}

export default CheckoutItems;