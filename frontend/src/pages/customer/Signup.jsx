
import {
  User,
  Mail,
  LockKeyhole,
  Eye,
  EyeOff,

} from "lucide-react";
import { useState } from "react";

import { useAuth } from "../../context/AuthContext";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthLayout from "../../components/auth/AuthLayout";

function Signup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { registerCustomerWithBackend, isStorefrontAuthEnabled } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const fullName = String(data.get("fullName") || "").trim().split(/\s+/).filter(Boolean);
    const firstName = fullName.shift() || "";
    const lastName = fullName.join(" ");
    const email = String(data.get("signupEmail") || "").trim().toLowerCase();
    const password = String(data.get("signupPassword") || "");
    const confirmPassword = String(data.get("confirmPassword") || "");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!isStorefrontAuthEnabled) {
      setError("Customer registration API is not enabled. Set VITE_STOREFRONT_AUTH_MODE=api in frontend/.env.local and restart Vite.");
      return;
    }
    setLoading(true);
    try {
      await registerCustomerWithBackend({ firstName, lastName, email, password });
      navigate("/profile", { replace: true });
    } catch (requestError) {
      setError(requestError.message || "Could not create your account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>

      <div className="auth-form-container">

        <div className="auth-form-header">
          <span className="auth-small-label">
            JOIN TECHGEAR
          </span>

          <h2>Create your account</h2>

          <p>
            Create an account to shop faster and
            manage your orders.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="crm-error-banner" role="alert">{error}</div>}

          {/* Full Name */}
          <div className="auth-field">
            <label htmlFor="fullName">
              Full name
            </label>

            <div className="auth-input-wrapper">
              <User size={18} />

              <input
                id="fullName"
                name="fullName"
                type="text"
                placeholder="Enter your full name"
                autoComplete="name"
                required
              />
            </div>
          </div>

          {/* Email */}
          <div className="auth-field">
            <label htmlFor="signupEmail">
              Email address
            </label>

            <div className="auth-input-wrapper">
              <Mail size={18} />

              <input
                id="signupEmail"
                name="signupEmail"
                type="email"
                placeholder="Enter your email"
                autoComplete="email"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div className="auth-field">
            <label htmlFor="signupPassword">
              Password
            </label>

            <div className="auth-input-wrapper">
              <LockKeyhole size={18} />

              <input
                id="signupPassword"
                name="signupPassword"
                type={
                  showPassword ? "text" : "password"
                }
                placeholder="Create a password"
                autoComplete="new-password"
                required
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowPassword((current) => !current)
                }
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
              >
                {showPassword ? (
                  <EyeOff size={18} />
                ) : (
                  <Eye size={18} />
                )}
              </button>
            </div>
          </div>

          {/* Confirm password */}
          <div className="auth-field">
            <label htmlFor="confirmPassword">
              Confirm password
            </label>

            <div className="auth-input-wrapper">
              <LockKeyhole size={18} />

              <input
                id="confirmPassword"
                name="confirmPassword"
                type={
                  showConfirmPassword
                    ? "text"
                    : "password"
                }
                placeholder="Confirm your password"
                autoComplete="new-password"
                required
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowConfirmPassword(
                    (current) => !current
                  )
                }
                aria-label={
                  showConfirmPassword
                    ? "Hide password"
                    : "Show password"
                }
              >
                {showConfirmPassword ? (
                  <EyeOff size={18} />
                ) : (
                  <Eye size={18} />
                )}
              </button>
            </div>
          </div>

          {/* Terms */}
          <label className="terms-option">
            <input type="checkbox" required />

            <span>
              I agree to the
              {" "}
              <a href="/terms">
                Terms & Conditions
              </a>
              {" "}
              and
              {" "}
              <a href="/privacy">
                Privacy Policy
              </a>.
            </span>
          </label>

          {/* Submit */}
          <button
            type="submit"
            className="auth-primary-button"
            disabled={loading}
          >
            {loading ? "Creating account…" : "Create Account"}
          </button>

        </form>

        {/* <div className="auth-divider">
          <span>OR</span>
        </div>

      <button className="google-button" type="button" disabled title="Google OAuth is not configured">
  <span className="google-g-icon">G</span>
  Google sign-up not configured
</button> */}

        <p className="auth-switch">
          Already have an account?
          {" "}
          <Link
  to="/login"
  state={{
    backgroundLocation: location.state?.backgroundLocation,
    from: location.state?.from,
  }}
>
  Sign in
</Link>
        </p>

      </div>

    </AuthLayout>
  );
}

export default Signup;