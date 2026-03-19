import React, { useEffect, useMemo, useState } from "react";
import API from "../api";
import { useNavigate } from "react-router-dom";

const styles = {
  title: { fontSize: 30, fontWeight: 700, marginBottom: 8 },
  sub: { color: "#64748b", marginBottom: 24 },

  topGrid: {
    display: "grid",
    gridTemplateColumns: "1.15fr 0.85fr",
    gap: 24,
    marginBottom: 24,
  },

  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 4px 18px rgba(15,23,42,0.05)",
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 14,
    color: "#0f172a",
  },

  fieldGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 14,
    marginBottom: 16,
  },

  field: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  label: {
    fontSize: 13,
    fontWeight: 600,
    color: "#334155",
  },

  input: {
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    padding: "12px 14px",
    fontSize: 14,
    background: "#fff",
    outline: "none",
  },

  toolbar: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: 16,
  },

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

  dangerBtn: {
    background: "#fff",
    color: "#991b1b",
    border: "1px solid #fecaca",
    borderRadius: 12,
    padding: "8px 12px",
    fontWeight: 700,
    cursor: "pointer",
  },

  modeBtn: (active) => ({
    background: active ? "#0f172a" : "#fff",
    color: active ? "#fff" : "#0f172a",
    border: active ? "1px solid #0f172a" : "1px solid #cbd5e1",
    borderRadius: 14,
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
  }),

  lineTableWrap: {
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    overflow: "hidden",
    marginTop: 8,
  },

  lineHead: {
    display: "grid",
    gridTemplateColumns: "1.35fr 0.7fr 0.7fr 0.7fr 0.7fr 0.8fr 0.8fr 0.8fr 0.85fr 0.7fr",
    padding: "14px 12px",
    background: "#f8fafc",
    fontSize: 11,
    fontWeight: 800,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    alignItems: "center",
  },

  lineRow: {
    display: "grid",
    gridTemplateColumns: "1.35fr 0.7fr 0.7fr 0.7fr 0.7fr 0.8fr 0.8fr 0.8fr 0.85fr 0.7fr",
    gap: 8,
    padding: "12px",
    borderTop: "1px solid #e2e8f0",
    alignItems: "center",
  },

  smallInput: {
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "10px 10px",
    fontSize: 13,
    background: "#fff",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },

  readonlyCell: {
    padding: "10px 6px",
    fontSize: 13,
    color: "#0f172a",
    fontWeight: 600,
  },

  totalsCard: {
    display: "grid",
    gap: 12,
  },

  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    padding: "12px 14px",
    borderRadius: 16,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },

  totalLabel: {
    fontSize: 14,
    color: "#475569",
    fontWeight: 600,
  },

  totalValue: {
    fontSize: 18,
    color: "#0f172a",
    fontWeight: 800,
  },

  grandTotalRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    padding: "16px 16px",
    borderRadius: 18,
    background: "#0f172a",
    color: "#fff",
    marginTop: 6,
  },

  statGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 14,
    marginBottom: 18,
  },

  statCard: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 16,
  },

  tableWrap: {
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    overflow: "hidden",
  },

  tableHead: {
    display: "grid",
    gridTemplateColumns: "1fr 1.2fr 0.9fr 0.9fr 0.8fr",
    padding: "14px 16px",
    background: "#f8fafc",
    fontSize: 12,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
  },

  tableRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1.2fr 0.9fr 0.9fr 0.8fr",
    padding: "14px 16px",
    borderTop: "1px solid #e2e8f0",
    fontSize: 14,
    alignItems: "center",
  },

  badge: (status) => ({
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    background:
      status === "POSTED"
        ? "#dcfce7"
        : status === "CANCELLED"
          ? "#fee2e2"
          : "#e2e8f0",
    color:
      status === "POSTED"
        ? "#166534"
        : status === "CANCELLED"
          ? "#991b1b"
          : "#334155",
  }),

  note: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 10,
  },

  success: {
    color: "#166534",
    background: "#dcfce7",
    border: "1px solid #bbf7d0",
    borderRadius: 12,
    padding: "10px 12px",
    fontSize: 14,
    marginBottom: 16,
  },

  error: {
    color: "#991b1b",
    background: "#fee2e2",
    border: "1px solid #fecaca",
    borderRadius: 12,
    padding: "10px 12px",
    fontSize: 14,
    marginBottom: 16,
  },
};

