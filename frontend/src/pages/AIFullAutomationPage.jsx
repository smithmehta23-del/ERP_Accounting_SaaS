import React, { useState } from "react";
import API from "../api";

const styles = {
  page: { maxWidth: 980 },
  title: { fontSize: 30, fontWeight: 700, marginBottom: 8 },
  sub: { color: "#64748b", marginBottom: 24 },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 4px 18px rgba(15,23,42,0.05)",
    marginBottom: 20,
  },
  input: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    padding: "12px 14px",
    fontSize: 14,
    boxSizing: "border-box",
  },
  btn: {
    background: "#0f172a",
    color: "#fff",
    border: "none",
    borderRadius: 14,
    padding: "11px 16px",
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 14,
  },
  success: {
    padding: 12,
    borderRadius: 14,
    background: "#dcfce7",
    border: "1px solid #86efac",
    color: "#166534",
    marginBottom: 16,
  },
  error: {
    padding: 12,
    borderRadius: 14,
    background: "#fee2e2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    marginBottom: 16,
  },
  jsonBox: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 14,
    fontFamily: "monospace",
    fontSize: 12,
    whiteSpace: "pre-wrap",
    overflow: "auto",
  },
};

function AIFullAutomationPage() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const runAutomation = async () => {
    if (!file) {
      alert("Please choose invoice file first.");
      return;
    }

    const formData = new FormData();
    formData.append("document", file);

    setLoading(true);
    setResult(null);
    setErrorMessage("");

    try {
      const res = await API.post("/ai/full-automation/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(res.data || null);
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error?.response?.data?.error ||
          error?.response?.data?.message ||
          "AI automation failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.title}>AI Full Automation</div>
      <div style={styles.sub}>
        Upload invoice and let AI create party, items, purchase invoice, and voucher automatically.
      </div>

      <div style={styles.card}>
        <input
          type="file"
          accept="image/*,.pdf"
          style={styles.input}
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />

        <button style={styles.btn} onClick={runAutomation} disabled={loading}>
          {loading ? "Running AI Automation..." : "Upload & Automate"}
        </button>
      </div>

      {errorMessage ? <div style={styles.error}>{errorMessage}</div> : null}

      {result ? (
        <div style={styles.card}>
          <div style={styles.success}>{result.message}</div>
          <div style={{ marginBottom: 8 }}><b>Status:</b> {result.status}</div>
          <div style={{ marginBottom: 8 }}><b>Party:</b> {result.party?.party_name || "-"}</div>
          <div style={{ marginBottom: 8 }}><b>Party Created:</b> {result.party_created ? "YES" : "NO"}</div>
          <div style={{ marginBottom: 8 }}><b>Purchase Invoice ID:</b> {result.purchase_invoice_id || "-"}</div>
          <div style={{ marginBottom: 8 }}><b>Voucher ID:</b> {result.voucher_id || "-"}</div>
          <div style={{ marginBottom: 8 }}><b>Voucher No:</b> {result.voucher_no || "-"}</div>

          <h3>Extracted Data</h3>
          <div style={styles.jsonBox}>
            {JSON.stringify(result.extracted || {}, null, 2)}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default AIFullAutomationPage;