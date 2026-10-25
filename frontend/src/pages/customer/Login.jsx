import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  Eye,
  EyeOff,
  Mail,
  LockKeyhole,
  
} from "lucide-react";
import { useState } from "react";

import AuthLayout from "../../components/auth/AuthLayout";

function Login() {

    const navigate = useNavigate();
    const location = useLocation();

const { login, loginWithCustomerBackend, isStorefrontAuthEnabled } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

 const handleSubmit = async (event) => {
  event.preventDefault();
  setError("");
  const formData = new FormData(event.currentTarget);
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (isStorefrontAuthEnabled) {
    setLoading(true);
    try {
      await loginWithCustomerBackend(email, password);
      navigate(location.state?.from || "/profile", { replace: true });
    } catch (requestError) {
      setError(requestError.message || "Could not sign in. Check your email and password.");
    } finally {
      setLoading(false);
    }
    return;
  }

  const DEMO_EMAIL = "test@test.com";
  const DEMO_PASSWORD = "123456";
  if (email !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
    setError("Invalid demo credentials. Turn on storefront API mode to use registered customer accounts.");
    return;
  }
  login({ id: 1, name: "Demo Customer", email: DEMO_EMAIL, role: "CUSTOMER" });
  navigate(location.state?.from || "/", { replace: true });
};

  return (
    <AuthLayout>

      <div className="auth-form-container">

        <div className="auth-form-header">
          <span className="auth-small-label">
            WELCOME BACK
          </span>

          <h2>Sign in to TechGear</h2>

          <p>
            Access your orders, wishlist and account.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="crm-error-banner" role="alert">{error}</div>}

          {/* Email */}
          <div className="auth-field">
            <label htmlFor="email">
              Email address
            </label>

            <div className="auth-input-wrapper">
              <Mail size={18} />

              <input
  id="email"
  name="email"
  type="email"
  placeholder="Enter your email"
  autoComplete="email"
  required
/>
            </div>
          </div>

          {/* Password */}
          <div className="auth-field">
            <div className="field-label-row">
              <label htmlFor="password">
                Password
              </label>

              <Link to="/forgot-password">
                Forgot password?
              </Link>
            </div>

            <div className="auth-input-wrapper">
              <LockKeyhole size={18} />

              <input
  id="password"
  name="password"
  type={showPassword ? "text" : "password"}
  placeholder="Enter your password"
  autoComplete="current-password"
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

          {/* Remember */}
          <div className="auth-options">
            <label className="remember-option">
              <input type="checkbox" />
              <span>Remember me</span>
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="auth-primary-button"
            disabled={loading}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>

        </form>

        {/* Divider */}
        {/* <div className="auth-divider">
          <span>OR</span>
        </div> */}

        {/* Google */}
      {/* <button className="google-button">
  <span className="google-g-icon">G</span>
  Continue with Google
</button> */}

        {/* Signup */}
        <p className="auth-switch">
          Don't have an account?
          {" "}
          <Link
  to="/signup"
  state={{
    backgroundLocation: location.state?.backgroundLocation,
    from: location.state?.from,
  }}
>
  Signup
</Link>
        </p>

        <p className="auth-switch">
          Staff member?{" "}
          <Link to="/crm/login">Sign in to CRM</Link>
        </p>

      </div>

    </AuthLayout>
  );
}

export default Login;