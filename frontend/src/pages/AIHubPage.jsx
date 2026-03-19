import React from "react";
import { useNavigate } from "react-router-dom";

const cardStyle = {
  padding: 20,
  borderRadius: 16,
  border: "1px solid #e2e8f0",
  background: "#fff",
  cursor: "pointer",
  flex: 1,
  minWidth: 220,
};

function AIHubPage() {
  const navigate = useNavigate();

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>🤖 AI Center</h1>
      <p style={{ color: "#64748b", marginBottom: 20 }}>
        All AI automation tools in one place
      </p>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        
        {/* AI Voucher */}
        <div style={cardStyle} onClick={() => navigate("/vouchers")}>
          <h3>🧾 AI Voucher</h3>
          <p>Create vouchers using AI</p>
        </div>

        {/* AI Invoice */}
        <div style={cardStyle} onClick={() => navigate("/ai-invoice-intake")}>
          <h3>📄 AI Invoice</h3>
          <p>Scan invoice & auto create entry</p>
        </div>

        {/* AI Bank */}
        <div style={cardStyle} onClick={() => navigate("/bank-ai")}>
          <h3>🏦 AI Bank Reconciliation</h3>
          <p>Auto match bank transactions</p>
        </div>

        {/* AI Search */}
        <div style={cardStyle} onClick={() => alert("AI Search Coming Soon")}>
          <h3>🔍 AI Assistant</h3>
          <p>Ask anything about your data</p>
        </div>

      </div>
    </div>
  );
}

export default AIHubPage;