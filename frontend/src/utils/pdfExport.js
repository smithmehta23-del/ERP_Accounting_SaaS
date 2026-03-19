import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function money(value) {
  return `Rs. ${Number(value || 0).toFixed(2)}`;
}

function header(doc, title, subTitle = "") {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, 14, 18);

  if (subTitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(subTitle, 14, 25);
  }

  doc.setDrawColor(220, 226, 232);
  doc.line(14, 30, 196, 30);
}

export function exportInvoicePdf({
  invoiceType,
  companyName = "ERP Accounting",
  invoice,
  lines = [],
}) {
  const doc = new jsPDF();

  header(
    doc,
    invoiceType === "SALES" ? "Sales Invoice" : "Purchase Invoice",
    companyName
  );

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Invoice No:", 14, 40);
  doc.setFont("helvetica", "normal");
  doc.text(String(invoice.invoice_no || "-"), 45, 40);

  doc.setFont("helvetica", "bold");
  doc.text("Invoice Date:", 110, 40);
  doc.setFont("helvetica", "normal");
  doc.text(String(invoice.invoice_date || "-"), 145, 40);

  doc.setFont("helvetica", "bold");
  doc.text(invoiceType === "SALES" ? "Customer:" : "Vendor:", 14, 48);
  doc.setFont("helvetica", "normal");
  doc.text(
    `${invoice.party_code || ""} ${invoice.party_name || ""}`.trim() || "-",
    45,
    48
  );

  doc.setFont("helvetica", "bold");
  doc.text("GSTIN:", 110, 48);
  doc.setFont("helvetica", "normal");
  doc.text(String(invoice.gstin || "-"), 145, 48);

  autoTable(doc, {
    startY: 58,
    head: [["Item", "HSN/SAC", "Qty", "Unit", "Rate", "Taxable", "Tax %", "Total"]],
    body: lines.map((line) => {
      const taxPct =
        Number(line.taxable_amount || 0) > 0
          ? (
              ((Number(line.cgst_amount || 0) +
                Number(line.sgst_amount || 0) +
                Number(line.igst_amount || 0)) /
                Number(line.taxable_amount || 1)) *
              100
            ).toFixed(2)
          : "0.00";

      return [
        `${line.item_code || ""} ${line.item_name || ""}`.trim(),
        String(line.hsn_sac || "-"),
        Number(line.qty || 0).toFixed(3),
        String(line.unit || "-"),
        money(line.rate),
        money(line.taxable_amount),
        `${taxPct}%`,
        money(line.line_total),
      ];
    }),
    theme: "grid",
    headStyles: { fillColor: [15, 23, 42] },
    styles: { fontSize: 8 },
  });

  const finalY = doc.lastAutoTable.finalY + 10;

  autoTable(doc, {
    startY: finalY,
    theme: "grid",
    head: [["Summary", "Amount"]],
    body: [
      ["Taxable Amount", money(invoice.taxable_amount)],
      ["CGST", money(invoice.cgst_amount)],
      ["SGST", money(invoice.sgst_amount)],
      ["IGST", money(invoice.igst_amount)],
      ["Total Invoice Amount", money(invoice.amount)],
      [
        invoiceType === "SALES" ? "Outstanding" : "Balance",
        money(invoice.balance_amount || 0),
      ],
      [
        invoiceType === "SALES" ? "Amount Received" : "Amount Paid",
        money(
          invoiceType === "SALES"
            ? invoice.amount_received || 0
            : invoice.amount_paid || 0
        ),
      ],
    ],
    headStyles: { fillColor: [15, 23, 42] },
    styles: { fontSize: 9 },
    columnStyles: {
      0: { fontStyle: "bold" },
    },
  });

  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text("Generated from ERP Accounting System", 14, 285);

  doc.save(`${invoice.invoice_no || "invoice"}.pdf`);
}

export function exportVoucherPdf({
  companyName = "ERP Accounting",
  voucher,
  lines = [],
}) {
  const doc = new jsPDF();

  header(doc, "Voucher Document", companyName);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Voucher No:", 14, 40);
  doc.setFont("helvetica", "normal");
  doc.text(String(voucher.voucher_no || "-"), 45, 40);

  doc.setFont("helvetica", "bold");
  doc.text("Voucher Type:", 110, 40);
  doc.setFont("helvetica", "normal");
  doc.text(String(voucher.voucher_type || "-"), 145, 40);

  doc.setFont("helvetica", "bold");
  doc.text("Voucher Date:", 14, 48);
  doc.setFont("helvetica", "normal");
  doc.text(String(voucher.voucher_date || "-"), 45, 48);

  doc.setFont("helvetica", "bold");
  doc.text("Status:", 110, 48);
  doc.setFont("helvetica", "normal");
  doc.text(String(voucher.status || "-"), 145, 48);

  doc.setFont("helvetica", "bold");
  doc.text("Narration:", 14, 56);
  doc.setFont("helvetica", "normal");
  doc.text(String(voucher.narration || "-"), 45, 56);

  autoTable(doc, {
    startY: 66,
    head: [["Line", "Account", "DC", "Amount", "Narration"]],
    body: lines.map((line) => [
      String(line.line_no || ""),
      `${line.account_code || ""} ${line.account_name || ""}`.trim(),
      String(line.dc || ""),
      money(line.amount),
      String(line.line_narration || "-"),
    ]),
    theme: "grid",
    headStyles: { fillColor: [15, 23, 42] },
    styles: { fontSize: 9 },
  });

  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text("Generated from ERP Accounting System", 14, 285);

  doc.save(`${voucher.voucher_no || "voucher"}.pdf`);
}

export function exportTrialBalancePdf({
  companyName = "ERP Accounting",
  from,
  to,
  rows = [],
}) {
  const doc = new jsPDF();

  header(doc, "Trial Balance", `${companyName} | Period: ${from} to ${to}`);

  autoTable(doc, {
    startY: 40,
    head: [["Code", "Account Name", "Debit", "Credit"]],
    body: rows.map((row) => [
      String(row.account_code || ""),
      String(row.account_name || ""),
      money(row.debit || 0),
      money(row.credit || 0),
    ]),
    theme: "grid",
    headStyles: { fillColor: [15, 23, 42] },
    styles: { fontSize: 9 },
  });

  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text("Generated from ERP Accounting System", 14, 285);

  doc.save(`trial_balance_${from}_to_${to}.pdf`);
}