import React, { useEffect, useMemo, useState } from "react";
import API from "../api";

const blankForm = {
  id: null,
  account_code: "",
  account_name: "",
  account_type: "ASSET",
  parent_id: "",
  is_group: 0,
  is_active: 1,
  effective_from: "",
  effective_to: "",
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(blankForm);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async (search = "") => {
    try {
      setLoading(true);
      const res = await API.get("/accounts", {
        params: search ? { q: search } : {},
      });
      setAccounts(res.data || []);
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  };

  const topLevelGroups = useMemo(() => {
    return accounts.filter((a) => Number(a.is_group) === 1);
  }, [accounts]);

  const renderTree = (parentId = null, level = 0) => {
    return accounts
      .filter((a) => {
        if (parentId === null) return a.parent_id === null;
        return Number(a.parent_id) === Number(parentId);
      })
      .map((acc) => (
        <div
          key={acc.id}
          style={{
            borderTop: "1px solid #e2e8f0",
            padding: "10px 12px",
            paddingLeft: 12 + level * 24,
            background: Number(acc.is_group) === 1 ? "#f8fafc" : "#fff",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "130px 1fr 120px 120px 120px 220px", gap: 12, alignItems: "center" }}>
            <div>{acc.account_code}</div>
            <div style={{ fontWeight: Number(acc.is_group) === 1 ? 700 : 500 }}>
              {Number(acc.is_group) === 1 ? "📁" : "📄"} {acc.account_name}
            </div>
            <div>{acc.account_type}</div>
            <div>{acc.effective_from || "-"}</div>
            <div>{acc.effective_to || "-"}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setForm({
                id: acc.id,
                account_code: acc.account_code || "",
                account_name: acc.account_name || "",
                account_type: acc.account_type || "ASSET",
                parent_id: acc.parent_id || "",
                is_group: Number(acc.is_group) || 0,
                is_active: Number(acc.is_active) || 1,
                effective_from: acc.effective_from || "",
                effective_to: acc.effective_to || "",
              })}>
                Edit
              </button>
              <button onClick={() => deactivateAccount(acc.id)}>
                Deactivate
              </button>
            </div>
          </div>

          {renderTree(acc.id, level + 1)}
        </div>
      ));
  };

  const saveAccount = async () => {
    try {
      setSaving(true);

      const payload = {
        account_code: form.account_code,
        account_name: form.account_name,
        account_type: form.account_type,
        parent_id: form.parent_id || null,
        is_group: Number(form.is_group),
        is_active: Number(form.is_active),
        effective_from: form.effective_from || null,
        effective_to: form.effective_to || null,
      };

      if (form.id) {
        await API.put(`/accounts/${form.id}`, payload);
        alert("Account updated successfully");
      } else {
        await API.post("/accounts", payload);
        alert("Account created successfully");
      }

      setForm(blankForm);
      loadAccounts(query);
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || "Failed to save account");
    } finally {
      setSaving(false);
    }
  };

  const deactivateAccount = async (id) => {
    try {
      await API.delete(`/accounts/${id}`);
      alert("Account deactivated");
      loadAccounts(query);
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || "Failed to deactivate account");
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    loadAccounts(query);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Chart of Accounts</h2>

      <div
        style={{
          marginTop: 16,
          marginBottom: 20,
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 16,
          padding: 16,
        }}
      >
        <h3>{form.id ? "Edit Account" : "Create Account"}</h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <input
            placeholder="Account Code"
            value={form.account_code}
            onChange={(e) => setForm({ ...form, account_code: e.target.value })}
          />
          <input
            placeholder="Account Name"
            value={form.account_name}
            onChange={(e) => setForm({ ...form, account_name: e.target.value })}
          />
          <select
            value={form.account_type}
            onChange={(e) => setForm({ ...form, account_type: e.target.value })}
          >
            <option value="ASSET">ASSET</option>
            <option value="LIABILITY">LIABILITY</option>
            <option value="EQUITY">EQUITY</option>
            <option value="INCOME">INCOME</option>
            <option value="EXPENSE">EXPENSE</option>
            <option value="COGS">COGS</option>
          </select>

          <select
            value={form.parent_id}
            onChange={(e) => setForm({ ...form, parent_id: e.target.value })}
          >
            <option value="">No Parent</option>
            {topLevelGroups.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.account_code} - {acc.account_name}
              </option>
            ))}
          </select>

          <select
            value={form.is_group}
            onChange={(e) => setForm({ ...form, is_group: Number(e.target.value) })}
          >
            <option value={0}>Posting Account</option>
            <option value={1}>Group Account</option>
          </select>

          <select
            value={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: Number(e.target.value) })}
          >
            <option value={1}>Active</option>
            <option value={0}>Inactive</option>
          </select>

          <input
            type="date"
            value={form.effective_from}
            onChange={(e) => setForm({ ...form, effective_from: e.target.value })}
          />
          <input
            type="date"
            value={form.effective_to}
            onChange={(e) => setForm({ ...form, effective_to: e.target.value })}
          />
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
          <button onClick={saveAccount} disabled={saving}>
            {saving ? "Saving..." : form.id ? "Update Account" : "Create Account"}
          </button>
          <button onClick={() => setForm(blankForm)}>
            Reset
          </button>
        </div>
      </div>

      <form
        onSubmit={handleSearch}
        style={{
          marginBottom: 16,
          display: "flex",
          gap: 10,
        }}
      >
        <input
          placeholder="Search by account code or name, e.g. 6203 or internet"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ minWidth: 360 }}
        />
        <button type="submit">Search</button>
        <button
          type="button"
          onClick={() => {
            setQuery("");
            loadAccounts("");
          }}
        >
          Clear
        </button>
      </form>

      {loading ? <p>Loading accounts...</p> : null}

      {!loading && accounts.length === 0 ? (
        <p>No chart of accounts found.</p>
      ) : null}

      {!loading && accounts.length > 0 ? (
        <div
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "130px 1fr 120px 120px 120px 220px",
              gap: 12,
              padding: "12px",
              background: "#f8fafc",
              fontWeight: 700,
            }}
          >
            <div>Code</div>
            <div>Name</div>
            <div>Type</div>
            <div>Start Date</div>
            <div>End Date</div>
            <div>Action</div>
          </div>

          {renderTree()}
        </div>
      ) : null}
    </div>
  );
}