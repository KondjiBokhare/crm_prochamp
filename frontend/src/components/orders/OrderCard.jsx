import { Link } from "react-router-dom";
import OrderTimeline from "./OrderTimeline";

function OrderCard({ order }) {
  return (
    <article className="order-card">
      <div className="order-card-header">
        <div>
          <h3>
            Order ID: {order.id}
          </h3>

          <p>
            Placed on {order.date} &nbsp; | &nbsp;
            {order.items.length} item
            {order.items.length > 1 ? "s" : ""}
          </p>
        </div>

        <div className="order-total">
          <span>Total Amount</span>
          <strong>
            ₹{order.total.toLocaleString("en-IN")}
          </strong>
        </div>

        <span className={`order-status ${order.statusClass}`}>
          {order.status}
        </span>

        <Link
          to={`/order-confirmation?orderId=${encodeURIComponent(order.id)}`}
          className="order-action-button"
        >
          View Details
        </Link>

        {order.action && (
          <button className={`order-action-button ${order.actionClass}`}>
            {order.action}
          </button>
        )}
      </div>

      <div className="order-card-body">
        <div className="order-products">
          {order.items.map((item) => (
            <div className="order-product" key={item.id}>
              <div className="order-product-image">
                <img src={item.image} alt={item.name} />
              </div>

              <div>
                <h4>{item.name}</h4>
                <p>{item.specs}</p>
                <strong>
                  ₹{item.price.toLocaleString("en-IN")}
                </strong>
                <span>Qty: {item.quantity}</span>
              </div>
            </div>
          ))}
        </div>

        {order.status !== "Cancelled" && (
          <div className="order-tracking">
            <OrderTimeline currentStep={order.currentStep} />

            <p className="order-delivery-message">
              {order.deliveryMessage}
            </p>
          </div>
        )}

        {order.status === "Cancelled" && (
          <div className="cancelled-order-box">
            <strong>Order Cancelled</strong>
            <p>{order.deliveryMessage}</p>
          </div>
        )}
      </div>
    </article>
  );
}

export default OrderCard;