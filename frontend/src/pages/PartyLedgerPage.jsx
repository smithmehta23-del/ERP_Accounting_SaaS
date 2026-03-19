import React, { useEffect, useState } from "react";
import API from "../api";

const styles = {
  title: { fontSize: 30, fontWeight: 700, marginBottom: 8 },
  sub: { color: "#64748b", marginBottom: 24 },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 4px 18px rgba(15,23,42,0.05)",
  },
  field: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 },
  label: { fontSize: 13, fontWeight: 600, color: "#334155" },
  input: { border: "1px solid #cbd5e1", borderRadius: 14, padding: "12px 14px", fontSize: 14, background: "#fff" },
  btn: { background: "#0f172a", color: "#fff", border: "none", borderRadius: 14, padding: "11px 15px", fontWeight: 600, cursor: "pointer" },
  tableWrap: { border: "1px solid #e2e8f0", borderRadius: 18, overflow: "hidden", marginTop: 16 },
  tableHead: { display: "grid", gridTemplateColumns: "1fr 1.2fr 0.8fr 0.8fr 1fr", padding: "14px 16px", background: "#f8fafc", fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" },
  tableRow: { display: "grid", gridTemplateColumns: "1fr 1.2fr 0.8fr 0.8fr 1fr", padding: "14px 16px", borderTop: "1px solid #e2e8f0", fontSize: 14, alignItems: "center" },
};

function PartyLedgerPage() {
  const [parties, setParties] = useState([]);
  const [partyId, setPartyId] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    loadParties();
  }, []);

  const loadParties = async () => {
    const res = await API.get("/parties");
    setParties(res.data || []);
  };

  const loadLedger = async () => {
    if (!partyId) return;
    const res = await API.get(`/party-ledger/${partyId}`);
    setData(res.data);
  };

  return (
    <div>
      <div style={styles.title}>Party Ledger</div>
      <div style={styles.sub}>Combined invoice and receipt/payment movement by customer or vendor.</div>

      <div style={styles.card}>
        <div style={styles.field}>
          <label style={styles.label}>Party</label>
          <select style={styles.input} value={partyId} onChange={(e) => setPartyId(e.target.value)}>
            <option value="">Select party</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.party_code} - {p.party_name}
              </option>
            ))}
          </select>
        </div>

        <button style={styles.btn} onClick={loadLedger}>Load Ledger</button>

        {data ? (
          <div style={styles.tableWrap}>
            <div style={styles.tableHead}>
              <div>Date</div>
              <div>Type / Doc</div>
              <div>Debit</div>
              <div>Credit</div>
              <div>Running Balance</div>
            </div>

            {data.rows.map((row, idx) => (
              <div key={idx} style={styles.tableRow}>
                <div>{row.txn_date}</div>
                <div>{row.txn_type} / {row.doc_no}</div>
                <div>₹{Number(row.debit || 0).toFixed(2)}</div>
                <div>₹{Number(row.credit || 0).toFixed(2)}</div>
                <div><b>₹{Number(row.running_balance || 0).toFixed(2)}</b></div>
              </div>
            ))}

            <div style={styles.tableRow}>
              <div>-</div>
              <div><b>Closing</b></div>
              <div>-</div>
              <div>-</div>
              <div><b>₹{Number(data.closing_balance || 0).toFixed(2)}</b></div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default PartyLedgerPage;