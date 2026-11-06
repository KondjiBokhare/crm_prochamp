
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshCw,
  Search,
  ShieldCheck,
  UserPlus,
   
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";

import {
  listApiStaffUsers,
  listApiOrganizations,
  createApiStaffUser,
  updateApiStaffUser,
} from "../../services/crmOperationsApiService";

import { CRM_ROLES, ROLE_LABELS } from "../../auth/roles";
import { PAGE_PERMISSION_LABELS } from "../../services/staffUserService";

import {
  EmptyState,
  MetricCard,
  Modal,
  PageHeader,
  SectionCard,
  StatusBadge,
} from "../../components/crm/CrmUI";

const RESTRICTED_PERMISSION_KEYS = new Set([
  "userManagement",
  "storefrontSettings",
]);

const PERMISSION_OPTIONS = Object.entries(
  PAGE_PERMISSION_LABELS
).filter(([key]) => !RESTRICTED_PERMISSION_KEYS.has(key));

const blankForm = () => ({
  name: "",
  email: "",
  role: "CRM_MANAGER",
  password: "",
  organizationId: "",
  permissions: [],
});

function UserManagement() {
  const { user: currentUser, authenticatedRequest } = useAuth();

  const isSuperAdmin = currentUser?.isSuperAdmin === true;

  const isOrganizationAdmin =
    !isSuperAdmin && currentUser?.role === "ADMIN";

  const [users, setUsers] = useState([]);
  const [organizations, setOrganizations] = useState([]);

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState(blankForm);

  const [loading, setLoading] = useState(true);
  const [organizationsLoading, setOrganizationsLoading] =
    useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const records = await listApiStaffUsers(
        authenticatedRequest
      );

      setUsers(Array.isArray(records) ? records : []);
    } catch (err) {
      setUsers([]);

      setError(
        err.message || "Could not load staff accounts."
      );
    } finally {
      setLoading(false);
    }
  }, [authenticatedRequest]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Only Super Admin can list organizations.
  useEffect(() => {
    if (!isSuperAdmin) {
      setOrganizations([]);
      return;
    }

    let active = true;

    async function loadOrganizations() {
      setOrganizationsLoading(true);

      try {
        const records = await listApiOrganizations(
          authenticatedRequest
        );

        if (active) {
          setOrganizations(
            Array.isArray(records) ? records : []
          );
        }
      } catch (err) {
        if (active) {
          setError(
            err.message ||
              "Could not load organizations."
          );
        }
      } finally {
        if (active) {
          setOrganizationsLoading(false);
        }
      }
    }

    loadOrganizations();

    return () => {
      active = false;
    };
  }, [isSuperAdmin, authenticatedRequest]);

  const visibleUsers = useMemo(() => {
    const search = query.trim().toLowerCase();

    return users.filter((record) => {
      const matchesSearch =
        !search ||
        [record.name, record.email, record.id].some(
          (value) =>
            String(value || "")
              .toLowerCase()
              .includes(search)
        );

      const matchesRole =
        roleFilter === "All" ||
        record.role === roleFilter;

      const matchesStatus =
        statusFilter === "All" ||
        (statusFilter === "Active"
          ? record.active
          : !record.active);

      return (
        matchesSearch &&
        matchesRole &&
        matchesStatus
      );
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
    if (!isSuperAdmin) return;

    setEditing(null);
    setForm(blankForm());
    setError("");
    setNotice("");
    setShowEditor(true);
  }

  function openPermissionEditor(record) {
    if (!isOrganizationAdmin) return;

    if (
      String(record.id) === String(currentUser?.id)
    ) {
      setError("You cannot change your own permissions.");
      return;
    }

    setEditing(record);

    setForm({
      ...blankForm(),
      permissions: Array.isArray(record.permissions)
        ? record.permissions.filter(
            (key) =>
              !RESTRICTED_PERMISSION_KEYS.has(key)
          )
        : [],
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

  function togglePermission(key, checked) {
    setForm((current) => ({
      ...current,

      permissions: checked
        ? [...new Set([...current.permissions, key])]
        : current.permissions.filter(
            (item) => item !== key
          ),
    }));
  }

  async function save(event) {
    event.preventDefault();

    setBusy(true);
    setError("");
    setNotice("");

    try {
      if (editing) {
        // Organization Admin updates permissions only.
        if (!isOrganizationAdmin) {
          throw new Error(
            "You are not allowed to update this account."
          );
        }

        await updateApiStaffUser(
          editing.id,
          {
            permissions: form.permissions,
          },
          authenticatedRequest
        );

        setNotice(
          `Permissions updated for ${editing.name}.`
        );
      } else {
        // Only Super Admin can create staff.
        if (!isSuperAdmin) {
          throw new Error(
            "Only Super Admin can create staff accounts."
          );
        }

        if (!form.name.trim()) {
          throw new Error("Enter the staff member's name.");
        }

        if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
          throw new Error("Enter a valid work email.");
        }

        if (form.password.length < 8) {
          throw new Error(
            "Password must contain at least 8 characters."
          );
        }

        if (!form.organizationId) {
          throw new Error("Select an organization.");
        }

        if (!CRM_ROLES.includes(form.role)) {
          throw new Error("Select a valid staff role.");
        }

        await createApiStaffUser(
          {
            ...form,
            name: form.name.trim(),
            email: form.email.trim().toLowerCase(),
          },
          authenticatedRequest
        );

        setNotice("Staff account created successfully.");
      }

      setShowEditor(false);
      setEditing(null);

      await refresh();
    } catch (err) {
      setError(
        err.message || "Could not save staff changes."
      );
    } finally {
      setBusy(false);
    }
  }

  const editorTitle = editing
    ? `Assign permissions: ${editing.name}`
    : "Create staff account";

  return (
    <div className="crm-page">
      <PageHeader
        title="Users & Permissions"
        description={
          isSuperAdmin
            ? "Create staff accounts and assign their organization and page access."
            : "Manage page permissions for staff in your organization."
        }
        action={
          isSuperAdmin ? (
            <button
              type="button"
              className="crm-button crm-button-primary"
              onClick={openCreate}
            >
              <UserPlus size={16} />
              Add staff user
            </button>
          ) : null
        }
      />

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
          note="Currently active staff"
          tone="green"
        />

        <MetricCard
          label="Organization Admins"
          value={adminCount}
          note="Active Admin accounts"
          tone="purple"
        />
      </div>

      <SectionCard
        title="Staff directory"
        subtitle="Staff records are loaded from the authenticated Django API."
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
              placeholder="Search name, email or ID..."
              aria-label="Search staff"
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
            {visibleUsers.length} account(s)
          </span>
        </div>

        {loading ? (
          <p role="status">Loading staff accounts...</p>
        ) : visibleUsers.length === 0 ? (
          <EmptyState
            title="No staff accounts found"
            message={
              error
                ? "Check the API error and refresh."
                : "No staff accounts match the selected filters."
            }
          />
        ) : (
          <div className="crm-table-wrap">
            <table className="crm-table crm-staff-table">
              <thead>
                <tr>
                  <th>Staff member</th>
                  <th>Role</th>
                  <th>Organization ID</th>
                  <th>Page permissions</th>
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
                        {record.organizationId || "—"}
                      </td>

                      <td>
                        {record.permissions?.length || 0} assigned
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
                        {isOrganizationAdmin && !isSelf ? (
                          <button
                            type="button"
                            className="crm-button crm-button-secondary crm-button-small"
                            onClick={() =>
                              openPermissionEditor(record)
                            }
                          >
                            <ShieldCheck size={13} />
                            Assign pages
                          </button>
                        ) : isSelf ? (
                          <span>Own account</span>
                        ) : (
                          <span>Managed at creation</span>
                        )}
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
          title={editorTitle}
          description={
            editing
              ? "Select only the CRM pages this staff member is allowed to access."
              : "Create a staff account and explicitly choose its page permissions."
          }
          onClose={() => {
            if (!busy) {
              setShowEditor(false);
              setEditing(null);
              setError("");
            }
          }}
          width="900px"
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

            {!editing && (
              <>
                <div className="crm-form-grid">
                  <label className="crm-form-field">
                    Full name *

                    <input
                      value={form.name}
                      onChange={(event) =>
                        updateField("name", event.target.value)
                      }
                      maxLength={150}
                      required
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
                    />
                  </label>

                  <label className="crm-form-field">
                    Role *

                    <select
                      value={form.role}
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
                  </label>

                  <label className="crm-form-field">
                    Initial password *

                    <input
                      type="password"
                      value={form.password}
                      onChange={(event) =>
                        updateField("password", event.target.value)
                      }
                      minLength={8}
                      required
                      autoComplete="new-password"
                    />
                  </label>

                  <label className="crm-form-field">
                    Organization *

                    <select
                      value={form.organizationId}
                      onChange={(event) =>
                        updateField(
                          "organizationId",
                          event.target.value
                        )
                      }
                      required
                      disabled={organizationsLoading}
                    >
                      <option value="">
                        {organizationsLoading
                          ? "Loading organizations..."
                          : "Select organization"}
                      </option>

                      {organizations.map((organization) => (
                        <option
                          key={organization.id}
                          value={organization.id}
                        >
                          {organization.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="crm-demo-notice">
                  The staff identity and organization are assigned
                  during creation. They cannot be edited here later.
                </div>
              </>
            )}

            <SectionCard
              title="Page access permissions"
              subtitle={`${form.permissions.length} page(s) selected. Unselected pages will be denied.`}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "12px",
                }}
              >
                {PERMISSION_OPTIONS.map(([key, label]) => (
                  <label
                    key={key}
                    className="crm-user-active-toggle"
                  >
                    <input
                      type="checkbox"
                      checked={form.permissions.includes(key)}
                      onChange={(event) =>
                        togglePermission(
                          key,
                          event.target.checked
                        )
                      }
                    />

                    <span>
                      <strong>{label}</strong>
                    </span>
                  </label>
                ))}
              </div>
            </SectionCard>

            <div className="crm-demo-notice">
              Access is assigned per page. Django must independently
              enforce these permissions for API requests.
            </div>

            <div className="crm-form-actions">
              <button
                type="button"
                className="crm-button crm-button-secondary"
                disabled={busy}
                onClick={() => {
                  setShowEditor(false);
                  setEditing(null);
                  setError("");
                }}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="crm-button crm-button-primary"
                disabled={
                  busy ||
                  (!editing &&
                    (organizationsLoading ||
                      organizations.length === 0))
                }
              >
                {busy
                  ? "Saving..."
                  : editing
                    ? "Save permissions"
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
