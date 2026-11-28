import { useRef, useState } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { createDemoOrder } from "../../services/demoOrderService";
import { recordDemoPurchase } from "../../services/customerBehaviorService";
import { calculateCartTotals } from "../../utils/pricing";

import {
  getAppliedStorefrontCoupon,
  getCartSignature,
  validateDirectCheckoutCoupon,
} from "../../services/storefrontCouponApiService";

import {
  createStorefrontOrder,
  storefrontOrdersApiEnabled,
} from "../../services/storefrontOrderApiService";

function CheckoutSummary({
  cartItems = [],
  address,
  paymentMethod,
  customerEmail = "",
  authenticatedRequest,
  checkoutMode = "cart",
  onBusyChange,
}) {
  const navigate = useNavigate();

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const placedRef = useRef(false);
  const couponRequestRef = useRef(false);

  const [couponInput, setCouponInput] = useState("");
  const [directCoupon, setDirectCoupon] = useState(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState("");

  const isBuyNow = checkoutMode === "buy_now";
  const cartSignature = getCartSignature(cartItems);

  const couponCandidate = isBuyNow
    ? directCoupon
    : getAppliedStorefrontCoupon();

  const appliedCoupon =
    couponCandidate?.cartSignature === cartSignature
      ? couponCandidate
      : null;

  const {
    subtotal,
    discount,
    couponDiscount,
    delivery,
    total,
  } = calculateCartTotals(
    cartItems,
    appliedCoupon?.discountAmount || 0
  );

  const applyCoupon = async () => {
    if (couponRequestRef.current || placedRef.current) return;

    if (!couponInput.trim()) {
      setCouponError("Enter a coupon code.");
      return;
    }

    couponRequestRef.current = true;

    setCouponBusy(true);
    setCouponError("");
    setDirectCoupon(null);

    onBusyChange?.(true);

    try {
      const result = await validateDirectCheckoutCoupon(
        couponInput,
        cartItems,
        authenticatedRequest
      );

      setDirectCoupon(result);
      setCouponInput(result.code);
    } catch (err) {
      setCouponError(
        err.message || "Could not validate coupon."
      );
    } finally {
      couponRequestRef.current = false;
      setCouponBusy(false);
      onBusyChange?.(false);
    }
  };

  const removeCoupon = () => {
    if (couponBusy || saving) return;

    setDirectCoupon(null);
    setCouponInput("");
    setCouponError("");
  };

  const handlePlaceOrder = async () => {
    if (placedRef.current || couponRequestRef.current) return;

    setError("");

    if (!cartItems.length) {
      setError("No products selected for checkout.");
      return;
    }

    if (
      !String(address?.name || "").trim() ||
      !String(address?.phone || "").trim() ||
      !String(address?.line || "").trim() ||
      !String(address?.city || "").trim()
    ) {
      setError(
        "Please complete all required delivery address fields."
      );
      return;
    }

    placedRef.current = true;
    setSaving(true);
    onBusyChange?.(true);

    try {
      const order = storefrontOrdersApiEnabled
        ? await createStorefrontOrder(
            {
              items: cartItems,
              address,
              paymentMethod,
              customerEmail,
              appliedCoupon,
            },
            authenticatedRequest
          )
        : createDemoOrder({
            items: cartItems,
            address,
            paymentMethod,
            customerEmail,
            appliedCoupon,
          });

      try {
        recordDemoPurchase(
          cartItems,
          order.total,
          order.id
        );
      } catch {
        // Analytics failure must not invalidate a saved order.
      }

      navigate(
        `/order-confirmation?orderId=${encodeURIComponent(order.id)}`,
        {
          replace: true,
          state: {
            clearCartAfterOrder: isBuyNow
              ? null
              : String(order.id),
          },
        }
      );
    } catch (err) {
      placedRef.current = false;

      setError(
        err.message || "Could not create the order."
      );
    } finally {
      setSaving(false);
      onBusyChange?.(false);
    }
  };

  return (
    <aside className="checkout-summary">

      <h2>Order Summary</h2>

      {isBuyNow && (
        <div className="checkout-coupon-box">

          <label htmlFor="direct-checkout-coupon">
            Coupon code
          </label>

          <div className="checkout-coupon-row">

            <input
              id="direct-checkout-coupon"
              type="text"
              placeholder="e.g. TECH10"
              value={couponInput}
              maxLength={32}
              disabled={
                couponBusy ||
                saving ||
                Boolean(appliedCoupon)
              }
              onChange={(event) => {
                setCouponInput(
                  event.target.value.toUpperCase()
                );
                setCouponError("");
                setDirectCoupon(null);
              }}
            />

            {appliedCoupon ? (
              <button
                type="button"
                disabled={saving}
                onClick={removeCoupon}
              >
                Remove
              </button>
            ) : (
              <button
                type="button"
                onClick={applyCoupon}
                disabled={
                  couponBusy ||
                  saving ||
                  !couponInput.trim()
                }
              >
                {couponBusy ? "Checking..." : "Apply"}
              </button>
            )}

          </div>

          {couponError && (
            <p
              className="checkout-coupon-error"
              role="alert"
            >
              {couponError}
            </p>
          )}

          {appliedCoupon && (
            <p className="checkout-coupon-success" role="status">
              {appliedCoupon.code} applied successfully.
            </p>
          )}

          {directCoupon && !appliedCoupon && (
            <p className="checkout-coupon-notice">
              Quantity changed. Apply your coupon again.
            </p>
          )}

        </div>
      )}

      <div className="summary-row">
        <span>Subtotal (before discount)</span>
        <strong>₹{subtotal.toLocaleString("en-IN")}</strong>
      </div>

      <div className="summary-row">
        <span>Product discount</span>
        <strong className="summary-discount">
          −₹{discount.toLocaleString("en-IN")}
        </strong>
      </div>

      {couponDiscount > 0 && (
        <div className="summary-row">
          <span>
            Coupon ({appliedCoupon?.code})
          </span>

          <strong className="summary-discount">
            −₹{couponDiscount.toLocaleString("en-IN", {
              maximumFractionDigits: 2,
            })}
          </strong>
        </div>
      )}

      <div className="summary-row">
        <span>Delivery</span>
        <strong>
          {delivery === 0
            ? "FREE"
            : `₹${delivery.toLocaleString("en-IN")}`}
        </strong>
      </div>

      <div className="summary-divider" />

      <div className="summary-total">
        <span>Total Payable</span>
        <strong>
          ₹{total.toLocaleString("en-IN", {
            maximumFractionDigits: 2,
          })}
        </strong>
      </div>

      {error && (
        <div
          className="crm-error-banner checkout-inline-error"
          role="alert"
        >
          {error}
        </div>
      )}

      <button
        type="button"
        className="place-order-button"
        onClick={handlePlaceOrder}
        disabled={
          saving ||
          couponBusy ||
          !cartItems.length ||
          Boolean(isBuyNow && directCoupon && !appliedCoupon)
        }
      >
        {saving
          ? "Placing order…"
          : storefrontOrdersApiEnabled
            ? "Place Order"
            : "Place Demo Order"}
      </button>

      <p className="checkout-demo-note">
        Your order will be recorded in the CRM in API mode.
        No real payment is processed and no delivery is
        booked yet.
      </p>

      <div className="checkout-security">
        <ShieldCheck size={17} />
        <span>Order details are shown for demonstration.</span>
      </div>

      <div className="checkout-security">
        <LockKeyhole size={17} />
        <span>Do not enter real payment credentials.</span>
      </div>

    </aside>
  );
}

export default CheckoutSummary;