import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { canUserAccessPage } from "../../services/staffUserService";

function RoleGuard({ pageKey, children }) {
  const { user } = useAuth();
  const allowed = canUserAccessPage(
    user,
    pageKey
  );
  if (!allowed) return <Navigate to="/unauthorized" replace />;
  return children || <Outlet />;
}

export default RoleGuard;
