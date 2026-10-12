import { MapPin } from "lucide-react";

function AddressSection({ address, onChange, apiMode = false }) {
  const update = (event) => onChange({ ...address, [event.target.name]: event.target.value });
  return (
    <section className="checkout-section">
      <div className="checkout-section-header">
        <div><span className="checkout-step">1</span><div><h2>Delivery Address</h2><p>{apiMode ? "Enter the address to save with your Django order record." : "Enter the address for this demo order."}</p></div></div>
      </div>
      <div className="checkout-address-form">
        <label>Full name *<input autoComplete="name" name="name" required maxLength={100} value={address.name} onChange={update} placeholder="Recipient name" /></label>
        <label>Phone number *<input autoComplete="tel" name="phone" required maxLength={25} value={address.phone} onChange={update} placeholder="Phone number" /></label>
        <label className="checkout-address-wide">Address line *<input autoComplete="street-address" name="line" required maxLength={220} value={address.line} onChange={update} placeholder="House/flat, street, area" /></label>
        <label>City, state and PIN *<input autoComplete="address-level2" name="city" required maxLength={140} value={address.city} onChange={update} placeholder="City, State - PIN" /></label>
        <label>Address type<select name="type" value={address.type || "Home"} onChange={update}><option>Home</option><option>Work</option><option>Other</option></select></label>
      </div>
      <p className="checkout-demo-note"><MapPin size={14} inline /> {apiMode ? "Address is saved with the order in Django; no courier service is connected." : "Demo only: this address stays in this browser and is not sent to a delivery service."}</p>
    </section>
  );
}

export default AddressSection;
