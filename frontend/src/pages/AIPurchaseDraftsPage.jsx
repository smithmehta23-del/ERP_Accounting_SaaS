import React, { useEffect, useState } from "react";
import API from "../api";

const styles = {
  title: { fontSize: 30, fontWeight: 700, marginBottom: 8 },
  sub: { color: "#64748b", marginBottom: 24 },
  layout: { display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 24 },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 4px 18px rgba(15,23,42,0.05)",
  },
  field: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: 600, color: "#334155" },
  input: { border: "1px solid #cbd5e1", borderRadius: 14, padding: "12px 14px", fontSize: 14, background: "#fff" },
  btn: { background: "#0f172a", color: "#fff", border: "none", borderRadius: 14, padding: "11px 15px", fontWeight: 600, cursor: "pointer", marginRight: 8, marginTop: 8 },
  outlineBtn: { background: "#fff", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: 14, padding: "11px 15px", fontWeight: 600, cursor: "pointer", marginRight: 8, marginTop: 8 },
  tableWrap: { border: "1px solid #e2e8f0", borderRadius: 18, overflow: "hidden", marginTop: 16 },
  tableHead: { display: "grid", gridTemplateColumns: "1fr 1fr 0.9fr 0.9fr", padding: "14px 16px", background: "#f8fafc", fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" },
  tableRow: { display: "grid", gridTemplateColumns: "1fr 1fr 0.9fr 0.9fr", padding: "14px 16px", borderTop: "1px solid #e2e8f0", fontSize: 14, alignItems: "center" },
};

function AIPurchaseDraftsPage() {
  const [drafts, setDrafts] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [parties, setParties] = useState([]);
  const [items, setItems] = useState([]);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [draftRes, partyRes, itemRes] = await Promise.all([
      API.get("/ai/purchase-drafts"),
      API.get("/parties"),
      API.get("/items"),
    ]);
    setDrafts(draftRes.data || []);
    setParties((partyRes.data || []).filter((p) => p.party_type === "VENDOR" || p.party_type === "BOTH"));
    setItems(itemRes.data || []);
  };

  const loadDetail = async (id) => {
    if (!id) return;
    const res = await API.get(`/ai/purchase-drafts/${id}`);
    setDetail(res.data);
  };

  const updateLine = (index, patch) => {
    setDetail((prev) => ({
      ...prev,
      lines: prev.lines.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    }));
  };

  const saveDraft = async () => {
    if (!detail) return;

    await API.post(`/ai/purchase-drafts/${detail.header.id}/update`, {
      party_id: detail.header.party_id,
      invoice_no: detail.header.invoice_no,
      invoice_date: detail.header.invoice_date,
      lines: detail.lines,
    });

    alert("Draft updated ✅");
    loadAll();
    loadDetail(detail.header.id);
  };

  const approveDraft = async () => {
    if (!detail) return;

    const res = await API.post(`/ai/purchase-drafts/${detail.header.id}/approve`);
    alert(res.data?.message || "Approved ✅");
    loadAll();
    loadDetail(detail.header.id);
  };

  return (
    <div>
      <div style={styles.title}>AI Purchase Drafts</div>
      <div style={styles.sub}>Review AI-created purchase invoice drafts before posting to accounting.</div>

      <div style={styles.layout}>
        <div style={styles.card}>
          <h3>Draft Register</h3>

          <div style={styles.field}>
            <label style={styles.label}>Select Draft</label>
            <select
              style={styles.input}
              value={selectedId}
              onChange={(e) => {
                setSelectedId(e.target.value);
                loadDetail(e.target.value);
              }}
            >
              <option value="">Select draft</option>
              {drafts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.invoice_no || "No Invoice No"} | {d.party_name || "No Party"} | {d.status}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.tableWrap}>
            <div style={styles.tableHead}>
              <div>Invoice</div>
              <div>Party</div>
              <div>Total</div>
              <div>Status</div>
            </div>

            {drafts.map((row) => (
              <div key={row.id} style={styles.tableRow}>
                <div>{row.invoice_no || "-"}</div>
                <div>{row.party_name || "-"}</div>
                <div>₹{Number(row.total_amount || 0).toFixed(2)}</div>
                <div>{row.status}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.card}>
          {!detail ? (
            <div>Select a draft to review.</div>
          ) : (
            <>
              <h3>Review Draft</h3>

              <div style={styles.field}>
                <label style={styles.label}>Vendor</label>
                <select
                  style={styles.input}
                  value={detail.header.party_id || ""}
                  onChange={(e) =>
                    setDetail((prev) => ({
                      ...prev,
                      header: { ...prev.header, party_id: e.target.value },
                    }))
                  }
                >
                  <option value="">Select vendor</option>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.party_code} - {p.party_name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Invoice No</label>
                <input
                  style={styles.input}
                  value={detail.header.invoice_no || ""}
                  onChange={(e) =>
                    setDetail((prev) => ({
                      ...prev,
                      header: { ...prev.header, invoice_no: e.target.value },
                    }))
                  }
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Invoice Date</label>
                <input
                  type="date"
                  style={styles.input}
                  value={detail.header.invoice_date || ""}
                  onChange={(e) =>
                    setDetail((prev) => ({
                      ...prev,
                      header: { ...prev.header, invoice_date: e.target.value },
                    }))
                  }
                />
              </div>

              <div style={styles.tableWrap}>
                <div style={styles.tableHead}>
                  <div>Description</div>
                  <div>Item Match</div>
                  <div>Qty / Rate</div>
                  <div>Amount</div>
                </div>

                {detail.lines.map((line, idx) => (
                  <div key={line.id} style={styles.tableRow}>
                    <div>
                      <input
                        style={styles.input}
                        value={line.item_description || ""}
                        onChange={(e) => updateLine(idx, { item_description: e.target.value })}
                      />
                    </div>

                    <div>
                      <select
                        style={styles.input}
                        value={line.matched_item_id || ""}
                        onChange={(e) => updateLine(idx, { matched_item_id: e.target.value || null })}
                      >
                        <option value="">No match</option>
                        {items.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.item_code} - {item.item_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <input
                          type="number"
                          step="0.001"
                          style={styles.input}
                          value={line.qty}
                          onChange={(e) => updateLine(idx, { qty: e.target.value })}
                        />
                        <input
                          type="number"
                          step="0.01"
                          style={styles.input}
                          value={line.rate}
                          onChange={(e) => updateLine(idx, { rate: e.target.value })}
                        />
                      </div>
                    </div>

                    <div>
                      <input
                        type="number"
                        step="0.01"
                        style={styles.input}
                        value={line.amount}
                        onChange={(e) => updateLine(idx, { amount: e.target.value })}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 14 }}>
                <button style={styles.outlineBtn} onClick={saveDraft}>Save Draft</button>
                <button style={styles.btn} onClick={approveDraft}>Approve & Create Purchase Invoice</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default AIPurchaseDraftsPage;