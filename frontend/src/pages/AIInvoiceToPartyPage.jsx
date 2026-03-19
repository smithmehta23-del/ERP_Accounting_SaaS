import React, { useState } from "react";
import API from "../api";

const styles = {
  page: {
    maxWidth: 900,
  },
  title: {
    fontSize: 30,
    fontWeight: 700,
    marginBottom: 8,
    color: "#0f172a",
  },
  sub: {
    color: "#64748b",
    marginBottom: 24,
  },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 4px 18px rgba(15,23,42,0.05)",
    marginBottom: 20,
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "#334155",
    marginBottom: 8,
  },
  input: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    padding: "12px 14px",
    fontSize: 14,
    background: "#fff",
    boxSizing: "border-box",
  },
  buttonRow: {
    display: "flex",
    gap: 10,
    marginTop: 16,
    flexWrap: "wrap",
  },
  btn: {
    background: "#0f172a",
    color: "#fff",
    border: "none",
    borderRadius: 14,
    padding: "11px 16px",
    fontWeight: 600,
    cursor: "pointer",
  },
  outlineBtn: {
    background: "#fff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    padding: "11px 16px",
    fontWeight: 600,
    cursor: "pointer",
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
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
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

function AIInvoiceToPartyPage() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [responseData, setResponseData] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const uploadAndCreateParty = async () => {
    if (!file) {
      alert("Please select invoice file first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    setErrorMessage("");
    setResponseData(null);

    try {
      const res = await API.post("/ai/invoice-to-party", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setResponseData(res.data || null);
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error?.response?.data?.error ||
          error?.response?.data?.message ||
          "Failed to process invoice"
      );
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setResponseData(null);
    setErrorMessage("");
  };

  return (
    <div style={styles.page}>
      <div style={styles.title}>AI Invoice to Party</div>
      <div style={styles.sub}>
        Upload invoice and let AI detect supplier/customer and create party automatically.
      </div>

      <div style={styles.card}>
        <label style={styles.label}>Invoice File</label>
        <input
          type="file"
          accept="image/*,.pdf"
          style={styles.input}
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />

        <div style={styles.buttonRow}>
          <button style={styles.btn} onClick={uploadAndCreateParty} disabled={loading}>
            {loading ? "Processing..." : "Upload & Create Party"}
          </button>

          <button style={styles.outlineBtn} onClick={resetForm}>
            Reset
          </button>
        </div>
      </div>

      {errorMessage ? <div style={styles.error}>{errorMessage}</div> : null}

      {responseData ? (
        <>
          <div style={styles.success}>{responseData.message}</div>

          <div style={styles.grid}>
            <div style={styles.card}>
              <h3 style={{ marginTop: 0 }}>Created / Matched Party</h3>
              <div><b>ID:</b> {responseData.party?.id || "-"}</div>
              <div><b>Name:</b> {responseData.party?.name || "-"}</div>
              <div><b>Type:</b> {responseData.party?.type || "-"}</div>
              <div><b>Phone:</b> {responseData.party?.phone || "-"}</div>
              <div><b>GST:</b> {responseData.party?.gst || "-"}</div>
            </div>

            <div style={styles.card}>
              <h3 style={{ marginTop: 0 }}>AI Extracted Data</h3>
              <div style={styles.jsonBox}>
                {JSON.stringify(responseData.aiData || {}, null, 2)}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default AIInvoiceToPartyPage;