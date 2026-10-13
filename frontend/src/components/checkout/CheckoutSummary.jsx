import { useRef, useState } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createDemoOrder } from "../../services/demoOrderService";
import { recordDemoPurchase } from "../../services/customerBehaviorService";
import { calculateCartTotals } from "../../utils/pricing";
import { getAppliedStorefrontCoupon } from "../../services/storefrontCouponApiService";
import { createStorefrontOrder, storefrontOrdersApiEnabled } from "../../services/storefrontOrderApiService";

function CheckoutSummary({ cartItems = [], address, paymentMethod, customerEmail = "", authenticatedRequest }) {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const placedRef = useRef(false);
  const appliedCoupon = getAppliedStorefrontCoupon();
  const { subtotal, discount, couponDiscount, delivery, total } = calculateCartTotals(cartItems, appliedCoupon?.discountAmount || 0);

  const handlePlaceOrder = async () => {
    if (placedRef.current) return;
    setError("");
    if (!cartItems.length) { setError("Your cart is empty."); return; }
    if (!String(address?.name || "").trim() || !String(address?.phone || "").trim() || !String(address?.line || "").trim() || !String(address?.city || "").trim()) {
      setError("Please complete all required delivery address fields.");
      return;
    }
    placedRef.current = true;
    setSaving(true);
    try {
      const order = storefrontOrdersApiEnabled
        ? await createStorefrontOrder({ items: cartItems, address, paymentMethod, customerEmail, appliedCoupon }, authenticatedRequest)
        : createDemoOrder({ items: cartItems, address, paymentMethod, customerEmail, appliedCoupon });
      recordDemoPurchase(cartItems, order.total, order.id);
      // Keep the cart intact until the confirmation route has loaded the saved order.
      // Clearing here allowed Checkout's empty-cart redirect to beat navigation.
      navigate(`/order-confirmation?orderId=${encodeURIComponent(order.id)}`, { replace: true });
    } catch (err) {
      placedRef.current = false;
      setError(err.message || (storefrontOrdersApiEnabled ? "Could not create the order in Django." : "Could not create the demo order."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside className="checkout-summary">
      <h2>Order Summary</h2>
      <div className="summary-row"><span>Subtotal (before discount)</span><strong>₹{subtotal.toLocaleString("en-IN")}</strong></div>
      <div className="summary-row"><span>Product discount</span><strong className="summary-discount">−₹{discount.toLocaleString("en-IN")}</strong></div>
      {couponDiscount > 0 && <div className="summary-row"><span>Coupon ({appliedCoupon?.code || "Applied"})</span><strong className="summary-discount">−₹{couponDiscount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong></div>}
      <div className="summary-row"><span>Delivery</span><strong>{delivery === 0 ? "FREE" : `₹${delivery.toLocaleString("en-IN")}`}</strong></div>
      <div className="summary-divider"/>
      <div className="summary-total"><span>Total Payable</span><strong>₹{total.toLocaleString("en-IN")}</strong></div>
      {error && <div className="crm-error-banner checkout-inline-error" role="alert">{error}</div>}
      <button type="button" className="place-order-button" onClick={handlePlaceOrder} disabled={saving || placedRef.current}>{saving ? "Placing order…" : storefrontOrdersApiEnabled ? "Place Order" : "Place Demo Order"}</button>
      <p className="checkout-demo-note">{storefrontOrdersApiEnabled ? "Your order will be saved to the CRM. No real payment is processed and no delivery is booked yet." : "Demo checkout only. No real payment is processed and no delivery is booked."}</p>
      <div className="checkout-security"><ShieldCheck size={17}/><span>Order details are shown for demonstration.</span></div>
      <div className="checkout-security"><LockKeyhole size={17}/><span>Do not enter real payment credentials.</span></div>
    </aside>
  );
}

export default CheckoutSummary;
