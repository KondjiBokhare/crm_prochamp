import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { authenticateDemoCrmUser } from "../../auth/demoUsers";
import { isApiAuthEnabled } from "../../services/authApi";
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

const { login, loginWithBackend } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

const getPostLoginPath = (role, requestedPath) => {
  const isCustomer = String(role || "").toUpperCase() === "CUSTOMER";

  const isValidRequestedPath =
    typeof requestedPath === "string" &&
    requestedPath.startsWith("/") &&
    !requestedPath.startsWith("//") &&
    !["/login", "/signup", "/crm/login"].includes(requestedPath);

  const isCrmPath =
    isValidRequestedPath && requestedPath.startsWith("/crm");

  if (isCustomer) {
    return isValidRequestedPath && !isCrmPath
      ? requestedPath
      : "/profile";
  }

  return isCrmPath ? requestedPath : "/crm";
};

const handleSubmit = async (event) => {
  event.preventDefault();
  setError("");

  const formData = new FormData(event.currentTarget);
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "");

  if (isApiAuthEnabled) {
    setLoading(true);

    try {
      const authenticatedUser = await loginWithBackend(email, password);

      navigate(
        getPostLoginPath(authenticatedUser?.role, location.state?.from),
        { replace: true }
      );
    } catch (requestError) {
      setError(
        requestError.message ||
          "Could not sign in. Check your email and password."
      );
    } finally {
      setLoading(false);
    }

    return;
  }

  // Frontend demo mode: allow demo staff accounts on the same page.
  const demoStaff = authenticateDemoCrmUser(email, password);

  if (demoStaff) {
    login(demoStaff);

    navigate(
      getPostLoginPath(demoStaff.role, location.state?.from),
      { replace: true }
    );

    return;
  }

  // Demo customer account; real production customers use the API above.
  const DEMO_EMAIL = "test@test.com";
  const DEMO_PASSWORD = "123456";

  if (email !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
    setError("Invalid email or password. Check your account details.");
    return;
  }

  const customer = {
    id: 1,
    name: "Demo Customer",
    email: DEMO_EMAIL,
    role: "CUSTOMER",
  };

  login(customer);

  navigate(
    getPostLoginPath(customer.role, location.state?.from),
    { replace: true }
  );
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

        {/* <p className="auth-switch">
          Staff member?{" "}
          <Link to="/crm/login">Sign in to CRM</Link>
        </p> */}

      </div>

    </AuthLayout>
  );
}

export default Login;