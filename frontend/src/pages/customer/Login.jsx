
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { authenticateDemoCrmUser } from "../../auth/demoUsers";
import { isApiAuthEnabled } from "../../services/authApi";
import { getPermittedCrmPath } from "../../services/staffUserService";
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

  // Shared authentication for both Customer and CRM Staff.
  const { login, loginWithBackend } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const getPostLoginPath = (authenticatedUser, requestedPath) => {
    const role = String(authenticatedUser?.role || "")
      .trim()
      .toUpperCase();

    const isCustomer = role === "CUSTOMER";

    const isValidRequestedPath =
      typeof requestedPath === "string" &&
      requestedPath.startsWith("/") &&
      !requestedPath.startsWith("//") &&
      !["/login", "/signup", "/crm/login"].includes(
        requestedPath
      );

    const isCrmPath =
      isValidRequestedPath &&
      (requestedPath === "/crm" ||
        requestedPath.startsWith("/crm/"));

    // Storefront customers.
    if (isCustomer) {
      return isValidRequestedPath && !isCrmPath
        ? requestedPath
        : "/profile";
    }

    // All non-customer accounts are directed according
    // to their actual assigned CRM page permissions.
    return getPermittedCrmPath(
      authenticatedUser,
      isCrmPath ? requestedPath : ""
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(event.currentTarget);

    const email = String(formData.get("email") || "")
      .trim()
      .toLowerCase();

    const password = String(formData.get("password") || "");

    try {
      let authenticatedUser;

      if (isApiAuthEnabled) {
        // One Django login endpoint for EVERY account.
        authenticatedUser = await loginWithBackend(
          email,
          password
        );
      } else {
        // Local demo mode.
        const demoStaff = authenticateDemoCrmUser(
          email,
          password
        );

        if (demoStaff) {
          authenticatedUser = login(demoStaff);
        } else {
          const demoCustomerEmail = "test@test.com";
          const demoCustomerPassword = "123456";

          if (
            email !== demoCustomerEmail ||
            password !== demoCustomerPassword
          ) {
            throw new Error(
              "Invalid email or password. Check your account details."
            );
          }

          authenticatedUser = login({
            id: 1,
            name: "Demo Customer",
            email: demoCustomerEmail,
            role: "CUSTOMER",
            active: true,
          });
        }
      }

      if (!authenticatedUser?.role) {
        throw new Error(
          "The server did not return a valid account role."
        );
      }

      // Role-based automatic navigation.
      const destination = getPostLoginPath(
        authenticatedUser,
        location.state?.from
      );

      navigate(destination, { replace: true });

    } catch (requestError) {
      setError(
        requestError.message ||
          "Could not sign in. Check your email and password."
      );
    } finally {
      setLoading(false);
    }
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
          {error && (
            <div className="crm-error-banner" role="alert">
              {error}
            </div>
          )}

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

          <div className="auth-options">
            <label className="remember-option">
              <input type="checkbox" />
              <span>Remember me</span>
            </label>
          </div>

          <button
            type="submit"
            className="auth-primary-button"
            disabled={loading}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="auth-switch">
          Don't have an account?{" "}
          <Link
            to="/signup"
            state={{
              backgroundLocation:
                location.state?.backgroundLocation,
              from: location.state?.from,
            }}
          >
            Signup
          </Link>
        </p>

      </div>
    </AuthLayout>
  );
}

export default Login;
