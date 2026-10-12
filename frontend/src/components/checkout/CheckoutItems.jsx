import { Link } from "react-router-dom";

function CheckoutItems({ items }) {
  return (
    <section className="checkout-section">
      <div className="checkout-section-header">
        <div>
          <span className="checkout-step">2</span>

          <div>
            <h2>Order Items</h2>
            <p>Review your products before placing the order.</p>
          </div>
        </div>
      </div>

      <div className="checkout-items">
        {items.map((item) => (
          <div className="checkout-item" key={item.id}>
            <Link
              to={`/product/${item.id}`}
              className="checkout-item-image"
            >
              <img src={item.images?.[0] || item.image} alt={item.name} />
            </Link>

            <div className="checkout-item-info">
              <h3>{item.name}</h3>
              <p>{item.specs}</p>

              <span>
                Quantity: {item.quantity}
              </span>
            </div>

            <strong className="checkout-item-price">
              ₹{(item.price * item.quantity).toLocaleString("en-IN")}
            </strong>
          </div>
        ))}
      </div>
    </section>
  );
}

export default CheckoutItems;