import {
  ShieldCheck,
  Truck,
  Headphones,
  Cpu,
} from "lucide-react";

function AuthBrandPanel() {
  return (
    <div className="auth-brand-panel">
      <div className="auth-brand-content">

        <div className="auth-logo">
          <div className="auth-logo-icon">▣</div>

          <div>
            <div className="auth-logo-text">
              Tech<span>Gear</span>
            </div>

            <div className="auth-logo-tagline">
              YOUR HARDWARE STORE
            </div>
          </div>
        </div>

        <div className="auth-brand-heading">
          <span>TECHGEAR</span>

          <h1>
            Build.
            <br />
            Upgrade.
            <br />
            <strong>Perform Better.</strong>
          </h1>

          <p>
            Your trusted destination for laptops,
            PC components, gaming hardware and
            accessories.
          </p>
        </div>

        <div className="auth-benefits">

          <div>
            <Cpu size={20} />
            <span>Genuine Hardware</span>
          </div>

          <div>
            <ShieldCheck size={20} />
            <span>Secure Shopping</span>
          </div>

          <div>
            <Truck size={20} />
            <span>Fast Delivery</span>
          </div>

          <div>
            <Headphones size={20} />
            <span>Expert Support</span>
          </div>

        </div>

      </div>
    </div>
  );
}

export default AuthBrandPanel;