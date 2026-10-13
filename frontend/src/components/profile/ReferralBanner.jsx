import { Gift, ArrowRight } from "lucide-react";

function ReferralBanner() {
  return (
    <section className="referral-banner">
      <div className="referral-icon">
        <Gift size={27} />
      </div>

      <div className="referral-content">
        <h3>Refer & Earn</h3>

        <p>
          Share TechGear with your friends and earn
          rewards.
        </p>
      </div>

      <button className="referral-button">
        Get Referral Link
        <ArrowRight size={16} />
      </button>
    </section>
  );
}

export default ReferralBanner;