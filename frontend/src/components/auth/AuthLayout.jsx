import { useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import AuthBrandPanel from "./AuthBrandPanel";

function AuthLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const closeModal = useCallback(() => {
    const backgroundLocation =
      location.state?.backgroundLocation;

    if (backgroundLocation) {
      navigate(backgroundLocation, { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  }, [location.state?.backgroundLocation, navigate]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeModal]);

  return (
    <div
      className="auth-page auth-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closeModal();
        }
      }}
    >
      <section
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Customer login or signup"
      >
        <button
          type="button"
          className="auth-modal-close"
          onClick={closeModal}
          aria-label="Close login or signup"
        >
          <X size={21} />
        </button>

        <AuthBrandPanel />

        <main className="auth-form-panel">
          {children}
        </main>
      </section>
    </div>
  );
}

export default AuthLayout;