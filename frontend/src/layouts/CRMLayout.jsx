import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import "../styles/crm.css";

function CRMLayout() {
  return (
    <div className="crm-layout">
      <Sidebar />
      <main className="crm-content">
        <Outlet />
      </main>
    </div>
  );
}

export default CRMLayout;
