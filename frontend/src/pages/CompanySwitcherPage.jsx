import React, { useEffect, useState } from "react";
import API from "../api";

const styles = {
  title: { fontSize: 30, fontWeight: 700, marginBottom: 8 },
  sub: { color: "#64748b", marginBottom: 24 },
  card: {
    maxWidth: 700,
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 4px 18px rgba(15,23,42,0.05)",
  },
  field: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: 600, color: "#334155" },
  input: { border: "1px solid #cbd5e1", borderRadius: 14, padding: "12px 14px", fontSize: 14, background: "#fff" },
  btn: { background: "#0f172a", color: "#fff", border: "none", borderRadius: 14, padding: "11px 15px", fontWeight: 600, cursor: "pointer" },
};

function CompanySwitcherPage() {
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    const res = await API.get("/companies");
    setCompanies(res.data || []);
  };

  const switchCompany = async () => {
    await API.post("/companies/switch", { company_id: Number(companyId) });
    window.location.href = "/";
  };

  return (
    <div>
      <div style={styles.title}>Company Switcher</div>
      <div style={styles.sub}>Foundation for multi-company operation on one ERP product.</div>

      <div style={styles.card}>
        <div style={styles.field}>
          <label style={styles.label}>Company</label>
          <select style={styles.input} value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">Select company</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} - {c.name}
              </option>
            ))}
          </select>
        </div>

        <button style={styles.btn} onClick={switchCompany}>Switch Company</button>
      </div>
    </div>
  );
}

export default CompanySwitcherPage;