import React, { useEffect, useMemo, useState } from "react";
import API from "../api";

const styles = {
  title: { fontSize: 30, fontWeight: 700, marginBottom: 8 },
  sub: { color: "#64748b", marginBottom: 24 },
  layout: { display: "grid", gridTemplateColumns: "0.95fr 1.25fr", gap: 24 },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 4px 18px rgba(15,23,42,0.05)",
  },
  statGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 12,
    marginBottom: 18,
  },
  statCard: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 16,
  },
  field: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 },
  label: { fontSize: 13, fontWeight: 600, color: "#334155" },
  input: {
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    padding: "12px 14px",
    fontSize: 14,
    background: "#fff",
  },
  btnRow: { display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" },
  btn: {
    background: "#0f172a",
    color: "#fff",
    border: "none",
    borderRadius: 14,
    padding: "11px 15px",
    fontWeight: 600,
    cursor: "pointer",
  },
  outlineBtn: {
    background: "#fff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    padding: "11px 15px",
    fontWeight: 600,
    cursor: "pointer",
  },
  toolbar: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    marginBottom: 16,
    flexWrap: "wrap",
  },
  search: {
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    padding: "12px 14px",
    fontSize: 14,
    background: "#fff",
    minWidth: 260,
  },
  tableWrap: {
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    overflow: "hidden",
  },
  tableHead: {
    display: "grid",
    gridTemplateColumns: "0.8fr 1.3fr 0.8fr 1fr 0.8fr",
    padding: "14px 16px",
    background: "#f8fafc",
    fontSize: 12,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "0.8fr 1.3fr 0.8fr 1fr 0.8fr",
    padding: "14px 16px",
    borderTop: "1px solid #e2e8f0",
    fontSize: 14,
    alignItems: "center",
  },
  badge: (active) => ({
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    background: active ? "#dcfce7" : "#fee2e2",
    color: active ? "#166534" : "#991b1b",
  }),
  typeBadge: (type) => ({
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    background:
      type === "CUSTOMER"
        ? "#dbeafe"
        : type === "VENDOR"
          ? "#fef3c7"
          : "#e9d5ff",
    color:
      type === "CUSTOMER"
        ? "#1d4ed8"
        : type === "VENDOR"
          ? "#92400e"
          : "#7c3aed",
  }),
};

function PartiesPage() {
  const [parties, setParties] = useState([]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");

  const [form, setForm] = useState({
    party_code: "",
    party_name: "",
    party_type: "CUSTOMER",
    email: "",
    phone: "",
    gstin: "",
  });

  useEffect(() => {
    loadParties();
  }, []);

  const loadParties = async () => {
    const res = await API.get("/parties");
    setParties(res.data || []);
  };

  const saveParty = async () => {
    await API.post("/parties", form);
    setForm({
      party_code: "",
      party_name: "",
      party_type: "CUSTOMER",
      email: "",
      phone: "",
      gstin: "",
    });
    loadParties();
  };

  const filtered = useMemo(() => {
    return parties.filter((p) => {
      const q = query.trim().toLowerCase();
      const matchQuery =
        !q ||
        String(p.party_code || "").toLowerCase().includes(q) ||
        String(p.party_name || "").toLowerCase().includes(q) ||
        String(p.email || "").toLowerCase().includes(q);

      const matchType = typeFilter === "ALL" || p.party_type === typeFilter;
      return matchQuery && matchType;
    });
  }, [parties, query, typeFilter]);

  const stats = {
    total: parties.length,
    customer: parties.filter((p) => p.party_type === "CUSTOMER").length,
    vendor: parties.filter((p) => p.party_type === "VENDOR").length,
    active: parties.filter((p) => Number(p.is_active) === 1).length,
  };

  return (
    <div>
      <div style={styles.title}>Party Master</div>
      <div style={styles.sub}>Customer and vendor master management with a standard ERP structure.</div>

      <div style={styles.layout}>
        <div style={styles.card}>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 14 }}>Create Party</div>

          <div style={styles.field}>
            <label style={styles.label}>Party Code</label>
            <input
              style={styles.input}
              value={form.party_code}
              onChange={(e) => setForm({ ...form, party_code: e.target.value })}
              placeholder="e.g. CUST001"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Party Name</label>
            <input
              style={styles.input}
              value={form.party_name}
              onChange={(e) => setForm({ ...form, party_name: e.target.value })}
              placeholder="e.g. Sunrise Traders"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Party Type</label>
            <select
              style={styles.input}
              value={form.party_type}
              onChange={(e) => setForm({ ...form, party_type: e.target.value })}
            >
              <option value="CUSTOMER">CUSTOMER</option>
              <option value="VENDOR">VENDOR</option>
              <option value="BOTH">BOTH</option>
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              style={styles.input}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Phone</label>
            <input
              style={styles.input}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>GSTIN</label>
            <input
              style={styles.input}
              value={form.gstin}
              onChange={(e) => setForm({ ...form, gstin: e.target.value })}
            />
          </div>

          <div style={styles.btnRow}>
            <button style={styles.btn} onClick={saveParty}>Save Party</button>
          </div>
        </div>

        <div>
          <div style={styles.statGrid}>
            <div style={styles.statCard}>
              <div style={{ color: "#64748b", fontSize: 13 }}>Total Parties</div>
              <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6 }}>{stats.total}</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ color: "#64748b", fontSize: 13 }}>Customers</div>
              <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6 }}>{stats.customer}</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ color: "#64748b", fontSize: 13 }}>Vendors</div>
              <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6 }}>{stats.vendor}</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ color: "#64748b", fontSize: 13 }}>Active</div>
              <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6 }}>{stats.active}</div>
            </div>
          </div>

          <div style={styles.card}>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 14 }}>Party List</div>

            <div style={styles.toolbar}>
              <input
                style={styles.search}
                placeholder="Search code, name, email"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />

              <select
                style={styles.input}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="ALL">All Types</option>
                <option value="CUSTOMER">CUSTOMER</option>
                <option value="VENDOR">VENDOR</option>
                <option value="BOTH">BOTH</option>
              </select>

              <button style={styles.outlineBtn} onClick={loadParties}>Refresh</button>
            </div>

            <div style={styles.tableWrap}>
              <div style={styles.tableHead}>
                <div>Code</div>
                <div>Name</div>
                <div>Type</div>
                <div>Email</div>
                <div>Status</div>
              </div>

              {filtered.map((p) => (
                <div key={p.id} style={styles.tableRow}>
                  <div>{p.party_code}</div>
                  <div>{p.party_name}</div>
                  <div>
                    <span style={styles.typeBadge(p.party_type)}>{p.party_type}</span>
                  </div>
                  <div>{p.email || "-"}</div>
                  <div>
                    <span style={styles.badge(Number(p.is_active) === 1)}>
                      {Number(p.is_active) === 1 ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PartiesPage;