const emptyLine = () => ({
  item_id: "",
  qty: 1,
  rate: "",
  tax_percent: "",
  description_text: "",
});

function money(value) {
  return `₹${Number(value || 0).toFixed(2)}`;
}

function InvoicesPage() {
  const [mode, setMode] = useState("SALES");
  const [parties, setParties] = useState([]);
  const [items, setItems] = useState([]);
  const [salesInvoices, setSalesInvoices] = useState([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const [header, setHeader] = useState({
    party_id: "",
    invoice_no: "",
    invoice_date: new Date().toISOString().slice(0, 10),
  });

  const [lines, setLines] = useState([emptyLine()]);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    await Promise.all([
      loadParties(),
      loadItems(),
      loadSales(),
      loadPurchases(),
    ]);
  };

  const loadParties = async () => {
    const res = await API.get("/parties");
    setParties(res.data || []);
  };

  const loadItems = async () => {
    const res = await API.get("/items");
    setItems((res.data || []).filter((x) => Number(x.is_active) === 1));
  };

  const loadSales = async () => {
    const res = await API.get("/sales-invoices");
    setSalesInvoices(res.data || []);
  };

  const loadPurchases = async () => {
    const res = await API.get("/purchase-invoices");
    setPurchaseInvoices(res.data || []);
  };

  const availableParties = useMemo(() => {
    return parties.filter((p) =>
      mode === "SALES"
        ? p.party_type === "CUSTOMER" || p.party_type === "BOTH"
        : p.party_type === "VENDOR" || p.party_type === "BOTH"
    );
  }, [mode, parties]);

  const onModeChange = (newMode) => {
    setMode(newMode);
    setHeader({
      party_id: "",
      invoice_no: "",
      invoice_date: new Date().toISOString().slice(0, 10),
    });
    setLines([emptyLine()]);
    setMessage("");
    setError("");
  };

  const addLine = () => {
    setLines((prev) => [...prev, emptyLine()]);
  };

  const removeLine = (index) => {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const updateLine = (index, patch) => {
    setLines((prev) =>
      prev.map((line, i) => {
        if (i !== index) return line;

        const merged = { ...line, ...patch };

        if (patch.item_id !== undefined) {
          const item = items.find((x) => Number(x.id) === Number(patch.item_id));
          if (item) {
            merged.rate =
              mode === "SALES"
                ? Number(item.sales_rate || 0)
                : Number(item.purchase_rate || 0);
            merged.tax_percent = Number(item.tax_percent || 0);
            merged.description_text = item.item_name || "";
          }
        }

        return merged;
      })
    );
  };

  const computedLines = useMemo(() => {
    return lines.map((line) => {
      const qty = Number(line.qty || 0);
      const rate = Number(line.rate || 0);
      const taxPercent = Number(line.tax_percent || 0);
      const taxable_amount = Number((qty * rate).toFixed(2));
      const cgst_amount = Number((((taxable_amount * taxPercent) / 100) / 2).toFixed(2));
      const sgst_amount = Number((((taxable_amount * taxPercent) / 100) / 2).toFixed(2));
      const igst_amount = 0;
      const line_total = Number(
        (taxable_amount + cgst_amount + sgst_amount + igst_amount).toFixed(2)
      );

      const selectedItem = items.find((x) => Number(x.id) === Number(line.item_id));

      return {
        ...line,
        selectedItem,
        qty,
        rate,
        tax_percent: taxPercent,
        taxable_amount,
        cgst_amount,
        sgst_amount,
        igst_amount,
        line_total,
      };
    });
  }, [lines, items]);

  const totals = useMemo(() => {
    return computedLines.reduce(
      (acc, line) => {
        acc.taxable += Number(line.taxable_amount || 0);
        acc.cgst += Number(line.cgst_amount || 0);
        acc.sgst += Number(line.sgst_amount || 0);
        acc.igst += Number(line.igst_amount || 0);
        acc.total += Number(line.line_total || 0);
        return acc;
      },
      { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 }
    );
  }, [computedLines]);

  const postInvoice = async () => {
    try {
      setError("");
      setMessage("");

      if (!header.party_id || !header.invoice_no || !header.invoice_date) {
        setError("Party, invoice number, and invoice date are required.");
        return;
      }

      const validLines = computedLines.filter(
        (x) => x.item_id && Number(x.qty) > 0 && Number(x.rate) >= 0
      );

      if (!validLines.length) {
        setError("Add at least one valid line item.");
        return;
      }

      const payload = {
        party_id: Number(header.party_id),
        invoice_no: header.invoice_no,
        invoice_date: header.invoice_date,
        lines: validLines.map((x) => ({
          item_id: Number(x.item_id),
          qty: Number(x.qty),
          rate: Number(x.rate),
          tax_percent: Number(x.tax_percent || 0),
          description_text: x.description_text || "",
        })),
      };

      const endpoint = mode === "SALES" ? "/sales-invoices" : "/purchase-invoices";
      const res = await API.post(endpoint, payload);

      setMessage(res.data?.message || "Invoice posted successfully.");
      setHeader({
        party_id: "",
        invoice_no: "",
        invoice_date: new Date().toISOString().slice(0, 10),
      });
      setLines([emptyLine()]);

      if (mode === "SALES") {
        await loadSales();
      } else {
        await loadPurchases();
      }
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Failed to post invoice"
      );
    }
  };

  const activeList = mode === "SALES" ? salesInvoices : purchaseInvoices;

  const stats = useMemo(() => {
    const totalCount = activeList.length;
    const postedCount = activeList.filter((x) => x.status === "POSTED").length;
    const cancelledCount = activeList.filter((x) => x.status === "CANCELLED").length;
    const totalValue = activeList.reduce((s, x) => s + Number(x.amount || 0), 0);

    return {
      totalCount,
      postedCount,
      cancelledCount,
      totalValue,
    };
  }, [activeList]);

  return (
    <div>
      <div style={styles.title}>Line-Item Invoice Entry</div>
      <div style={styles.sub}>
        Create professional sales and purchase invoices using item rows, automatic tax calculation, and ERP-style totals.
      </div>

      {message ? <div style={styles.success}>{message}</div> : null}
      {error ? <div style={styles.error}>{error}</div> : null}

      <div style={styles.toolbar}>
        <button
          style={styles.modeBtn(mode === "SALES")}
          onClick={() => onModeChange("SALES")}
        >
          Sales Invoice
        </button>
        <button
          style={styles.modeBtn(mode === "PURCHASE")}
          onClick={() => onModeChange("PURCHASE")}
        >
          Purchase Invoice
        </button>
      </div>

      <div style={styles.topGrid}>
        <div style={styles.card}>
          <div style={styles.sectionTitle}>
            {mode === "SALES" ? "Sales Invoice Header" : "Purchase Invoice Header"}
          </div>

          <div style={styles.fieldGrid}>
            <div style={styles.field}>
              <label style={styles.label}>
                {mode === "SALES" ? "Customer" : "Vendor"}
              </label>
              <select
                style={styles.input}
                value={header.party_id}
                onChange={(e) =>
                  setHeader((prev) => ({ ...prev, party_id: e.target.value }))
                }
              >
                <option value="">
                  Select {mode === "SALES" ? "Customer" : "Vendor"}
                </option>
                {availableParties.map((p) => (
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
                value={header.invoice_no}
                onChange={(e) =>
                  setHeader((prev) => ({ ...prev, invoice_no: e.target.value }))
                }
                placeholder={mode === "SALES" ? "SI-0001" : "PI-0001"}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Invoice Date</label>
              <input
                type="date"
                style={styles.input}
                value={header.invoice_date}
                onChange={(e) =>
                  setHeader((prev) => ({ ...prev, invoice_date: e.target.value }))
                }
              />
            </div>
          </div>

          <div style={styles.sectionTitle} style={{ ...styles.sectionTitle, marginTop: 10 }}>
            Invoice Lines
          </div>

          <div style={styles.toolbar}>
            <button style={styles.btn} onClick={addLine}>
              Add Line
            </button>
            <button
              style={styles.outlineBtn}
              onClick={() => setLines([emptyLine()])}
            >
              Reset Lines
            </button>
          </div>

          <div style={styles.lineTableWrap}>
            <div style={styles.lineHead}>
              <div>Item</div>
              <div>Qty</div>
              <div>Rate</div>
              <div>Tax %</div>
              <div>Unit</div>
              <div>Taxable</div>
              <div>CGST</div>
              <div>SGST</div>
              <div>Line Total</div>
              <div>Action</div>
            </div>

            {computedLines.map((line, index) => (
              <div key={index} style={styles.lineRow}>
                <div>
                  <select
                    style={styles.smallInput}
                    value={line.item_id}
                    onChange={(e) => updateLine(index, { item_id: e.target.value })}
                  >
                    <option value="">Select item</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.item_code} - {item.item_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    style={styles.smallInput}
                    value={line.qty}
                    onChange={(e) => updateLine(index, { qty: e.target.value })}
                  />
                </div>

                <div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    style={styles.smallInput}
                    value={line.rate}
                    onChange={(e) => updateLine(index, { rate: e.target.value })}
                  />
                </div>

                <div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    style={styles.smallInput}
                    value={line.tax_percent}
                    onChange={(e) =>
                      updateLine(index, { tax_percent: e.target.value })
                    }
                  />
                </div>

                <div style={styles.readonlyCell}>
                  {line.selectedItem?.unit || "-"}
                </div>

                <div style={styles.readonlyCell}>{money(line.taxable_amount)}</div>
                <div style={styles.readonlyCell}>{money(line.cgst_amount)}</div>
                <div style={styles.readonlyCell}>{money(line.sgst_amount)}</div>
                <div style={{ ...styles.readonlyCell, fontWeight: 800 }}>
                  {money(line.line_total)}
                </div>

                <div>
                  <button
                    style={styles.dangerBtn}
                    onClick={() => removeLine(index)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={styles.note}>
            Tax is currently split as CGST + SGST based on item tax %. IGST is kept at zero in this screen.
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.sectionTitle}>Invoice Totals</div>

          <div style={styles.totalsCard}>
            <div style={styles.totalRow}>
              <div style={styles.totalLabel}>Taxable Amount</div>
              <div style={styles.totalValue}>{money(totals.taxable)}</div>
            </div>

            <div style={styles.totalRow}>
              <div style={styles.totalLabel}>CGST</div>
              <div style={styles.totalValue}>{money(totals.cgst)}</div>
            </div>

            <div style={styles.totalRow}>
              <div style={styles.totalLabel}>SGST</div>
              <div style={styles.totalValue}>{money(totals.sgst)}</div>
            </div>

            <div style={styles.totalRow}>
              <div style={styles.totalLabel}>IGST</div>
              <div style={styles.totalValue}>{money(totals.igst)}</div>
            </div>

            <div style={styles.grandTotalRow}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Grand Total</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>
                {money(totals.total)}
              </div>
            </div>

            <button style={styles.btn} onClick={postInvoice}>
              Post {mode === "SALES" ? "Sales" : "Purchase"} Invoice
            </button>
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>
          {mode === "SALES" ? "Sales Invoice Register" : "Purchase Invoice Register"}
        </div>

        <div style={styles.statGrid}>
          <div style={styles.statCard}>
            <div style={{ color: "#64748b", fontSize: 13 }}>Total Invoices</div>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>
              {stats.totalCount}
            </div>
          </div>
          <div style={styles.statCard}>
            <div style={{ color: "#64748b", fontSize: 13 }}>Posted</div>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>
              {stats.postedCount}
            </div>
          </div>
          <div style={styles.statCard}>
            <div style={{ color: "#64748b", fontSize: 13 }}>Cancelled</div>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>
              {stats.cancelledCount}
            </div>
          </div>
          <div style={styles.statCard}>
            <div style={{ color: "#64748b", fontSize: 13 }}>Invoice Value</div>
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6 }}>
              {money(stats.totalValue)}
            </div>
          </div>
        </div>

        <div style={styles.tableWrap}>
          <div style={styles.tableHead}>
            <div>Invoice No</div>
            <div>Party</div>
            <div>Date</div>
            <div>Total</div>
            <div>Status</div>
          </div>

          {activeList.map((row) => (
            <div key={row.id} style={styles.tableRow}>
              <div>
                <button
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    color: "#1d4ed8",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  onClick={() =>
                    navigate(`/invoices/${row.id}?type=${mode === "SALES" ? "sales" : "purchase"}`)
                  }
                >
                  {row.invoice_no}
                </button>
              </div>
              <div>{row.party_name}</div>
              <div>{row.invoice_date}</div>
              <div>{money(row.amount)}</div>
              <div>
                <span style={styles.badge(row.status)}>{row.status}</span>
              </div>
            </div>
          ))}

          {activeList.length === 0 ? (
            <div style={{ padding: 16 }}>No invoices found.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default InvoicesPage;