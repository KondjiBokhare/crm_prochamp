import AuthBrandPanel from "./AuthBrandPanel";

function AuthLayout({ children }) {
  return (
    <div className="auth-page">
      <AuthBrandPanel />

      <main className="auth-form-panel">
        {children}
      </main>
    </div>
  );
}

export default AuthLayout;