import { useEffect } from "react";
import { Link } from "react-router-dom";

export function PageHeader({ eyebrow = "CUSTOMER RELATIONSHIP MANAGEMENT", title, description, action }) {
  return (
    <div className="crm-page-header">
      <div>
        <div className="crm-eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="crm-page-header-action">{action}</div>}
    </div>
  );
}

export function MetricCard({ label, value, note, tone = "blue" }) {
  return (
    <section className={`crm-metric-card crm-metric-${tone}`}>
      <div className="crm-metric-label">{label}</div>
      <div className="crm-metric-value">{value}</div>
      {note && <div className="crm-metric-note">{note}</div>}
    </section>
  );
}

export function StatusBadge({ status }) {
  const className = String(status || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return <span className={`crm-status-badge status-${className}`}>{status || "Unknown"}</span>;
}

export function SectionCard({ title, subtitle, action, children, className = "" }) {
  return (
    <section className={`crm-card ${className}`}>
      <div className="crm-card-header">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ title, message }) {
  return <div className="crm-empty-state"><strong>{title}</strong><p>{message}</p></div>;
}

export function CustomerLink({ customerId, children = "View customer" }) {
  return <Link className="crm-text-link" to={`/crm/customers/${customerId}`}>{children}</Link>;
}

export function Modal({ title, description, onClose, children, width = "560px" }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div className="crm-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="crm-modal" style={{ maxWidth: width }} role="dialog" aria-modal="true" aria-labelledby="crm-modal-title">
        <header className="crm-modal-header">
          <div><h2 id="crm-modal-title">{title}</h2>{description && <p>{description}</p>}</div>
          <button className="crm-modal-close" type="button" aria-label="Close dialog" onClick={onClose}>×</button>
        </header>
        {children}
      </section>
    </div>
  );
}
