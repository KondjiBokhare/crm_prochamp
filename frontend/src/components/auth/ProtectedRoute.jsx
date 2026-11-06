
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

/**
 * Shared route protection:
 * - Routes with allowedRoles use their specified role restriction.
 * - CRM parent routes without allowedRoles accept CRM employees only.
 */
function ProtectedRoute({
  children,
  allowedRoles,
  loginPath = "/login",
}) {
  const {
    isAuthenticated,
    isCrmUser,
    hasRole,
    isInitializing,
  } = useAuth();

  const location = useLocation();

  if (isInitializing) {
    return (
      <div
        className="crm-loading"
        role="status"
        aria-live="polite"
      >
        Restoring session…
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to={loginPath}
        replace
        state={{
          from: `${location.pathname}${location.search}`,
        }}
      />
    );
  }

  // When allowedRoles are specified, enforce those roles.
  // This allows CUSTOMER to access customer account pages.
  if (allowedRoles?.length) {
    if (!hasRole(allowedRoles)) {
      return <Navigate to="/unauthorized" replace />;
    }

    return children || <Outlet />;
  }

  // Routes without allowedRoles are CRM-only routes.
  // Customers must not enter the CRM layout.
  if (!isCrmUser) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children || <Outlet />;
}

export default ProtectedRoute;
