import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { MailCheck } from "lucide-react";

import AuthLayout from "../../components/auth/AuthLayout";
import { resendVerificationEmail } from "../../services/authApi";

function CheckYourEmail() {
  const location = useLocation();
  const email = location.state?.email || "";
  const [status, setStatus] = useState("");

  const handleResend = async () => {
    setStatus("Sending…");
    try {
      await resendVerificationEmail(email);
      setStatus("If that account needs verification, a new link is on its way.");
    } catch {
      setStatus("Could not resend the email. Please try again shortly.");
    }
  };

  return (
    <AuthLayout>
      <div className="auth-form-container">
        <div className="auth-form-header">
          <MailCheck size={40} />
          <h2>Check your email</h2>
          <p>
            We sent a verification link to {email ? <strong>{email}</strong> : "your email address"}.
            Open it to activate your account, then sign in.
          </p>
        </div>

        <button type="button" className="auth-primary-button" onClick={handleResend}>
          Resend verification email
        </button>

        {status && <p className="auth-switch">{status}</p>}

        <p className="auth-switch">
          <Link to="/login">Back to sign in</Link>
        </p>
      </div>
    </AuthLayout>
  );
}

export default CheckYourEmail;
