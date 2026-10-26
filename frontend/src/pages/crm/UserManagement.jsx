import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  UserPlus,
  UserX,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";

import {
  listApiStaffUsers,
  createApiStaffUser,
  updateApiStaffUser,
} from "../../services/crmOperationsApiService";

import { CRM_ROLES, ROLE_LABELS } from "../../auth/roles";

import {
  EmptyState,
  MetricCard,
  Modal,
  PageHeader,
  SectionCard,
  StatusBadge,
} from "../../components/crm/CrmUI";

const roleDescription = {
  ADMIN: "Organization administration and staff management.",
  CRM_MANAGER: "Customers, products, orders and CRM operations.",
  MARKETING_MANAGER: "Promotions, banners, segments and campaigns.",
  SUPPORT_AGENT: "Support tickets, replies and customer interactions.",
  ANALYST: "Analytics, reports and business insights.",
  OPERATIONS: "Inventory, shipments and operational workflows.",
};

const blankForm = () => ({
  id: null,
  name: "",
  email: "",
  role: "CRM_MANAGER",
  password: "",
  active: true,
});

function UserManagement() {
  const { user: currentUser, authenticatedRequest } = useAuth();

  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankForm);

  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const records = await listApiStaffUsers(authenticatedRequest);
      setUsers(Array.isArray(records) ? records : []);
    } catch (loadError) {
      // Never replace failed production API data with demo users.
      setUsers([]);
      setError(
        loadError.message ||
          "Could not load staff accounts from the Django database."
      );
    } finally {
      setLoading(false);
    }
  }, [authenticatedRequest]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const visibleUsers = useMemo(() => {
    const search = query.trim().toLowerCase();

    return users.filter((record) => {
      const matchesSearch =
        !search ||
        [
          record.name,
          record.email,
          record.id,
        ].some((value) =>
          String(value || "").toLowerCase().includes(search)
        );

      const matchesRole =
        roleFilter === "All" || record.role === roleFilter;

      const matchesStatus =
        statusFilter === "All" ||
        (statusFilter === "Active"
          ? record.active
          : !record.active);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, query, roleFilter, statusFilter]);

  const activeCount = users.filter(
    (record) => record.active
  ).length;

  const adminCount = users.filter(
    (record) =>
      record.active && record.role === "ADMIN"
  ).length;

  function openCreate() {
    setEditing(null);
    setForm(blankForm());
    setError("");
    setNotice("");
    setShowEditor(true);
  }

  function openEdit(record) {
    setEditing(record);

    setForm({
      id: record.id,
      name: record.name || "",
      email: record.email || "",
      role: record.role,
      password: "",
      active: record.active,
    });

    setError("");
    setNotice("");
    setShowEditor(true);
  }

  function updateField(name, value) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function save(event) {
    event.preventDefault();

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const name = String(form.name || "").trim();
      const email = String(form.email || "")
        .trim()
        .toLowerCase();
      const password = String(form.password || "");

      if (!name) {
        throw new Error("Enter the staff member's full name.");
      }

      if (!/^\S+@\S+\.\S+$/.test(email)) {
        throw new Error("Enter a valid work email address.");
      }

      if (!CRM_ROLES.includes(form.role)) {
        throw new Error("Choose a valid CRM role.");
      }

      if (!editing && password.length < 8) {
        throw new Error(
          "Initial password must contain at least 8 characters."
        );
      }

      if (editing && password && password.length < 8) {
        throw new Error(
          "A reset password must contain at least 8 characters."
        );
      }

      const payload = {
        name,
        email,
        role: form.role,
        active: Boolean(form.active),
      };

      // Send a password only when creating an account or
      // when the administrator explicitly resets it.
      if (!editing || password) {
        payload.password = password;
      }

      if (editing) {
        await updateApiStaffUser(
          editing.id,
          payload,
          authenticatedRequest
        );
      } else {
        await createApiStaffUser(
          payload,
          authenticatedRequest
        );
      }

      setShowEditor(false);

      setNotice(
        editing
          ? "Staff account updated in Django."
          : "Staff account created in Django."
      );

      await refresh();
    } catch (saveError) {
      setError(
        saveError.message ||
          "The Django API could not save this staff account."
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(record) {
    const nextStatus = !record.active;

    if (
      String(record.id) === String(currentUser?.id) &&
      !nextStatus
    ) {
      setError(
        "You cannot deactivate your own signed-in account."
      );
      return;
    }

    setError("");
    setNotice("");

    try {
      await updateApiStaffUser(
        record.id,
        { active: nextStatus },
        authenticatedRequest
      );

      setNotice(
        `${record.name} is now ${
          nextStatus ? "active" : "inactive"
        }.`
      );

      await refresh();
    } catch (updateError) {
      setError(
        updateError.message ||
          "Could not update the staff account."
      );
    }
  }

  return (
    <div className="crm-page">
      <PageHeader
        title="Users & Permissions"
        description="Manage staff accounts stored in the Django database."
        action={
          <button
            type="button"
            className="crm-button crm-button-primary"
            onClick={openCreate}
          >
            <UserPlus size={16} />
            Add staff user
          </button>
        }
      />

      <div className="crm-demo-notice">
        Staff records are loaded from Django. Passwords are
        submitted to the backend and must be securely hashed there.
        If the API fails, demo data will not be displayed.
      </div>

      {notice && (
        <div className="crm-success-banner" role="status">
          {notice}
        </div>
      )}

      {error && !showEditor && (
        <div className="crm-error-banner" role="alert">
          {error}
        </div>
      )}

      <div className="crm-metrics-grid crm-metrics-three">
        <MetricCard
          label="Staff accounts"
          value={users.length}
          note="Accounts returned by Django"
          tone="blue"
        />

        <MetricCard
          label="Active accounts"
          value={activeCount}
          note="Active staff accounts"
          tone="green"
        />

        <MetricCard
          label="Active Admins"
          value={adminCount}
          note="Active organization administrators"
          tone="purple"
        />
      </div>

      <SectionCard
        title="Staff directory"
        subtitle="Staff records come from the authenticated Django API."
        action={
          <button
            type="button"
            className="crm-button crm-button-secondary crm-button-small"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw size={13} />
            {loading ? "Loading..." : "Refresh"}
          </button>
        }
      >
        <div className="crm-toolbar">
          <label className="crm-search-field">
            <Search size={15} />

            <input
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              placeholder="Search name, email or user ID..."
              aria-label="Search staff users"
            />
          </label>

          <label className="crm-filter-field">
            Role

            <select
              value={roleFilter}
              onChange={(event) =>
                setRoleFilter(event.target.value)
              }
            >
              <option value="All">All roles</option>

              {CRM_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role] || role}
                </option>
              ))}
            </select>
          </label>

          <label className="crm-filter-field">
            Status

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
            >
              <option value="All">All statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </label>

          <span className="crm-result-count">
            {visibleUsers.length} account
            {visibleUsers.length === 1 ? "" : "s"}
          </span>
        </div>

        {loading ? (
          <p role="status">Loading staff accounts from Django...</p>
        ) : visibleUsers.length === 0 ? (
          <EmptyState
            title={
              error
                ? "Staff accounts could not be loaded"
                : "No staff accounts found"
            }
            message={
              error
                ? "Check the API error above and try refreshing."
                : "No staff accounts match these filters."
            }
          />
        ) : (
          <div className="crm-table-wrap">
            <table className="crm-table crm-staff-table">
              <thead>
                <tr>
                  <th>Staff member</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {visibleUsers.map((record) => {
                  const isSelf =
                    String(record.id) ===
                    String(currentUser?.id);

                  return (
                    <tr key={record.id}>
                      <td>
                        <div className="crm-table-person">
                          <span className="crm-customer-avatar">
                            {String(record.name || "S")
                              .split(/\s+/)
                              .map((part) => part[0])
                              .slice(0, 2)
                              .join("")
                              .toUpperCase()}
                          </span>

                          <span>
                            <strong>
                              {record.name}
                              {isSelf ? " (you)" : ""}
                            </strong>

                            <small>{record.email}</small>
                          </span>
                        </div>
                      </td>

                      <td>
                        {ROLE_LABELS[record.role] ||
                          record.role}
                      </td>

                      <td>
                        <StatusBadge
                          status={
                            record.active
                              ? "Active"
                              : "Inactive"
                          }
                        />
                      </td>

                      <td>
                        <div className="crm-row-actions">
                          <button
                            className="crm-button crm-button-secondary crm-button-small"
                            type="button"
                            onClick={() => openEdit(record)}
                          >
                            <Pencil size={13} />
                            Edit
                          </button>

                          <button
                            className="crm-button crm-button-secondary crm-button-small"
                            type="button"
                            disabled={isSelf}
                            onClick={() =>
                              toggleActive(record)
                            }
                          >
                            {record.active ? (
                              <UserX size={13} />
                            ) : (
                              <ShieldCheck size={13} />
                            )}

                            {record.active
                              ? "Deactivate"
                              : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {showEditor && (
        <Modal
          title={
            editing
              ? "Edit staff account"
              : "Create staff account"
          }
          description="Account changes are submitted to the Django backend."
          onClose={() => {
            if (!busy) {
              setShowEditor(false);
              setError("");
            }
          }}
          width="940px"
        >
          <form
            className="crm-form crm-user-editor"
            onSubmit={save}
          >
            {error && (
              <div className="crm-error-banner" role="alert">
                {error}
              </div>
            )}

            <div className="crm-form-grid">
              <label className="crm-form-field">
                Full name *

                <input
                  value={form.name}
                  onChange={(event) =>
                    updateField("name", event.target.value)
                  }
                  maxLength={90}
                  required
                  autoComplete="name"
                />
              </label>

              <label className="crm-form-field">
                Work email *

                <input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    updateField("email", event.target.value)
                  }
                  required
                  autoComplete="email"
                />
              </label>

              <label className="crm-form-field">
                Role *

                <select
                  value={form.role}
                  disabled={
                    Boolean(
                      editing &&
                        String(editing.id) ===
                          String(currentUser?.id)
                    )
                  }
                  onChange={(event) =>
                    updateField("role", event.target.value)
                  }
                >
                  {CRM_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role] || role}
                    </option>
                  ))}
                </select>

                <small>
                  {roleDescription[form.role] ||
                    "Workspace role"}
                </small>
              </label>

              <label className="crm-form-field">
                {editing
                  ? "Reset password (optional)"
                  : "Initial password *"}

                <input
                  type="password"
                  value={form.password}
                  onChange={(event) =>
                    updateField(
                      "password",
                      event.target.value
                    )
                  }
                  required={!editing}
                  minLength={8}
                  autoComplete="new-password"
                  placeholder={
                    editing
                      ? "Leave blank to keep current password"
                      : "At least 8 characters"
                  }
                />

                <small>
                  The password is sent to Django and must be
                  hashed by the backend.
                </small>
              </label>
            </div>

            {editing && (
              <label
                className={`crm-user-active-toggle ${
                  String(editing.id) ===
                  String(currentUser?.id)
                    ? "is-disabled"
                    : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={form.active}
                  disabled={
                    String(editing.id) ===
                    String(currentUser?.id)
                  }
                  onChange={(event) =>
                    updateField(
                      "active",
                      event.target.checked
                    )
                  }
                />

                <span>
                  <strong>Account active</strong>
                  <small>
                    Inactive accounts cannot sign in.
                  </small>
                </span>
              </label>
            )}

            <div className="crm-demo-notice">
              Access to protected data must be enforced by Django
              using the account's role and organization.
            </div>

            <div className="crm-form-actions">
              <button
                type="button"
                className="crm-button crm-button-secondary"
                disabled={busy}
                onClick={() => {
                  setShowEditor(false);
                  setError("");
                }}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="crm-button crm-button-primary"
                disabled={busy}
              >
                {busy
                  ? "Saving..."
                  : editing
                    ? "Save staff changes"
                    : "Create staff account"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default UserManagement;