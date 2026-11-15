
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { MailCheck } from "lucide-react";

import AuthLayout from "../../components/auth/AuthLayout";
import { resendVerificationEmail } from "../../services/authApi";

const STORAGE_KEY = "techgear_pending_verification_email";

function getSavedEmail(locationEmail) {
  if (locationEmail) return locationEmail;

  try {
    return window.sessionStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function CheckYourEmail() {
  const location = useLocation();

  const [email, setEmail] = useState(
    () => getSavedEmail(location.state?.email)
  );

  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const handleResend = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setStatus("Please enter your registered email address.");
      return;
    }

    setLoading(true);
    setStatus("Sending verification email...");

    try {
      try {
        window.sessionStorage.setItem(
          STORAGE_KEY,
          normalizedEmail
        );
      } catch {
        // Resending can still work without session storage.
      }

      await resendVerificationEmail(normalizedEmail);

      setStatus(
        "If that account needs verification, a new link is on its way."
      );
    } catch (error) {
      setStatus(
        error.message || "Could not resend the email. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="auth-form-container">
        <div className="auth-form-header">
          <MailCheck size={40} />

          <h2>Check your email</h2>

          <p>
            {email
              ? `We sent a verification link to ${email}. Open it to activate your account, then sign in.`
              : "Enter the email address you used to create your account. We will send a new verification link if the account needs verification."}
          </p>
        </div>

        <div className="auth-field">
          <label htmlFor="verificationEmail">
            Registered email address
          </label>

          <div className="auth-input-wrapper">
            <input
              id="verificationEmail"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter your registered email"
              autoComplete="email"
              required
            />
          </div>
        </div>

        <button
          type="button"
          className="auth-primary-button"
          onClick={handleResend}
          disabled={loading || !email.trim()}
        >
          {loading
            ? "Sending..."
            : "Resend verification email"}
        </button>

        {status && (
          <p className="auth-switch" role="status">
            {status}
          </p>
        )}

        <p className="auth-switch">
          <Link to="/login">Back to sign in</Link>
        </p>
      </div>
    </AuthLayout>
  );
}

export default CheckYourEmail;
