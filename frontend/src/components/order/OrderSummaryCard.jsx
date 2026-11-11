
import { MapPin, CreditCard, Truck } from "lucide-react";

const money = (amount) =>
  `₹${(Number(amount) || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

const firstValue = (...values) => {
  const value = values.find(
    (item) =>
      item !== undefined &&
      item !== null &&
      String(item).trim() !== ""
  );

  return value !== undefined ? String(value).trim() : "";
};

function OrderSummaryCard({ order }) {
  const items = Array.isArray(order?.items) ? order.items : [];
  const address = order?.address || {};

  const recipientName = firstValue(
    address.name,
    address.full_name,
    address.fullName,
    address.recipient_name,
    order?.customerName
  );

  const addressLines = [
    firstValue(
      address.line,
      address.address_line,
      address.addressLine,
      address.address_line1,
      address.addressLine1,
      address.address1,
      address.street,
      address.street_address,
      address.streetAddress,
      address.house,
      address.house_number
    ),
    firstValue(
      address.line2,
      address.address_line2,
      address.addressLine2,
      address.address2,
      address.landmark
    ),
    firstValue(address.locality, address.area, address.area_name),
    [
      firstValue(address.city, address.town),
      firstValue(address.district),
    ]
      .filter(Boolean)
      .join(", "),
    [
      firstValue(
        address.state,
        address.state_name,
        address.province
      ),
      firstValue(
        address.pincode,
        address.pin_code,
        address.postal_code,
        address.postalCode,
        address.zip,
        address.zip_code
      ),
    ]
      .filter(Boolean)
      .join(" - "),
    firstValue(address.country, address.country_name),
  ].filter(Boolean);

  const uniqueAddressLines = [...new Set(addressLines)];

  const phone = firstValue(
    address.phone,
    address.phone_number,
    address.mobile,
    address.mobile_number
  );

  const email = firstValue(
    address.email,
    address.email_address,
    order?.customerEmail
  );

  return (
    <section className="order-summary-card">
      <div className="order-summary-header">
        <div>
          <h2>Order Details</h2>
          <p>Review your purchased products and order information.</p>
        </div>
      </div>

      <div className="confirmed-items">
        {items.map((item, index) => (
          <div
            className="confirmed-item"
            key={`${item.id}-${index}`}
          >
            <div className="confirmed-item-image">
              {item.image || item.images?.[0] ? (
                <img
                  src={item.image || item.images?.[0]}
                  alt={item.name || "Product"}
                />
              ) : (
                <div className="confirmed-no-image" aria-hidden="true">
                  No image
                </div>
              )}
            </div>

            <div className="confirmed-item-info">
              <h3>{item.name}</h3>

              {(item.specs || item.shortDescription) && (
                <p>{item.specs || item.shortDescription}</p>
              )}

              <span>Quantity: {item.quantity}</span>
              <small>Unit price: {money(item.price)}</small>
            </div>

            <strong>
              {money(
                Number(item.price) * Number(item.quantity || 1)
              )}
            </strong>
          </div>
        ))}
      </div>

      <div className="order-detail-grid">
        <div className="order-detail-box">
          <div className="order-detail-icon">
            <MapPin size={18} />
          </div>

          <div>
            <span>Delivery Address</span>

            <strong>{recipientName || "Customer"}</strong>

            {uniqueAddressLines.length > 0 ? (
              uniqueAddressLines.map((line, index) => (
                <p key={`${line}-${index}`}>{line}</p>
              ))
            ) : (
              <p>Address information is currently unavailable.</p>
            )}

            {phone && <p>Phone: {phone}</p>}
            {email && <p>Email: {email}</p>}
          </div>
        </div>

        <div className="order-detail-box">
          <div className="order-detail-icon">
            <CreditCard size={18} />
          </div>

          <div>
            <span>Payment Information</span>
            <strong>{order.paymentMethod || "Not specified"}</strong>
            <p>{order.paymentStatus || "Payment status will be updated here."}</p>
          </div>
        </div>

        <div className="order-detail-box">
          <div className="order-detail-icon">
            <Truck size={18} />
          </div>

          <div>
            <span>Order Status</span>
            <strong>{order.fulfillmentStatus || "Processing"}</strong>
            <p>Track your order for the latest status updates.</p>
          </div>
        </div>
      </div>

      <div className="confirmed-price-breakdown">
        <div>
          <span>Subtotal</span>
          <strong>{money(order.subtotal)}</strong>
        </div>

        <div>
          <span>Product Discount</span>
          <strong className="confirmed-discount">
            −{money(order.discount)}
          </strong>
        </div>

        {Number(order.couponDiscount) > 0 && (
          <div>
            <span>
              Coupon Discount
              {order.couponCode ? ` (${order.couponCode})` : ""}
            </span>

            <strong className="confirmed-discount">
              −{money(order.couponDiscount)}
            </strong>
          </div>
        )}

        <div>
          <span>Delivery Charges</span>
          <strong>
            {Number(order.delivery) === 0
              ? "FREE"
              : money(order.delivery)}
          </strong>
        </div>
      </div>

      <div className="confirmed-total">
        <span>Order Total</span>
        <strong>{money(order.total)}</strong>
      </div>

      <p className="checkout-demo-note">
        Your order has been successfully recorded. You can view
        your order status and updates from your account.
      </p>
    </section>
  );
}

export default OrderSummaryCard;
