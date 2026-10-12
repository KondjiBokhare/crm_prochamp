import { ShieldCheck, Truck } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";

function CartSummary({
  subtotal,
  discount,
  delivery,
  couponDiscount = 0,
  appliedCouponCode = "",
  couponInput = "",
  onCouponInputChange = () => {},
  onApplyCoupon = () => {},
  onRemoveCoupon = () => {},
  couponBusy = false,
  couponError = "",
  couponNotice = "",
  couponEnabled = false,
}) {
  const navigate = useNavigate();

  const { isAuthenticated } = useAuth();

  const total = subtotal - discount - couponDiscount + delivery;

  const handleCheckout = () => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    navigate("/checkout");
  };

  return (
    <aside className="cart-summary">

      <h2>Order Summary</h2>

      {couponEnabled && <form className="cart-coupon-form" onSubmit={(event) => { event.preventDefault(); onApplyCoupon(); }}>
        <label htmlFor="cart-coupon-code">Coupon code</label>
        <div className="cart-coupon-controls"><input id="cart-coupon-code" value={couponInput} onChange={(event) => onCouponInputChange(event.target.value)} maxLength={32} placeholder="e.g. TECH10" disabled={couponBusy}/><button type="submit" disabled={couponBusy || !couponInput.trim()}>{couponBusy ? "Checking…" : appliedCouponCode ? "Apply again" : "Apply"}</button></div>
        {appliedCouponCode && <div className="cart-coupon-applied"><span><strong>{appliedCouponCode}</strong> · −₹{Number(couponDiscount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span><button type="button" onClick={onRemoveCoupon}>Remove</button></div>}
        {couponError && <p className="cart-coupon-error" role="alert">{couponError}</p>}
        {couponNotice && <p className="cart-coupon-notice" role="status">{couponNotice}</p>}
      </form>}

      <div className="summary-row">
        <span>Subtotal</span>

        <strong>
          ₹{subtotal.toLocaleString("en-IN")}
        </strong>
      </div>

      <div className="summary-row discount-row">
        <span>Product discount</span>

        <strong>
          -₹{discount.toLocaleString("en-IN")}
        </strong>
      </div>

      {couponDiscount > 0 && <div className="summary-row discount-row"><span>Coupon discount</span><strong>−₹{Number(couponDiscount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong></div>}

      <div className="summary-row">
        <span>Delivery</span>

        <strong>
          {delivery === 0
            ? "FREE"
            : `₹${delivery.toLocaleString("en-IN")}`}
        </strong>
      </div>

      <div className="summary-divider"></div>

      <div className="summary-total">
        <span>Total</span>

        <strong>
          ₹{total.toLocaleString("en-IN")}
        </strong>
      </div>

      <button
        type="button"
        className="checkout-button"
        onClick={handleCheckout}
      >
        Proceed to Checkout
      </button>

      <div className="cart-trust-item">
        <ShieldCheck size={17} />
        <span>
          Secure and protected payment
        </span>
      </div>

      <div className="cart-trust-item">
        <Truck size={17} />
        <span>
          Fast and reliable delivery
        </span>
      </div>

    </aside>
  );
}

export default CartSummary;