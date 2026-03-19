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
  btn: { background: "#0f172a", color: "#fff", border: "none", borderRadius: 14, padding: "11px 15px", fontWeight: 600, cursor: "pointer", marginRight: 8 },
  outlineBtn: { background: "#fff", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: 14, padding: "11px 15px", fontWeight: 600, cursor: "pointer", marginRight: 8 },
  tableWrap: { border: "1px solid #e2e8f0", borderRadius: 18, overflow: "hidden", marginTop: 16 },
  tableHead: { display: "grid", gridTemplateColumns: "1fr 0.9fr 0.9fr 0.9fr", padding: "14px 16px", background: "#f8fafc", fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" },
  tableRow: { display: "grid", gridTemplateColumns: "1fr 0.9fr 0.9fr 0.9fr", padding: "14px 16px", borderTop: "1px solid #e2e8f0", fontSize: 14, alignItems: "center" },
  jsonBox: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 14,
    fontFamily: "monospace",
    fontSize: 12,
    whiteSpace: "pre-wrap",
    maxHeight: 420,
    overflow: "auto",
  },
};

function AIInvoiceIntakePage() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [intakes, setIntakes] = useState([]);

  useEffect(() => {
    loadIntakes();
  }, []);

  const loadIntakes = async () => {
    const res = await API.get("/ai/intake");
    setIntakes(res.data || []);
  };

  const uploadDocument = async () => {
    if (!file) {
      alert("Please choose a file.");
      return;
    }

    const formData = new FormData();
    formData.append("document", file);

    setUploading(true);
    try {
      const res = await API.post("/ai/intake/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(res.data);
      setFile(null);
      loadIntakes();
      alert("Document extracted successfully ✅");
    } catch (error) {
      console.error(error);
      alert(
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        "Upload failed"
      );
    } finally {
      setUploading(false);
    }
  };

  const approveDraft = async (draftId) => {
    await API.post(`/ai/party-drafts/${draftId}/approve`);
    alert("Draft party approved ✅");
    loadIntakes();
  };

  const rejectDraft = async (draftId) => {
    await API.post(`/ai/party-drafts/${draftId}/reject`);
    alert("Draft party rejected ✅");
    loadIntakes();
  };

  return (
    <div>
      <div style={styles.title}>AI Invoice Intake</div>
      <div style={styles.sub}>
        Upload supplier or customer invoice, extract data with AI, and create draft party if new.
      </div>

      <div style={styles.layout}>
        <div style={styles.card}>
          <h3>Upload Invoice / Bill</h3>

          <div style={styles.field}>
            <label style={styles.label}>Choose file</label>
            <input
              type="file"
              style={styles.input}
              accept="image/*,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>

          <button style={styles.btn} onClick={uploadDocument} disabled={uploading}>
            {uploading ? "Uploading..." : "Upload & Extract"}
          </button>

          {result ? (
            <div style={{ marginTop: 20 }}>
              <h4>Extraction Result</h4>
              <div style={styles.jsonBox}>
                {JSON.stringify(result.extracted, null, 2)}
              </div>

              {result.draft_party ? (
                <div style={{ marginTop: 14 }}>
                  <h4>Draft Party Suggested</h4>
                  <div><b>Name:</b> {result.draft_party.party_name}</div>
                  <div><b>GSTIN:</b> {result.draft_party.gstin || "-"}</div>
                  <div><b>Type:</b> {result.draft_party.party_type}</div>

                  <div style={{ marginTop: 12 }}>
                    <button style={styles.btn} onClick={() => approveDraft(result.draft_party.id)}>
                      Approve Party
                    </button>
                    <button style={styles.outlineBtn} onClick={() => rejectDraft(result.draft_party.id)}>
                      Reject Party
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div style={styles.card}>
          <h3>Recent AI Intake</h3>

          <div style={styles.tableWrap}>
            <div style={styles.tableHead}>
              <div>File</div>
              <div>Party</div>
              <div>Invoice</div>
              <div>Status</div>
            </div>

            {intakes.map((row) => (
              <div key={row.id} style={styles.tableRow}>
                <div>{row.original_filename}</div>
                <div>{row.detected_party_name || "-"}</div>
                <div>{row.detected_invoice_no || "-"}</div>
                <div>{row.status}</div>
              </div>
            ))}

            {intakes.length === 0 ? <div style={{ padding: 16 }}>No AI intake records found.</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AIInvoiceIntakePage;