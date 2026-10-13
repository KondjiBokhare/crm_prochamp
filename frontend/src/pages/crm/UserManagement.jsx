import { useCallback, useEffect, useMemo, useState } from "react";
import { KeyRound, Pencil, RefreshCw, Search, ShieldCheck, UserPlus, UserX } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { staffUsersApiMode, listApiStaffUsers, createApiStaffUser, updateApiStaffUser } from "../../services/crmOperationsApiService";
import { DEMO_USERS } from "../../auth/demoUsers";
import { CRM_ROLES, ROLE_LABELS } from "../../auth/roles";
import {
  PAGE_PERMISSION_LABELS,
  createStaffUser,
  defaultPermissionsForRole,
  listStaffUsers,
  staffUsersChangedEvent,
  updateStaffUser,
} from "../../services/staffUserService";
import { EmptyState, MetricCard, Modal, PageHeader, SectionCard, StatusBadge } from "../../components/crm/CrmUI";

const ADMIN_ONLY = new Set(["userManagement", "storefrontSettings"]);
const roleDescription = {
  ADMIN: "Global company settings, staff access and security controls.",
  CRM_MANAGER: "Customers, products, orders and day-to-day CRM operations.",
  MARKETING_MANAGER: "Promotions, banners, segments and campaigns.",
  SUPPORT_AGENT: "Customer support tickets, replies and interactions.",
  ANALYST: "Read-only dashboards, metrics and reports.",
};

const blankForm = () => ({ id: null, name: "", email: "", role: "CRM_MANAGER", password: "", active: true, permissions: defaultPermissionsForRole("CRM_MANAGER") });

