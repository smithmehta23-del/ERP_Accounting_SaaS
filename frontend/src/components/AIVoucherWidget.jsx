import React, { useEffect, useState } from "react";
import API from "../api";

const styles = {
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 4px 18px rgba(15,23,42,0.05)",
  },
  title: {
    fontSize: 24,
    fontWeight: 800,
    color: "#0f172a",
    margin: 0,
  },
  sub: {
    marginTop: 6,
    color: "#64748b",
    fontSize: 14,
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: "#334155",
    marginBottom: 8,
    display: "block",
  },
  textarea: {
    width: "100%",
    minHeight: 130,
    border: "1px solid #cbd5e1",
    borderRadius: 16,
    padding: 14,
    fontSize: 14,
    resize: "vertical",
    boxSizing: "border-box",
  },
  input: {
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    padding: "12px 14px",
    fontSize: 14,
    background: "#fff",
    marginTop: 8,
  },
  btnRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 14,
  },
  btn: {
    background: "#0f172a",
    color: "#fff",
    border: "none",
    borderRadius: 14,
    padding: "12px 16px",
    fontWeight: 600,
    cursor: "pointer",
  },
  outlineBtn: {
    background: "#fff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    padding: "12px 16px",
    fontWeight: 600,
    cursor: "pointer",
  },
  tableWrap: {
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    overflow: "hidden",
    marginTop: 16,
  },
  tableHead: {
    display: "grid",
    gridTemplateColumns: "1.4fr 0.6fr 0.8fr 1.2fr 0.7fr",
    padding: "14px 16px",
    background: "#f8fafc",
    fontSize: 12,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "1.4fr 0.6fr 0.8fr 1.2fr 0.7fr",
    padding: "14px 16px",
    borderTop: "1px solid #e2e8f0",
    fontSize: 14,
    alignItems: "center",
  },
  badge: (ok) => ({
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    background: ok ? "#dcfce7" : "#fee2e2",
    color: ok ? "#166534" : "#991b1b",
  }),
};

function AIVoucherWidget() {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [voucherDate, setVoucherDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const parseWithAIText = async (inputText) => {
    const clean = String(inputText || "").trim();
    if (!clean) return;

    setLoading(true);
    try {
      const res = await API.post("/ai/parse-voucher", { text: clean });
      setText(clean);
      setResult(res.data);
    } catch (error) {
      console.error(error);
      alert(
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        "Failed to parse voucher with AI"
      );
    } finally {
      setLoading(false);
    }
  };

  const parseWithAI = async () => {
    await parseWithAIText(text);
  };

  const createVoucher = async () => {
    if (!result) return;

    const validLines = (result.lines || []).filter(
      (x) => x.account_id && Number(x.amount) > 0
    );

    if (!validLines.length) {
      alert("No valid matched lines found.");
      return;
    }

    if (!result.balanced) {
      alert("Voucher is not balanced.");
      return;
    }

    setPosting(true);
    try {
      await API.post("/vouchers", {
        voucher_type: result.voucher_type || "JV",
        voucher_date: voucherDate,
        narration: result.narration || text,
        lines: validLines.map((line, idx) => ({
          line_no: idx + 1,
          account_id: line.account_id,
          dc: line.dc,
          amount: Number(line.amount),
          line_narration: line.line_narration || "",
        })),
      });

      alert("Voucher created successfully ✅");
      setText("");
      setResult(null);
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.message || "Voucher creation failed");
    } finally {
      setPosting(false);
    }
  };

  useEffect(() => {
    const pending = sessionStorage.getItem("erp_ai_command");
    if (pending) {
      sessionStorage.removeItem("erp_ai_command");
      parseWithAIText(pending);
    }

    const handleAiCommand = (event) => {
      const cmd = event.detail;
      parseWithAIText(cmd);
    };

    window.addEventListener("erp-ai-command", handleAiCommand);

    return () => {
      window.removeEventListener("erp-ai-command", handleAiCommand);
    };
  }, []);

  return (
    <div style={styles.card}>
      <h3 style={styles.title}>AI Voucher Assistant</h3>
      <div style={styles.sub}>
        Type a transaction in plain English and create voucher instantly.
      </div>

      <label style={styles.label}>Transaction Text</label>
      <textarea
        style={styles.textarea}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Examples:
Paid 2000 by bank
Paid office rent 5000 by bank
Received 25000 from ABC Traders
Bought stationery for 1200 cash`}
      />

      <div style={{ marginTop: 14 }}>
        <label style={styles.label}>Voucher Date</label>
        <input
          type="date"
          value={voucherDate}
          onChange={(e) => setVoucherDate(e.target.value)}
          style={styles.input}
        />
      </div>

      <div style={styles.btnRow}>
        <button style={styles.btn} onClick={parseWithAI} disabled={loading}>
          {loading ? "Parsing..." : "Parse with AI"}
        </button>

        {result ? (
          <button
            style={styles.outlineBtn}
            onClick={createVoucher}
            disabled={posting}
          >
            {posting ? "Posting..." : "Create Voucher"}
          </button>
        ) : null}
      </div>

      {result ? (
        <>
          <div style={{ marginTop: 16 }}>
            <b>Voucher Type:</b> {result.voucher_type}
          </div>
          <div style={{ marginTop: 8 }}>
            <b>Narration:</b> {result.narration}
          </div>
          <div style={{ marginTop: 8 }}>
            <b>Confidence:</b> {Number(result.confidence || 0).toFixed(2)}
          </div>
          <div style={{ marginTop: 8 }}>
            <span style={styles.badge(result.balanced)}>
              {result.balanced ? "Balanced" : "Not Balanced"}
            </span>
          </div>
          <div style={{ marginTop: 8 }}>
            <b>Debit:</b> ₹{Number(result.debit_total || 0).toFixed(2)} |{" "}
            <b>Credit:</b> ₹{Number(result.credit_total || 0).toFixed(2)}
          </div>

          <div style={styles.tableWrap}>
            <div style={styles.tableHead}>
              <div>Account</div>
              <div>DC</div>
              <div>Amount</div>
              <div>Narration</div>
              <div>Match</div>
            </div>

            {(result.lines || []).map((line, idx) => (
              <div key={idx} style={styles.tableRow}>
                <div>{line.account_name}</div>
                <div>{line.dc}</div>
                <div>₹{Number(line.amount || 0).toFixed(2)}</div>
                <div>{line.line_narration}</div>
                <div>
                  <span style={styles.badge(line.matched)}>
                    {line.matched ? "Matched" : "No Match"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

export default AIVoucherWidget;