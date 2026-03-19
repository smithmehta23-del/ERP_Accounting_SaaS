import React, { useState } from "react";
import API from "../api";

const styles = {
  title: { fontSize: 30, fontWeight: 700, marginBottom: 8 },
  sub: { color: "#64748b", marginBottom: 24 },
  layout: { display: "grid", gridTemplateColumns: "0.95fr 1.05fr", gap: 24 },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 4px 18px rgba(15,23,42,0.05)",
  },
  label: { fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 8, display: "block" },
  textarea: {
    width: "100%",
    minHeight: 180,
    border: "1px solid #cbd5e1",
    borderRadius: 16,
    padding: 14,
    fontSize: 14,
    resize: "vertical",
    boxSizing: "border-box",
  },
  btn: {
    background: "#0f172a",
    color: "#fff",
    border: "none",
    borderRadius: 14,
    padding: "12px 16px",
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 14,
  },
  outlineBtn: {
    background: "#fff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    padding: "12px 16px",
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 14,
    marginLeft: 10,
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

function AIVoucherPage() {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().slice(0, 10));

  const parseWithAI = async () => {
    setLoading(true);
    try {
      const res = await API.post("/ai/parse-voucher", { text });
      setResult(res.data);
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.message || "AI parse failed");
    } finally {
      setLoading(false);
    }
  };

  const createVoucher = async () => {
    if (!result) return;

    const validLines = (result.lines || []).filter((x) => x.account_id && Number(x.amount) > 0);
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

  return (
    <div>
      <div style={styles.title}>AI Voucher Assistant</div>
      <div style={styles.sub}>
        Type a transaction in plain English and let AI suggest the accounting entry.
      </div>

      <div style={styles.layout}>
        <div style={styles.card}>
          <label style={styles.label}>Transaction Text</label>
          <textarea
            style={styles.textarea}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='Examples:
Paid ₹5,000 rent by bank
Received ₹25,000 from ABC Traders
Bought office stationery for ₹1,200 cash'
          />

          <div style={{ marginTop: 14 }}>
            <label style={styles.label}>Voucher Date</label>
            <input
              type="date"
              value={voucherDate}
              onChange={(e) => setVoucherDate(e.target.value)}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 14,
                padding: "12px 14px",
                fontSize: 14,
              }}
            />
          </div>

          <button style={styles.btn} onClick={parseWithAI} disabled={loading}>
            {loading ? "Parsing..." : "Parse with AI"}
          </button>

          {result ? (
            <button style={styles.outlineBtn} onClick={createVoucher} disabled={posting}>
              {posting ? "Posting..." : "Create Voucher"}
            </button>
          ) : null}
        </div>

        <div style={styles.card}>
          <h3 style={{ marginTop: 0 }}>AI Suggestion</h3>

          {!result ? (
            <div style={{ color: "#64748b" }}>No suggestion yet.</div>
          ) : (
            <>
              <div style={{ marginBottom: 10 }}>
                <b>Voucher Type:</b> {result.voucher_type}
              </div>
              <div style={{ marginBottom: 10 }}>
                <b>Narration:</b> {result.narration}
              </div>
              <div style={{ marginBottom: 10 }}>
                <b>Confidence:</b> {Number(result.confidence || 0).toFixed(2)}
              </div>
              <div style={{ marginBottom: 10 }}>
                <span style={styles.badge(result.balanced)}>
                  {result.balanced ? "Balanced" : "Not Balanced"}
                </span>
              </div>
              <div style={{ marginBottom: 10 }}>
                <b>Debit Total:</b> ₹{Number(result.debit_total || 0).toFixed(2)} |{" "}
                <b>Credit Total:</b> ₹{Number(result.credit_total || 0).toFixed(2)}
              </div>

              {result.notes?.length ? (
                <div style={{ marginBottom: 14 }}>
                  <b>Notes:</b>
                  <ul>
                    {result.notes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

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
          )}
        </div>
      </div>
    </div>
  );
}

export default AIVoucherPage;