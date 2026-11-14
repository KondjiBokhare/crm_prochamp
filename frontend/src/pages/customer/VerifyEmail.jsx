import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BadgeCheck, BadgeX } from "lucide-react";

import AuthLayout from "../../components/auth/AuthLayout";
import { verifyEmail } from "../../services/authApi";

function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [state, setState] = useState("verifying");
  const [message, setMessage] = useState("Verifying your email…");

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("This verification link is missing a token.");
      return;
    }

    let cancelled = false;
    verifyEmail(token)
      .then((payload) => {
        if (cancelled) return;
        setState("success");
        setMessage(payload?.detail || "Your email has been verified.");
      })
      .catch((error) => {
        if (cancelled) return;
        setState("error");
        setMessage(error.message || "This verification link is invalid or has expired.");
      });

    return () => { cancelled = true; };
  }, [token]);

  return (
    <AuthLayout>
      <div className="auth-form-container">
        <div className="auth-form-header">
          {state === "success" ? <BadgeCheck size={40} /> : state === "error" ? <BadgeX size={40} /> : null}
          <h2>{state === "verifying" ? "Verifying…" : state === "success" ? "Email verified" : "Verification failed"}</h2>
          <p>{message}</p>
        </div>

        <p className="auth-switch">
          <Link to="/login">Go to sign in</Link>
        </p>
      </div>
    </AuthLayout>
  );
}

export default VerifyEmail;
