import { CreditCard, Smartphone, WalletCards } from "lucide-react";

const paymentMethods = [
  { id: "upi", value: "UPI", label: "UPI", description: "Google Pay, PhonePe, Paytm and more", icon: Smartphone },
  { id: "card", value: "Credit / Debit Card", label: "Credit / Debit Card", description: "Demo selection only; no card data is collected", icon: CreditCard },
  { id: "cod", value: "Cash on Delivery", label: "Cash on Delivery", description: "Demo selection; no courier is booked", icon: WalletCards },
];

function PaymentSection({ selectedMethod = "UPI", onChange }) {
  return (
    <section className="checkout-section">
      <div className="checkout-section-header"><div><span className="checkout-step">3</span><div><h2>Payment Method</h2><p>Choose a demo payment method. No real payment is taken.</p></div></div></div>
      <div className="payment-methods">
        {paymentMethods.map(({ value, label, description, icon: Icon }) => <button type="button" key={value} aria-pressed={selectedMethod === value} className={`payment-method ${selectedMethod === value ? "selected" : ""}`} onClick={() => onChange(value)}>
          <span className="payment-radio"><span className={selectedMethod === value ? "payment-radio-dot" : ""}/></span>
          <span className="payment-icon"><Icon size={20}/></span>
          <span className="payment-text"><strong>{label}</strong><small>{description}</small></span>
        </button>)}
      </div>
    </section>
  );
}

export default PaymentSection;
