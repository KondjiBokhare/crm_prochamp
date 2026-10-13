import { Outlet } from "react-router-dom";

import TopBar from "../components/common/TopBar";
import Navbar from "../components/common/Navbar";
import CategoryNav from "../components/common/CategoryNav";

import AccountSidebar from "../components/orders/AccountSidebar";

function AccountLayout() {
  return (
    <>
      {/* Store Header */}
      <TopBar />
      <Navbar />
      <CategoryNav />

      {/* Account Area */}
      <div className="account-layout">

        <aside className="account-layout-sidebar">
          <AccountSidebar />
        </aside>

        <main className="account-layout-content">
          <Outlet />
        </main>

      </div>
    </>
  );
}

export default AccountLayout;