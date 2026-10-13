import { MapPin, CreditCard, Truck } from "lucide-react";

const money = (amount) => `₹${(Number(amount) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

function OrderSummaryCard({ order }) {
  const items = Array.isArray(order?.items) ? order.items : [];
  const address = order?.address || {};
  return (
    <section className="order-summary-card">
      <div className="order-summary-header"><div><h2>Order Details</h2><p>Product and totals are taken from the order created at checkout.</p></div></div>
      <div className="confirmed-items">
        {items.map((item, index) => <div className="confirmed-item" key={`${item.id}-${index}`}>
          <div className="confirmed-item-image">{(item.image || item.images?.[0]) ? <img src={item.image || item.images?.[0]} alt={item.name} /> : <div className="confirmed-no-image" aria-hidden="true">No image</div>}</div>
          <div className="confirmed-item-info"><h3>{item.name}</h3>{(item.specs || item.shortDescription) && <p>{item.specs || item.shortDescription}</p>}<span>Quantity: {item.quantity}</span><small>Unit price: {money(item.price)}</small></div>
          <strong>{money(Number(item.price) * Number(item.quantity || 1))}</strong>
        </div>)}
      </div>
      <div className="order-detail-grid">
        <div className="order-detail-box"><div className="order-detail-icon"><MapPin size={18}/></div><div><span>Delivery Address</span><strong>{address.name || "—"}</strong><p>{address.line || "—"}</p><p>{address.city || "—"}</p>{address.phone && <p>{address.phone}</p>}</div></div>
        <div className="order-detail-box"><div className="order-detail-icon"><CreditCard size={18}/></div><div><span>Selected Payment Method</span><strong>{order.paymentMethod || "—"}</strong><p>{order.paymentStatus || "Demo order; payment not processed"}</p></div></div>
        <div className="order-detail-box"><div className="order-detail-icon"><Truck size={18}/></div><div><span>Order Status</span><strong>{order.fulfillmentStatus || "Processing (demo)"}</strong><p>Estimated delivery is not booked for demo orders.</p></div></div>
      </div>
      <div className="confirmed-price-breakdown">
        <div><span>Subtotal</span><strong>{money(order.subtotal)}</strong></div>
        <div><span>Product discount</span><strong className="confirmed-discount">−{money(order.discount)}</strong></div>
        {Number(order.couponDiscount) > 0 && <div><span>Coupon {order.couponCode ? `(${order.couponCode})` : "discount"}</span><strong className="confirmed-discount">−{money(order.couponDiscount)}</strong></div>}
        <div><span>Delivery</span><strong>{Number(order.delivery) === 0 ? "FREE" : money(order.delivery)}</strong></div>
      </div>
      <div className="confirmed-total"><span>Total Payable (demo)</span><strong>{money(order.total)}</strong></div>
      <p className="checkout-demo-note">{order.demoOnly ? "This older browser demo order has been imported for CRM visibility. No payment was processed and no shipment was created." : "This order is saved in the shared CRM database. No real payment was processed and no shipment was booked because a payment gateway and courier integration are not connected yet."}</p>
    </section>
  );
}

export default OrderSummaryCard;