function UserManagement() {
  const { user: currentUser, authenticatedRequest } = useAuth();
  const [users, setUsers] = useState(() => staffUsersApiMode ? [] : listStaffUsers(DEMO_USERS));
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(async () => {
    try {
      if (staffUsersApiMode) setUsers(await listApiStaffUsers(authenticatedRequest));
      else setUsers(listStaffUsers(DEMO_USERS));
    } catch (loadError) {
      setError(loadError.message || "Could not load staff accounts.");
    }
  }, [reloadKey, authenticatedRequest]);
  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener(staffUsersChangedEvent, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(staffUsersChangedEvent, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [refresh]);

  const visibleUsers = useMemo(() => users.filter((record) => {
    const q = query.trim().toLowerCase();
    const matchesText = !q || [record.name, record.email, record.id].some((value) => String(value || "").toLowerCase().includes(q));
    return matchesText && (roleFilter === "All" || record.role === roleFilter) && (statusFilter === "All" || (statusFilter === "Active" ? record.active : !record.active));
  }), [users, query, roleFilter, statusFilter]);
  const activeCount = users.filter((record) => record.active).length;
  const adminCount = users.filter((record) => record.active && record.role === "ADMIN").length;

  function openCreate() {
    setEditing(null);
    setForm(blankForm());
    setError("");
    setNotice("");
    setShowEditor(true);
  }

  function openEdit(record) {
    setEditing(record);
    setForm({ id: record.id, name: record.name, email: record.email, role: record.role, password: "", active: record.active, permissions: [...record.permissions] });
    setError("");
    setNotice("");
    setShowEditor(true);
  }

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function changeRole(role) {
    setForm((current) => ({ ...current, role, permissions: defaultPermissionsForRole(role) }));
  }

  function togglePermission(key, checked) {
    setForm((current) => ({
      ...current,
      permissions: checked ? [...new Set([...current.permissions, key])] : current.permissions.filter((item) => item !== key),
    }));
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      if (!editing && String(form.password || "").length < 8) throw new Error(staffUsersApiMode ? "Set an initial password of at least 8 characters." : "Set a temporary demo password of at least 8 characters.");
      const payload = { ...form, permissions: form.permissions };
      if (staffUsersApiMode) {
        if (editing) await updateApiStaffUser(editing.id, payload, authenticatedRequest);
        else await createApiStaffUser(payload, authenticatedRequest);
      } else if (editing) updateStaffUser(editing.id, payload, DEMO_USERS, currentUser?.id);
      else createStaffUser(payload, DEMO_USERS);
      setShowEditor(false);
      setNotice(staffUsersApiMode
        ? (editing ? "Django staff account updated." : "Django staff account created. Its password is securely hashed by Django.")
        : (editing ? "Staff account updated. Changes to permissions take effect after that user signs in again." : "Staff account created. It can sign in using its work email and temporary demo password."));
      setReloadKey((value) => value + 1);
      if (staffUsersApiMode) setUsers(await listApiStaffUsers(authenticatedRequest));
      else setUsers(listStaffUsers(DEMO_USERS));
    } catch (err) {
      setError(err.message || "Could not save this staff account.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(record) {
    const nextStatus = !record.active;
    if (String(record.id) === String(currentUser?.id) && !nextStatus) {
      setError("You cannot deactivate your own signed-in account.");
      return;
    }
    if (!nextStatus && record.role === "ADMIN" && adminCount <= 1) {
      setError("At least one active Admin account must remain.");
      return;
    }
    try {
      if (staffUsersApiMode) {
        await updateApiStaffUser(record.id, { active: nextStatus }, authenticatedRequest);
        setUsers(await listApiStaffUsers(authenticatedRequest));
      } else {
        updateStaffUser(record.id, { active: nextStatus }, DEMO_USERS, currentUser?.id);
        setUsers(listStaffUsers(DEMO_USERS));
      }
      setError("");
      setNotice(`${record.name} is now ${nextStatus ? "active" : "inactive"}.`);
    } catch (err) {
      setError(err.message || "Could not update staff status.");
    }
  }

  return (
    <div className="crm-page">
      <PageHeader
        title="Users & Permissions"
        description={staffUsersApiMode ? "Manage real Django staff accounts, roles and account status." : "Manage staff demo accounts, assign roles, and tailor page-level workspace access."}
        action={<button type="button" className="crm-button crm-button-primary" onClick={openCreate}><UserPlus size={16}/> Add staff user</button>}
      />
      {staffUsersApiMode ? <div className="crm-demo-notice"><strong>Django API mode.</strong> Accounts are stored by the backend and passwords are hashed by Django. Roles are enforced server-side; granular per-user page overrides remain demo-only.</div> : <div className="crm-demo-notice"><strong>Frontend demo only.</strong> New accounts and password values are stored in this browser's localStorage. Do not use real passwords here. Django must enforce authentication and permissions on the server before production.</div>}
      {notice && <div className="crm-success-banner" role="status">{notice}</div>}
      {error && !showEditor && <div className="crm-error-banner" role="alert">{error}</div>}

      <div className="crm-metrics-grid crm-metrics-three">
        <MetricCard label="Staff accounts" value={users.length} note="Built-in and admin-created demo users" tone="blue" />
        <MetricCard label="Active accounts" value={activeCount} note="Can sign in to the demo workspace" tone="green" />
        <MetricCard label="Active Admins" value={adminCount} note="At least one is required" tone="purple" />
      </div>

      <SectionCard title="Staff directory" subtitle="Role defaults provide a starting point. Per-user page permissions can be adjusted below." action={<button type="button" className="crm-button crm-button-secondary crm-button-small" onClick={() => setReloadKey((value) => value + 1)}><RefreshCw size={13}/> Refresh</button>}>
        <div className="crm-toolbar">
          <label className="crm-search-field"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email or user ID…" aria-label="Search staff users"/></label>
          <label className="crm-filter-field">Role<select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="All">All roles</option>{CRM_ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role] || role}</option>)}</select></label>
          <label className="crm-filter-field">Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="All">All statuses</option><option value="Active">Active</option><option value="Inactive">Inactive</option></select></label>
          <span className="crm-result-count">{visibleUsers.length} account{visibleUsers.length === 1 ? "" : "s"}</span>
        </div>
        {visibleUsers.length === 0 ? <EmptyState title="No staff accounts match" message="Try clearing filters or add a new staff user."/> : (
          <div className="crm-table-wrap">
            <table className="crm-table crm-staff-table">
              <thead><tr><th>Staff member</th><th>Role</th><th>Access</th><th>Account type</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>{visibleUsers.map((record) => {
                const isSelf = String(record.id) === String(currentUser?.id);
                return <tr key={record.id}>
                  <td><div className="crm-table-person"><span className="crm-customer-avatar">{record.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span><span><strong>{record.name}{isSelf ? " (you)" : ""}</strong><small>{record.email}</small></span></div></td>
                  <td>{ROLE_LABELS[record.role] || record.role}</td>
                  <td><span className="crm-staff-permission-count"><ShieldCheck size={13}/>{record.permissions.length} pages</span></td>
                  <td>{staffUsersApiMode ? "Django staff" : record.isDemo ? "Built-in demo" : "Managed demo"}</td>
                  <td><StatusBadge status={record.active ? "Active" : "Inactive"}/></td>
                  <td><div className="crm-row-actions"><button className="crm-button crm-button-secondary crm-button-small" type="button" onClick={() => openEdit(record)}><Pencil size={13}/> Edit</button><button className="crm-button crm-button-secondary crm-button-small" type="button" disabled={isSelf} onClick={() => toggleActive(record)}>{record.active ? <UserX size={13}/> : <ShieldCheck size={13} />}{record.active ? "Deactivate" : "Activate"}</button></div></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {showEditor && (
        <Modal title={editing ? "Edit staff account" : "Create staff account"} description={staffUsersApiMode ? "Choose a standard Django role. Access is controlled by server-side role permissions." : "Choose a standard role, then tailor the pages this user can access."} onClose={() => setShowEditor(false)} width="940px">
          <form className="crm-form crm-user-editor" onSubmit={save}>
            {error && <div className="crm-error-banner" role="alert">{error}</div>}
            <div className="crm-form-grid">
              <label className="crm-form-field">Full name *<input value={form.name} onChange={(event) => updateField("name", event.target.value)} maxLength={90} required autoComplete="name"/></label>
              <label className="crm-form-field">Work email *<input type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} required autoComplete="email"/></label>
              <label className="crm-form-field">Role *<select value={form.role} disabled={Boolean(editing && String(editing.id) === String(currentUser?.id))} onChange={(event) => changeRole(event.target.value)}>{CRM_ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role] || role}</option>)}</select><small>{roleDescription[form.role] || "Workspace role"}</small></label>
              <label className="crm-form-field">{staffUsersApiMode ? (editing ? "Reset password (optional)" : "Initial password *") : (editing ? "Reset demo password (optional)" : "Temporary demo password *")}<input type="password" value={form.password} onChange={(event) => updateField("password", event.target.value)} required={!editing} minLength={8} autoComplete="new-password" placeholder={editing ? "Leave blank to keep current password" : "At least 8 characters"}/><small>{staffUsersApiMode ? "Django hashes the password; the raw password is never returned by the API." : "Demo-only password stored in this browser; not safe for production."}</small></label>
            </div>
            {editing && <label className={`crm-user-active-toggle ${String(editing.id) === String(currentUser?.id) ? "is-disabled" : ""}`}><input type="checkbox" checked={form.active} disabled={String(editing.id) === String(currentUser?.id)} onChange={(event) => updateField("active", event.target.checked)}/><span><strong>Account active</strong><small>Inactive users cannot sign in to the demo workspace.</small></span></label>}
            {staffUsersApiMode ? <div className="crm-demo-notice">Per-user page overrides are not persisted in the Django user model. The UI shows the standard permissions for the selected role; Django checks roles on API endpoints.</div> : <><div className="crm-user-permission-header"><div><h3><KeyRound size={16}/> Page-level permissions</h3><p>Role defaults are preselected. Uncheck pages to restrict this user. Global storefront settings and user administration remain Admin-only.</p></div><button type="button" className="crm-button crm-button-secondary crm-button-small" onClick={() => updateField("permissions", defaultPermissionsForRole(form.role))}>Reset to role defaults</button></div>
            <div className="crm-user-permission-grid">
              {Object.entries(PAGE_PERMISSION_LABELS).map(([key, label]) => {
                const locked = ADMIN_ONLY.has(key);
                const checked = locked ? form.role === "ADMIN" : form.permissions.includes(key);
                return <label key={key} className={`crm-user-permission-option ${locked ? "is-locked" : ""}`}><input type="checkbox" checked={checked} disabled={locked || (editing && String(editing.id) === String(currentUser?.id))} onChange={(event) => togglePermission(key, event.target.checked)}/><span><strong>{label}</strong>{locked && <small>Admin only · fixed permission</small>}</span></label>;
              })}
            </div></>}
            <div className="crm-form-actions"><button type="button" className="crm-button crm-button-secondary" onClick={() => setShowEditor(false)}>Cancel</button><button type="submit" className="crm-button crm-button-primary" disabled={busy}>{busy ? "Saving…" : editing ? "Save staff changes" : "Create staff account"}</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default UserManagement;
