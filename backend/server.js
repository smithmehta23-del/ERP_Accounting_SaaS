require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mysql = require("mysql2/promise");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");
const authMiddleware = require("./middleware/auth");
const accountsRoute = require("./routes/accounts");
const partiesRoute = require("./routes/parties");

app.use("/api/accounts", authMiddleware, accountsRoute);
app.use("/api/parties", authMiddleware, partiesRoute);
// only if you really have backend/routes/aiInvoice.js
// otherwise remove these 2 lines
const aiInvoiceRoutes = require("./routes/aiInvoice");

const app = express();
const aiUploadDir = path.join(__dirname, "uploads", "ai-intake");

if (!fs.existsSync(aiUploadDir)) {
  fs.mkdirSync(aiUploadDir, { recursive: true });
}

const aiStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, aiUploadDir);
  },
  filename: function (req, file, cb) {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${String(file.originalname || "document").replace(/\s+/g, "_")}`);
  },
});

const aiUpload = multer({ storage: aiStorage });
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors());
app.use(express.json());
app.use(helmet());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));

// only if aiInvoiceRoutes file exists
app.use("/api/ai-invoice", aiInvoiceRoutes);

const uploadDir = path.join(__dirname, "uploads", "ai-intake");


if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${file.originalname.replace(/\s+/g, "_")}`);
  },
});

const upload = multer({ storage });
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10,
});
function parseCsvBankStatement(csvText) {
  const lines = String(csvText || "")
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);

  if (lines.length <= 1) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

  const getIndex = (...names) => headers.findIndex((h) => names.includes(h));

  const dateIdx = getIndex("date", "txn_date", "transaction_date");
  const descIdx = getIndex("description", "narration", "remarks", "particulars");
  const refIdx = getIndex("reference", "ref", "reference_no", "cheque_no");
  const debitIdx = getIndex("debit", "withdrawal");
  const creditIdx = getIndex("credit", "deposit");
  const balanceIdx = getIndex("balance", "running_balance");

  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((x) => x.trim());

    rows.push({
      txn_date: dateIdx >= 0 ? cols[dateIdx] : "",
      description_text: descIdx >= 0 ? cols[descIdx] : "",
      reference_no: refIdx >= 0 ? cols[refIdx] : "",
      debit_amount: debitIdx >= 0 ? Number(cols[debitIdx] || 0) : 0,
      credit_amount: creditIdx >= 0 ? Number(cols[creditIdx] || 0) : 0,
      balance_amount: balanceIdx >= 0 ? Number(cols[balanceIdx] || 0) : null,
    });
  }

  return rows;
}

function daysDiff(a, b) {
  const d1 = new Date(a);
  const d2 = new Date(b);
  return Math.abs(Math.round((d1 - d2) / (1000 * 60 * 60 * 24)));
}

function scoreBankMatch(statementLine, candidate) {
  let score = 0;

  const stmtAmount = Number(statementLine.credit_amount || 0) > 0
    ? Number(statementLine.credit_amount || 0)
    : Number(statementLine.debit_amount || 0);

  const candAmount = Number(candidate.amount || 0);

  if (Math.abs(stmtAmount - candAmount) < 0.01) score += 50;

  const dd = daysDiff(statementLine.txn_date, candidate.txn_date);
  if (dd === 0) score += 25;
  else if (dd <= 2) score += 15;
  else if (dd <= 7) score += 8;

  const stmtText = normalizeAiText(
    `${statementLine.description_text || ""} ${statementLine.reference_no || ""}`
  );
  const candText = normalizeAiText(
    `${candidate.doc_no || ""} ${candidate.reference_no || ""} ${candidate.narration || ""}`
  );

  if (stmtText && candText) {
    if (stmtText.includes(candText) || candText.includes(stmtText)) score += 15;
    else {
      const stmtWords = stmtText.split(" ");
      const common = stmtWords.filter((w) => w && candText.includes(w)).length;
      if (common >= 2) score += 10;
    }
  }

  return Math.min(score, 99);
}
function requireFields(obj, fields) {
  for (const f of fields) {
    if (obj?.[f] === undefined || obj?.[f] === null || obj?.[f] === "") return f;
  }
  return null;
}

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Missing token" });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

function requireRole(...roles) {
  const allowed = roles.map((r) => String(r).toUpperCase());
  return (req, res, next) => {
    const role = String(req.user?.role || "").toUpperCase();
    if (!role || !allowed.includes(role)) {
      return res.status(403).json({ message: "Forbidden (role)" });
    }
    next();
  };
}

function makeCompanyCode(companyName) {
  const cleaned =
    String(companyName || "COMP")
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase()
      .slice(0, 6) || "COMP";
  const stamp = Date.now().toString().slice(-6);
  return `${cleaned}${stamp}`;
}
function normalizeAiText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function findOrCreatePartyFromAI(conn, companyId, extracted, userId) {
  const partyName = String(extracted.party_name || "").trim();
  const gstin = String(extracted.gstin || "").trim();

  if (!partyName) {
    throw new Error("AI could not detect party name");
  }

  const [existingRows] = await conn.query(
    `SELECT *
     FROM parties
     WHERE company_id=?
       AND (
         LOWER(TRIM(party_name)) = LOWER(TRIM(?))
         OR (? <> '' AND gstin = ?)
       )
     LIMIT 1`,
    [companyId, partyName, gstin, gstin]
  );

  if (existingRows.length) {
    return { party: existingRows[0], created: false };
  }

  const partyCode = `PTY-${Date.now()}`;
  const partyType =
    String(extracted.suggested_party_type || "VENDOR").toUpperCase() === "CUSTOMER"
      ? "CUSTOMER"
      : "VENDOR";

  const [result] = await conn.query(
    `INSERT INTO parties
     (company_id, party_code, party_name, party_type, gstin, phone, email, address_line1, city, state_name, pincode, country, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      companyId,
      partyCode,
      partyName,
      partyType,
      extracted.gstin || null,
      extracted.phone || null,
      extracted.email || null,
      extracted.address_line1 || null,
      extracted.city || null,
      extracted.state_name || null,
      extracted.pincode || null,
      extracted.country || "India",
    ]
  );

  const [partyRows] = await conn.query(
    `SELECT * FROM parties WHERE id=? LIMIT 1`,
    [result.insertId]
  );

  return { party: partyRows[0], created: true };
}

async function findOrCreateItemFromAI(conn, companyId, itemData) {
  const description = String(itemData.description || itemData.name || "").trim();
  if (!description) {
    return { item: null, created: false };
  }

  const [existingRows] = await conn.query(
    `SELECT *
     FROM items
     WHERE company_id=? AND is_active=1`,
    [companyId]
  );

  const match =
    existingRows.find(
      (x) => normalizeAiText(x.item_name) === normalizeAiText(description)
    ) ||
    existingRows.find(
      (x) => normalizeAiText(description).includes(normalizeAiText(x.item_name))
    ) ||
    null;

  if (match) {
    return { item: match, created: false };
  }

  const itemCode = `ITM-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const [result] = await conn.query(
    `INSERT INTO items
     (company_id, item_code, item_name, unit, hsn_sac, tax_rate, purchase_rate, sales_rate, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      companyId,
      itemCode,
      description,
      "NOS",
      null,
      18,
      Number(itemData.rate || itemData.amount || 0),
      0,
    ]
  );

  const [itemRows] = await conn.query(
    `SELECT * FROM items WHERE id=? LIMIT 1`,
    [result.insertId]
  );

  return { item: itemRows[0], created: true };
}

async function createPurchaseInvoiceAndVoucherFromAI(conn, companyId, partyId, extracted, items, userId, userRole) {
  const [settingsRows] = await conn.query(
    `SELECT * FROM company_account_settings WHERE company_id=? LIMIT 1`,
    [companyId]
  );

  if (!settingsRows.length) {
    throw new Error("Company account settings not configured");
  }

  const settings = settingsRows[0];

  if (!settings.purchase_account_id || !settings.payable_account_id) {
    throw new Error("Purchase and payable accounts must be configured in Settings");
  }

  const invoiceDate = extracted.invoice_date || new Date().toISOString().slice(0, 10);

  if (typeof ensurePostingAllowed === "function") {
    await ensurePostingAllowed(conn, companyId, invoiceDate, userRole);
  }

  const taxableAmount = Number(extracted.taxable_amount || 0);
  const cgstAmount = Number(extracted.cgst_amount || 0);
  const sgstAmount = Number(extracted.sgst_amount || 0);
  const igstAmount = Number(extracted.igst_amount || 0);
  const totalAmount = Number(extracted.total_amount || taxableAmount + cgstAmount + sgstAmount + igstAmount);

  const voucherNo =
    typeof getNextVoucherNo === "function"
      ? await getNextVoucherNo(conn, companyId, "PV")
      : `PV-${Date.now()}`;

  const [vh] = await conn.query(
    `INSERT INTO voucher_header
     (company_id, voucher_no, voucher_type, voucher_date, narration, status, created_by, approved_by)
     VALUES (?, ?, 'PV', ?, ?, 'APPROVED', ?, ?)`,
    [
      companyId,
      voucherNo,
      invoiceDate,
      `AI Purchase Invoice ${extracted.invoice_no || ""}`.trim(),
      userId,
      userId,
    ]
  );

  const voucherId = vh.insertId;
  let lineNo = 1;

  await conn.query(
    `INSERT INTO voucher_line (header_id, line_no, account_id, dc, amount, line_narration)
     VALUES (?, ?, ?, 'D', ?, ?)`,
    [voucherId, lineNo++, settings.purchase_account_id, taxableAmount, "Purchase from AI automation"]
  );

  if (cgstAmount > 0 && settings.cgst_input_account_id) {
    await conn.query(
      `INSERT INTO voucher_line (header_id, line_no, account_id, dc, amount, line_narration)
       VALUES (?, ?, ?, 'D', ?, ?)`,
      [voucherId, lineNo++, settings.cgst_input_account_id, cgstAmount, "CGST input from AI automation"]
    );
  }

  if (sgstAmount > 0 && settings.sgst_input_account_id) {
    await conn.query(
      `INSERT INTO voucher_line (header_id, line_no, account_id, dc, amount, line_narration)
       VALUES (?, ?, ?, 'D', ?, ?)`,
      [voucherId, lineNo++, settings.sgst_input_account_id, sgstAmount, "SGST input from AI automation"]
    );
  }

  if (igstAmount > 0 && settings.igst_input_account_id) {
    await conn.query(
      `INSERT INTO voucher_line (header_id, line_no, account_id, dc, amount, line_narration)
       VALUES (?, ?, ?, 'D', ?, ?)`,
      [voucherId, lineNo++, settings.igst_input_account_id, igstAmount, "IGST input from AI automation"]
    );
  }

  await conn.query(
    `INSERT INTO voucher_line (header_id, line_no, account_id, dc, amount, line_narration)
     VALUES (?, ?, ?, 'C', ?, ?)`,
    [voucherId, lineNo++, settings.payable_account_id, totalAmount, "Vendor payable from AI automation"]
  );

  const [piResult] = await conn.query(
    `INSERT INTO purchase_invoices
     (company_id, party_id, invoice_no, invoice_date, amount, taxable_amount, cgst_amount, sgst_amount, igst_amount, amount_paid, balance_amount, status, voucher_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'POSTED', ?, ?)`,
    [
      companyId,
      partyId,
      extracted.invoice_no || `AI-${Date.now()}`,
      invoiceDate,
      totalAmount,
      taxableAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      totalAmount,
      voucherId,
      userId,
    ]
  );

  for (const line of items) {
    await conn.query(
      `INSERT INTO purchase_invoice_lines
       (purchase_invoice_id, item_id, description_text, qty, rate, taxable_amount, cgst_amount, sgst_amount, igst_amount, line_total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        piResult.insertId,
        line.item_id || null,
        line.description_text,
        Number(line.qty || 1),
        Number(line.rate || 0),
        Number(line.taxable_amount || 0),
        0,
        0,
        0,
        Number(line.line_total || 0),
      ]
    );
  }

  return {
    purchaseInvoiceId: piResult.insertId,
    voucherId,
    voucherNo,
  };
}
function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
async function getNextVoucherNo(conn, companyId, voucherType) {
  const [rows] = await conn.query(
    `SELECT id, prefix, next_number
     FROM voucher_sequence
     WHERE company_id=? AND voucher_type=?
     FOR UPDATE`,
    [companyId, voucherType]
  );

  if (!rows.length) {
    throw new Error(`Voucher sequence not configured for voucher type ${voucherType}`);
  }

  const seqRow = rows[0];
  const next = Number(seqRow.next_number || 1);
  const voucherNo = `${seqRow.prefix}-${String(next).padStart(4, "0")}`;

  await conn.query(
    `UPDATE voucher_sequence
     SET next_number = next_number + 1
     WHERE id = ?`,
    [seqRow.id]
  );

  return voucherNo;
}
async function extractInvoiceDataWithAI({ filePath, fileMimeType, parties }) {
  const base64 = fs.readFileSync(filePath, { encoding: "base64" });

  const knownParties = parties.map((p) => ({
    id: p.id,
    party_name: p.party_name,
    gstin: p.gstin,
    party_type: p.party_type,
  }));

  const prompt = `
You are an ERP invoice intake assistant.

Read the uploaded invoice or bill and return ONLY valid JSON.

Tasks:
1. Detect whether it looks like a PURCHASE_INVOICE, SALES_INVOICE, EXPENSE_BILL, or OTHER.
2. Extract:
   - party_name
   - invoice_no
   - invoice_date
   - gstin
   - phone
   - email
   - address_line1
   - city
   - state_name
   - pincode
   - country
   - total_amount
   - taxable_amount
   - cgst_amount
   - sgst_amount
   - igst_amount
   - items: [{ description, qty, rate, amount }]
3. Compare with known parties and return:
   - matched_party_id if strong match exists
   - matched_party_confidence between 0 and 1
4. Return a suggested_party_type:
   - VENDOR for purchase invoice or expense bill
   - CUSTOMER for sales invoice
5. If fields are unclear, use null.

Return JSON exactly like:
{
  "doc_type": "PURCHASE_INVOICE",
  "party_name": "ABC Traders",
  "invoice_no": "INV-001",
  "invoice_date": "2026-03-18",
  "gstin": "22AAAAA0000A1Z5",
  "phone": null,
  "email": null,
  "address_line1": null,
  "city": null,
  "state_name": null,
  "pincode": null,
  "country": "India",
  "total_amount": 1180,
  "taxable_amount": 1000,
  "cgst_amount": 90,
  "sgst_amount": 90,
  "igst_amount": 0,
  "items": [
    {
      "description": "Office stationery",
      "qty": 1,
      "rate": 1000,
      "amount": 1000
    }
  ],
  "matched_party_id": null,
  "matched_party_confidence": 0.0,
  "suggested_party_type": "VENDOR",
  "notes": ["Possible supplier invoice"]
}

Known parties:
${JSON.stringify(knownParties, null, 2)}
`;

  const response = await openai.responses.create({
    model: process.env.AI_MODEL || "gpt-5.4",
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          {
            type: "input_image",
            image_url: `data:${fileMimeType};base64,${base64}`,
          },
        ],
      },
    ],
  });

  const raw = (response.output_text || "").trim();

  let cleaned = raw;
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/```json/gi, "").replace(/```/g, "").trim();
  }

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error(`AI did not return valid JSON. Raw output: ${raw}`);
  }

  cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  return JSON.parse(cleaned);
}
async function parseVoucherWithAI({ text, accounts, parties, items }) {
  const accountHints = accounts.map((a) => ({
    id: a.id,
    code: a.account_code,
    name: a.account_name,
    type: a.account_type,
  }));

  const partyHints = parties.map((p) => ({
    id: p.id,
    code: p.party_code,
    name: p.party_name,
    type: p.party_type,
  }));

  const itemHints = items.map((i) => ({
    id: i.id,
    code: i.item_code,
    name: i.item_name,
  }));

  const prompt = `
You are an ERP accounting assistant.

Convert the user's transaction text into structured accounting voucher JSON.

Return ONLY valid JSON.
No markdown.
No code fences.
No explanation text.

Rules:
- voucher_type must be JV, PV, or RV
- narration must be short and professional
- confidence must be between 0 and 1
- voucher must balance
- lines must contain:
  account_name, dc, amount, line_narration

JSON format:
{
  "voucher_type": "PV",
  "narration": "Rent paid by bank",
  "confidence": 0.92,
  "notes": ["Matched bank based on phrase by bank"],
  "lines": [
    {
      "account_name": "Rent Expense",
      "dc": "D",
      "amount": 2000,
      "line_narration": "Rent expense"
    },
    {
      "account_name": "Bank",
      "dc": "C",
      "amount": 2000,
      "line_narration": "Payment by bank"
    }
  ]
}

Available accounts:
${JSON.stringify(accountHints, null, 2)}

Available parties:
${JSON.stringify(partyHints, null, 2)}

Available items:
${JSON.stringify(itemHints, null, 2)}

User transaction:
${text}
`;

  const response = await openai.responses.create({
    model: process.env.AI_MODEL || "gpt-5.4",
    input: prompt,
  });

  const raw = String(response.output_text || "").trim();

  let cleaned = raw;
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/```json/gi, "").replace(/```/g, "").trim();
  }

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error(`AI did not return valid JSON. Raw output: ${raw}`);
  }

  cleaned = cleaned.slice(firstBrace, lastBrace + 1);

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`AI JSON parse failed. Raw output: ${raw}`);
  }
}
async function writeAuditLog(
  connOrPool,
  { companyId, userId = null, action, entityType, entityId = null, details = "" }
) {
  await connOrPool.query(
    `INSERT INTO audit_logs
     (company_id, user_id, action, entity_type, entity_id, details)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [companyId, userId, action, entityType, entityId, details]
  );
}

async function isDateInClosedPeriod(connOrPool, companyId, txnDate) {
  const [rows] = await connOrPool.query(
    `SELECT id
     FROM accounting_period_closures
     WHERE company_id=?
       AND is_closed=1
       AND ? BETWEEN period_from AND period_to
     LIMIT 1`,
    [companyId, txnDate]
  );
  return rows.length > 0;
}

async function ensureOpenPeriod(connOrPool, companyId, txnDate) {
  const closed = await isDateInClosedPeriod(connOrPool, companyId, txnDate);
  if (closed) {
    throw new Error(`Transaction date ${txnDate} falls in a closed accounting period`);
  }
}

app.get("/", (req, res) => {
  res.send("ERP Accounting SaaS Backend Running ✅");
});
async function getActiveCompanyIdForUser(connOrPool, user) {
  if (user?.active_company_id) return Number(user.active_company_id);
  if (user?.company_id) return Number(user.company_id);
  return null;
}

async function ensurePostingAllowed(conn, companyId, txnDate, userRole = "") {
  const [fyRows] = await conn.query(
    `SELECT *
     FROM financial_years
     WHERE company_id=?
       AND ? BETWEEN start_date AND end_date
     ORDER BY id DESC
     LIMIT 1`,
    [companyId, txnDate]
  );

  if (!fyRows.length) {
    throw new Error(`No financial year configured for transaction date ${txnDate}`);
  }

  const fy = fyRows[0];

  if (String(fy.status || "").toUpperCase() !== "OPEN") {
    throw new Error(`Financial year ${fy.year_code} is not open for posting`);
  }

  const [lockRows] = await conn.query(
    `SELECT *
     FROM posting_locks
     WHERE company_id=?
       AND is_active=1
       AND ? BETWEEN lock_from AND lock_to
     ORDER BY id DESC`,
    [companyId, txnDate]
  );

  const isAdmin = String(userRole || "").toUpperCase() === "ADMIN";
  if (lockRows.length && !isAdmin) {
    throw new Error(
      `Posting is locked for ${txnDate}. Reason: ${lockRows[0].reason || "Period lock"}`
    );
  }

  return fy;
}
/* ----------------------------- AUTH / COMPANY ----------------------------- */

app.post("/api/register-company", async (req, res) => {
  const missing = requireFields(req.body, [
    "company_name",
    "admin_name",
    "email",
    "password",
  ]);
  if (missing) return res.status(400).json({ message: `${missing} is required` });

  const { company_name, admin_name, email, password, base_currency = "INR" } = req.body;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [exists] = await conn.query("SELECT id FROM users WHERE email=?", [email]);
    if (exists.length) {
      await conn.rollback();
      return res.status(400).json({ message: "Email already exists" });
    }

    const code = makeCompanyCode(company_name);
    const [companyResult] = await conn.query(
      `INSERT INTO companies (code, name, base_currency)
       VALUES (?, ?, ?)`,
      [code, company_name, base_currency]
    );

    const companyId = companyResult.insertId;
    const hashed = await bcrypt.hash(password, 10);

    const [userResult] = await conn.query(
      `INSERT INTO users (company_id, full_name, email, password_hash, role, is_active)
       VALUES (?, ?, ?, ?, 'ADMIN', 1)`,
      [companyId, admin_name, email, hashed]
    );

    await conn.query(
      `INSERT INTO voucher_sequence (company_id, voucher_type, prefix, next_number, reset_frequency)
       VALUES (?, 'JV', 'JV', 1, 'YEARLY'),
              (?, 'PV', 'PV', 1, 'YEARLY'),
              (?, 'RV', 'RV', 1, 'YEARLY')`,
      [companyId, companyId, companyId]
    );

    await conn.commit();
    return res.json({
      message: "Company + Admin created ✅",
      company_id: companyId,
      admin_user_id: userResult.insertId,
      company_code: code,
    });
  } catch (e) {
    await conn.rollback();
    return res.status(500).json({ message: "Register failed", error: e.message });
  } finally {
    conn.release();
  }
});

app.post("/api/login", async (req, res) => {
  const missing = requireFields(req.body, ["email", "password"]);
  if (missing) return res.status(400).json({ message: `${missing} is required` });

  try {
    const { email, password } = req.body;

    const [rows] = await pool.query(
      `SELECT id, company_id, full_name, email, password_hash, role, is_active
       FROM users
       WHERE email = ?`,
      [email]
    );

    if (!rows.length) return res.status(400).json({ message: "User not found" });

    const user = rows[0];
    if (!user.is_active) return res.status(403).json({ message: "User is inactive" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(400).json({ message: "Invalid password" });

    const token = jwt.sign(
      {
        id: user.id,
        company_id: user.company_id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    await writeAuditLog(pool, {
      companyId: user.company_id,
      userId: user.id,
      action: "LOGIN_SUCCESS",
      entityType: "auth",
      details: `User ${user.email} logged in`,
    });

    return res.json({
      message: "Login successful ✅",
      token,
      user: {
        id: user.id,
        name: user.full_name,
        email: user.email,
        role: user.role,
        company_id: user.company_id,
      },
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    return res.status(500).json({ message: "Login failed", error: error.message });
  }
});

/* ----------------------------- ACCOUNTS ----------------------------- */

app.get("/api/accounts", auth, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT * FROM accounts
     WHERE company_id=?
     ORDER BY account_code ASC`,
    [req.user.company_id]
  );
  res.json(rows);
});

app.post("/api/accounts", auth, requireRole("ADMIN"), async (req, res) => {
  const missing = requireFields(req.body, [
    "account_code",
    "account_name",
    "account_type",
  ]);
  if (missing) return res.status(400).json({ message: `${missing} is required` });

  const { account_code, account_name, account_type, parent_id } = req.body;

  try {
    const [r] = await pool.query(
      `INSERT INTO accounts (company_id, account_code, account_name, account_type, parent_id)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.company_id, account_code, account_name, account_type, parent_id || null]
    );

    await writeAuditLog(pool, {
      companyId: req.user.company_id,
      userId: req.user.id,
      action: "ACCOUNT_CREATED",
      entityType: "account",
      entityId: r.insertId,
      details: `Created account ${account_code} - ${account_name}`,
    });

    res.json({ message: "Account created ✅", account_id: r.insertId });
  } catch (e) {
    res.status(500).json({ message: "Account create failed", error: e.message });
  }
});

app.put("/api/accounts/:id", auth, requireRole("ADMIN"), async (req, res) => {
  const id = Number(req.params.id);
  const { account_name, account_type, parent_id, is_active } = req.body;

  const fields = [];
  const vals = [];

  if (account_name !== undefined) {
    fields.push("account_name=?");
    vals.push(account_name);
  }
  if (account_type !== undefined) {
    fields.push("account_type=?");
    vals.push(account_type);
  }
  if (parent_id !== undefined) {
    fields.push("parent_id=?");
    vals.push(parent_id || null);
  }
  if (is_active !== undefined) {
    fields.push("is_active=?");
    vals.push(is_active ? 1 : 0);
  }

  if (!fields.length) return res.status(400).json({ message: "Nothing to update" });

  vals.push(req.user.company_id, id);

  const [r] = await pool.query(
    `UPDATE accounts
     SET ${fields.join(", ")}
     WHERE company_id=? AND id=?`,
    vals
  );

  if (r.affectedRows === 0) return res.status(404).json({ message: "Account not found" });

  await writeAuditLog(pool, {
    companyId: req.user.company_id,
    userId: req.user.id,
    action: "ACCOUNT_UPDATED",
    entityType: "account",
    entityId: id,
    details: `Updated account ${id}`,
  });

  res.json({ message: "Account updated ✅" });
});

app.delete("/api/accounts/:id", auth, requireRole("ADMIN"), async (req, res) => {
  const id = Number(req.params.id);
  const [r] = await pool.query(
    `DELETE FROM accounts
     WHERE company_id=? AND id=?`,
    [req.user.company_id, id]
  );
  if (r.affectedRows === 0) return res.status(404).json({ message: "Account not found" });
  res.json({ message: "Account deleted ✅" });
});

/* ----------------------------- PARTIES ----------------------------- */

app.get("/api/parties", auth, async (req, res) => {
  try {
    const { type, active } = req.query;
    const params = [req.user.company_id];
    let sql = `SELECT * FROM parties WHERE company_id=?`;

    if (type) {
      sql += ` AND party_type=?`;
      params.push(String(type).toUpperCase());
    }

    if (active !== undefined) {
      sql += ` AND is_active=?`;
      params.push(active === "1" ? 1 : 0);
    }

    sql += ` ORDER BY party_name ASC`;

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Failed to load parties", error: error.message });
  }
});
app.get("/api/accounts", auth, async (req, res) => {
  try {
    const companyId = req.user.active_company_id || req.user.company_id || 1;
    const q = String(req.query.q || "").trim();

    let sql = `
      SELECT
        id,
        company_id,
        account_code,
        account_name,
        account_type,
        parent_id,
        is_group,
        is_active,
        effective_from,
        effective_to,
        created_at,
        updated_at
      FROM accounts
      WHERE company_id = ?
    `;
    const params = [companyId];

    if (q) {
      sql += `
        AND (
          account_code LIKE ?
          OR account_name LIKE ?
        )
      `;
      params.push(`%${q}%`, `%${q}%`);
    }

    sql += ` ORDER BY account_code ASC`;

    const [rows] = await pool.query(sql, params);
    res.json(rows || []);
  } catch (error) {
    console.error("GET /api/accounts error:", error);
    res.status(500).json({
      message: "Failed to load accounts",
      error: error.message,
    });
  }
});
app.post("/api/accounts", auth, async (req, res) => {
  try {
    const companyId = req.user.active_company_id || req.user.company_id || 1;

    const {
      account_code,
      account_name,
      account_type,
      parent_id,
      is_group,
      is_active,
      effective_from,
      effective_to,
    } = req.body;

    if (!account_code || !account_name || !account_type) {
      return res.status(400).json({
        message: "account_code, account_name, and account_type are required",
      });
    }

    const [result] = await pool.query(
      `INSERT INTO accounts
       (
         company_id,
         account_code,
         account_name,
         account_type,
         parent_id,
         is_group,
         is_active,
         effective_from,
         effective_to
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        account_code,
        account_name,
        account_type,
        parent_id || null,
        Number(is_group) ? 1 : 0,
        is_active === 0 ? 0 : 1,
        effective_from || null,
        effective_to || null,
      ]
    );

    res.json({
      message: "Account created successfully",
      id: result.insertId,
    });
  } catch (error) {
    console.error("POST /api/accounts error:", error);
    res.status(500).json({
      message: "Failed to create account",
      error: error.message,
    });
  }
});
app.put("/api/accounts/:id", auth, async (req, res) => {
  try {
    const companyId = req.user.active_company_id || req.user.company_id || 1;
    const id = Number(req.params.id);

    const {
      account_code,
      account_name,
      account_type,
      parent_id,
      is_group,
      is_active,
      effective_from,
      effective_to,
    } = req.body;

    await pool.query(
      `UPDATE accounts
       SET
         account_code = ?,
         account_name = ?,
         account_type = ?,
         parent_id = ?,
         is_group = ?,
         is_active = ?,
         effective_from = ?,
         effective_to = ?
       WHERE id = ? AND company_id = ?`,
      [
        account_code,
        account_name,
        account_type,
        parent_id || null,
        Number(is_group) ? 1 : 0,
        is_active === 0 ? 0 : 1,
        effective_from || null,
        effective_to || null,
        id,
        companyId,
      ]
    );

    res.json({ message: "Account updated successfully" });
  } catch (error) {
    console.error("PUT /api/accounts/:id error:", error);
    res.status(500).json({
      message: "Failed to update account",
      error: error.message,
    });
  }
});
app.delete("/api/accounts/:id", auth, async (req, res) => {
  try {
    const companyId = req.user.active_company_id || req.user.company_id || 1;
    const id = Number(req.params.id);

    await pool.query(
      `UPDATE accounts
       SET is_active = 0, effective_to = CURDATE()
       WHERE id = ? AND company_id = ?`,
      [id, companyId]
    );

    res.json({ message: "Account deactivated successfully" });
  } catch (error) {
    console.error("DELETE /api/accounts/:id error:", error);
    res.status(500).json({
      message: "Failed to deactivate account",
      error: error.message,
    });
  }
});
app.post("/api/parties", auth, requireRole("ADMIN", "PREPARER"), async (req, res) => {
  const missing = requireFields(req.body, ["party_code", "party_name", "party_type"]);
  if (missing) return res.status(400).json({ message: `${missing} is required` });

  try {
    const {
      party_code,
      party_name,
      party_type,
      email,
      phone,
      gstin,
      address_line1,
      city,
      state_name,
      country_name,
    } = req.body;

    const [r] = await pool.query(
      `INSERT INTO parties
       (company_id, party_code, party_name, party_type, email, phone, gstin, address_line1, city, state_name, country_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.company_id,
        party_code,
        party_name,
        String(party_type).toUpperCase(),
        email || null,
        phone || null,
        gstin || null,
        address_line1 || null,
        city || null,
        state_name || null,
        country_name || "India",
      ]
    );

    await writeAuditLog(pool, {
      companyId: req.user.company_id,
      userId: req.user.id,
      action: "PARTY_CREATED",
      entityType: "party",
      entityId: r.insertId,
      details: `Created party ${party_code} - ${party_name}`,
    });

    res.json({ message: "Party created ✅", party_id: r.insertId });
  } catch (error) {
    res.status(500).json({ message: "Failed to create party", error: error.message });
  }
});

app.put("/api/parties/:id", auth, requireRole("ADMIN", "PREPARER"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      party_name,
      party_type,
      email,
      phone,
      gstin,
      address_line1,
      city,
      state_name,
      country_name,
      is_active,
    } = req.body;

    const fields = [];
    const vals = [];

    if (party_name !== undefined) {
      fields.push("party_name=?");
      vals.push(party_name);
    }
    if (party_type !== undefined) {
      fields.push("party_type=?");
      vals.push(String(party_type).toUpperCase());
    }
    if (email !== undefined) {
      fields.push("email=?");
      vals.push(email || null);
    }
    if (phone !== undefined) {
      fields.push("phone=?");
      vals.push(phone || null);
    }
    if (gstin !== undefined) {
      fields.push("gstin=?");
      vals.push(gstin || null);
    }
    if (address_line1 !== undefined) {
      fields.push("address_line1=?");
      vals.push(address_line1 || null);
    }
    if (city !== undefined) {
      fields.push("city=?");
      vals.push(city || null);
    }
    if (state_name !== undefined) {
      fields.push("state_name=?");
      vals.push(state_name || null);
    }
    if (country_name !== undefined) {
      fields.push("country_name=?");
      vals.push(country_name || "India");
    }
    if (is_active !== undefined) {
      fields.push("is_active=?");
      vals.push(is_active ? 1 : 0);
    }

    if (!fields.length) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    vals.push(req.user.company_id, id);

    const [r] = await pool.query(
      `UPDATE parties
       SET ${fields.join(", ")}
       WHERE company_id=? AND id=?`,
      vals
    );

    if (!r.affectedRows) {
      return res.status(404).json({ message: "Party not found" });
    }

    await writeAuditLog(pool, {
      companyId: req.user.company_id,
      userId: req.user.id,
      action: "PARTY_UPDATED",
      entityType: "party",
      entityId: id,
      details: `Updated party ${id}`,
    });

    res.json({ message: "Party updated ✅" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update party", error: error.message });
  }
});
app.get("/api/outstanding/customers", auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         p.id AS party_id,
         p.party_code,
         p.party_name,
         p.credit_limit,
         COALESCE(SUM(si.balance_amount), 0) AS outstanding
       FROM parties p
       LEFT JOIN sales_invoices si
         ON si.party_id = p.id
        AND si.company_id = p.company_id
        AND si.status='POSTED'
        AND COALESCE(si.balance_amount, 0) > 0
       WHERE p.company_id=?
         AND p.party_type IN ('CUSTOMER','BOTH')
       GROUP BY p.id, p.party_code, p.party_name, p.credit_limit
       ORDER BY outstanding DESC, p.party_name ASC`,
      [req.user.company_id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Failed to load customer outstanding", error: error.message });
  }
});

app.get("/api/outstanding/vendors", auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         p.id AS party_id,
         p.party_code,
         p.party_name,
         COALESCE(SUM(pi.balance_amount), 0) AS outstanding
       FROM parties p
       LEFT JOIN purchase_invoices pi
         ON pi.party_id = p.id
        AND pi.company_id = p.company_id
        AND pi.status='POSTED'
        AND COALESCE(pi.balance_amount, 0) > 0
       WHERE p.company_id=?
         AND p.party_type IN ('VENDOR','BOTH')
       GROUP BY p.id, p.party_code, p.party_name
       ORDER BY outstanding DESC, p.party_name ASC`,
      [req.user.company_id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Failed to load vendor outstanding", error: error.message });
  }
});

app.get("/api/outstanding/customer-invoices/:partyId", auth, async (req, res) => {
  try {
    const partyId = Number(req.params.partyId);
    const [rows] = await pool.query(
      `SELECT id, invoice_no, invoice_date, amount, amount_received, balance_amount
       FROM sales_invoices
       WHERE company_id=?
         AND party_id=?
         AND status='POSTED'
         AND COALESCE(balance_amount, 0) > 0
       ORDER BY invoice_date ASC, id ASC`,
      [req.user.company_id, partyId]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Failed to load customer invoices", error: error.message });
  }
});

app.get("/api/outstanding/vendor-invoices/:partyId", auth, async (req, res) => {
  try {
    const partyId = Number(req.params.partyId);
    const [rows] = await pool.query(
      `SELECT id, invoice_no, invoice_date, amount, amount_paid, balance_amount
       FROM purchase_invoices
       WHERE company_id=?
         AND party_id=?
         AND status='POSTED'
         AND COALESCE(balance_amount, 0) > 0
       ORDER BY invoice_date ASC, id ASC`,
      [req.user.company_id, partyId]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Failed to load vendor invoices", error: error.message });
  }
});

/* ----------------------------- SETTINGS ----------------------------- */

app.get("/api/settings/account-mapping", auth, requireRole("ADMIN", "PREPARER", "APPROVER"), async (req, res) => {
  try {
    const companyId = req.user.company_id;

    const [rows] = await pool.query(
      `SELECT * FROM company_account_settings WHERE company_id=? LIMIT 1`,
      [companyId]
    );

    if (!rows.length) {
      return res.json({
        company_id: companyId,
        sales_account_id: null,
        purchase_account_id: null,
        receivable_account_id: null,
        payable_account_id: null,
        cash_account_id: null,
        bank_account_id: null,
        cgst_output_account_id: null,
        sgst_output_account_id: null,
        igst_output_account_id: null,
        cgst_input_account_id: null,
        sgst_input_account_id: null,
        igst_input_account_id: null,
      });
    }

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({
      message: "Failed to load account mapping settings",
      error: error.message,
    });
  }
});
app.post("/api/receipts", auth, requireRole("ADMIN", "PREPARER"), async (req, res) => {
  const missing = requireFields(req.body, [
    "party_id",
    "receipt_no",
    "receipt_date",
    "payment_mode",
    "allocations",
  ]);
  if (missing) return res.status(400).json({ message: `${missing} is required` });

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const {
      party_id,
      receipt_no,
      receipt_date,
      payment_mode,
      reference_no,
      remarks,
      allocations,
    } = req.body;

    await ensurePostingAllowed(conn, companyId, someDate, req.user.role);

    if (!Array.isArray(allocations) || !allocations.length) {
      throw new Error("At least one allocation is required");
    }

    const [settingsRows] = await conn.query(
      `SELECT * FROM company_account_settings WHERE company_id=? LIMIT 1`,
      [req.user.company_id]
    );
    if (!settingsRows.length) throw new Error("Account mapping settings not configured");
    const settings = settingsRows[0];

    const bankOrCashAccountId =
      payment_mode === "BANK" ? settings.bank_account_id : settings.cash_account_id;

    if (!bankOrCashAccountId || !settings.receivable_account_id) {
      throw new Error("Cash/Bank and Receivable accounts must be configured in Settings");
    }

    const invoiceIds = allocations.map((x) => Number(x.sales_invoice_id)).filter(Boolean);
    const [invoiceRows] = await conn.query(
      `SELECT id, invoice_no, balance_amount
       FROM sales_invoices
       WHERE company_id=?
         AND party_id=?
         AND id IN (${invoiceIds.map(() => "?").join(",")})
       FOR UPDATE`,
      [req.user.company_id, party_id, ...invoiceIds]
    );

    if (invoiceRows.length !== invoiceIds.length) {
      throw new Error("One or more sales invoices are invalid for this customer");
    }

    let totalAmount = 0;
    for (const alloc of allocations) {
      const invoice = invoiceRows.find((x) => Number(x.id) === Number(alloc.sales_invoice_id));
      const amt = Number(alloc.allocated_amount || 0);
      if (!(amt > 0)) throw new Error("Allocated amount must be greater than zero");
      if (amt > Number(invoice.balance_amount || 0)) {
        throw new Error(`Allocated amount exceeds balance for invoice ${invoice.invoice_no}`);
      }
      totalAmount += amt;
    }

    const voucherNo = await getNextVoucherNo(conn, req.user.company_id, "RV");

    const [vh] = await conn.query(
      `INSERT INTO voucher_header
       (company_id, voucher_no, voucher_type, voucher_date, narration, status, created_by, approved_by)
       VALUES (?, ?, 'RV', ?, ?, 'APPROVED', ?, ?)`,
      [
        req.user.company_id,
        voucherNo,
        receipt_date,
        `Customer receipt ${receipt_no}`,
        req.user.id,
        req.user.id,
      ]
    );

    const voucherId = vh.insertId;

    await conn.query(
      `INSERT INTO voucher_line (header_id, line_no, account_id, dc, amount, line_narration)
       VALUES
       (?, 1, ?, 'D', ?, ?),
       (?, 2, ?, 'C', ?, ?)`,
      [
        voucherId,
        bankOrCashAccountId,
        totalAmount,
        `${payment_mode} receipt`,
        voucherId,
        settings.receivable_account_id,
        totalAmount,
        "Customer allocation",
      ]
    );

    const [receiptResult] = await conn.query(
      `INSERT INTO receipts
       (company_id, party_id, receipt_no, receipt_date, payment_mode, reference_no, amount, remarks, voucher_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.company_id,
        party_id,
        receipt_no,
        receipt_date,
        String(payment_mode).toUpperCase(),
        reference_no || null,
        Number(totalAmount.toFixed(2)),
        remarks || null,
        voucherId,
        req.user.id,
      ]
    );

    for (const alloc of allocations) {
      const amt = Number(alloc.allocated_amount || 0);

      await conn.query(
        `INSERT INTO receipt_allocations (receipt_id, sales_invoice_id, allocated_amount)
         VALUES (?, ?, ?)`,
        [receiptResult.insertId, alloc.sales_invoice_id, amt]
      );

      await conn.query(
        `UPDATE sales_invoices
         SET amount_received = amount_received + ?,
             balance_amount = balance_amount - ?
         WHERE company_id=? AND id=?`,
        [amt, amt, req.user.company_id, alloc.sales_invoice_id]
      );
    }

    await writeAuditLog(conn, {
      companyId: req.user.company_id,
      userId: req.user.id,
      action: "CUSTOMER_RECEIPT_CREATED",
      entityType: "receipt",
      entityId: receiptResult.insertId,
      details: `Receipt ${receipt_no} created for amount ${totalAmount.toFixed(2)}`,
    });

    await conn.commit();

    res.json({
      message: "Receipt posted successfully ✅",
      receipt_id: receiptResult.insertId,
      voucher_id: voucherId,
      voucher_no: voucherNo,
      amount: Number(totalAmount.toFixed(2)),
    });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ message: "Failed to post receipt", error: error.message });
  } finally {
    conn.release();
  }
});
app.post("/api/payments", auth, requireRole("ADMIN", "PREPARER"), async (req, res) => {
  const missing = requireFields(req.body, [
    "party_id",
    "payment_no",
    "payment_date",
    "payment_mode",
    "allocations",
  ]);
  if (missing) return res.status(400).json({ message: `${missing} is required` });

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const {
      party_id,
      payment_no,
      payment_date,
      payment_mode,
      reference_no,
      remarks,
      allocations,
    } = req.body;

    await ensurePostingAllowed(conn, companyId, someDate, req.user.role);

    if (!Array.isArray(allocations) || !allocations.length) {
      throw new Error("At least one allocation is required");
    }

    const [settingsRows] = await conn.query(
      `SELECT * FROM company_account_settings WHERE company_id=? LIMIT 1`,
      [req.user.company_id]
    );
    if (!settingsRows.length) throw new Error("Account mapping settings not configured");
    const settings = settingsRows[0];

    const bankOrCashAccountId =
      payment_mode === "BANK" ? settings.bank_account_id : settings.cash_account_id;

    if (!bankOrCashAccountId || !settings.payable_account_id) {
      throw new Error("Cash/Bank and Payable accounts must be configured in Settings");
    }

    const invoiceIds = allocations.map((x) => Number(x.purchase_invoice_id)).filter(Boolean);
    const [invoiceRows] = await conn.query(
      `SELECT id, invoice_no, balance_amount
       FROM purchase_invoices
       WHERE company_id=?
         AND party_id=?
         AND id IN (${invoiceIds.map(() => "?").join(",")})
       FOR UPDATE`,
      [req.user.company_id, party_id, ...invoiceIds]
    );

    if (invoiceRows.length !== invoiceIds.length) {
      throw new Error("One or more purchase invoices are invalid for this vendor");
    }

    let totalAmount = 0;
    for (const alloc of allocations) {
      const invoice = invoiceRows.find((x) => Number(x.id) === Number(alloc.purchase_invoice_id));
      const amt = Number(alloc.allocated_amount || 0);
      if (!(amt > 0)) throw new Error("Allocated amount must be greater than zero");
      if (amt > Number(invoice.balance_amount || 0)) {
        throw new Error(`Allocated amount exceeds balance for invoice ${invoice.invoice_no}`);
      }
      totalAmount += amt;
    }

    const voucherNo = await getNextVoucherNo(conn, req.user.company_id, "PV");

    const [vh] = await conn.query(
      `INSERT INTO voucher_header
       (company_id, voucher_no, voucher_type, voucher_date, narration, status, created_by, approved_by)
       VALUES (?, ?, 'PV', ?, ?, 'APPROVED', ?, ?)`,
      [
        req.user.company_id,
        voucherNo,
        payment_date,
        `Vendor payment ${payment_no}`,
        req.user.id,
        req.user.id,
      ]
    );

    const voucherId = vh.insertId;

    await conn.query(
      `INSERT INTO voucher_line (header_id, line_no, account_id, dc, amount, line_narration)
       VALUES
       (?, 1, ?, 'D', ?, ?),
       (?, 2, ?, 'C', ?, ?)`,
      [
        voucherId,
        settings.payable_account_id,
        totalAmount,
        "Vendor allocation",
        voucherId,
        bankOrCashAccountId,
        totalAmount,
        `${payment_mode} payment`,
      ]
    );

    const [paymentResult] = await conn.query(
      `INSERT INTO payments
       (company_id, party_id, payment_no, payment_date, payment_mode, reference_no, amount, remarks, voucher_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.company_id,
        party_id,
        payment_no,
        payment_date,
        String(payment_mode).toUpperCase(),
        reference_no || null,
        Number(totalAmount.toFixed(2)),
        remarks || null,
        voucherId,
        req.user.id,
      ]
    );

    for (const alloc of allocations) {
      const amt = Number(alloc.allocated_amount || 0);

      await conn.query(
        `INSERT INTO payment_allocations (payment_id, purchase_invoice_id, allocated_amount)
         VALUES (?, ?, ?)`,
        [paymentResult.insertId, alloc.purchase_invoice_id, amt]
      );

      await conn.query(
        `UPDATE purchase_invoices
         SET amount_paid = amount_paid + ?,
             balance_amount = balance_amount - ?
         WHERE company_id=? AND id=?`,
        [amt, amt, req.user.company_id, alloc.purchase_invoice_id]
      );
    }

    await writeAuditLog(conn, {
      companyId: req.user.company_id,
      userId: req.user.id,
      action: "VENDOR_PAYMENT_CREATED",
      entityType: "payment",
      entityId: paymentResult.insertId,
      details: `Payment ${payment_no} created for amount ${totalAmount.toFixed(2)}`,
    });

    await conn.commit();

    res.json({
      message: "Payment posted successfully ✅",
      payment_id: paymentResult.insertId,
      voucher_id: voucherId,
      voucher_no: voucherNo,
      amount: Number(totalAmount.toFixed(2)),
    });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ message: "Failed to post payment", error: error.message });
  } finally {
    conn.release();
  }
});
app.get("/api/party-ledger/:partyId", auth, async (req, res) => {
  try {
    const partyId = Number(req.params.partyId);

    const [partyRows] = await pool.query(
      `SELECT * FROM parties WHERE company_id=? AND id=?`,
      [req.user.company_id, partyId]
    );
    if (!partyRows.length) return res.status(404).json({ message: "Party not found" });

    const [sales] = await pool.query(
      `SELECT invoice_date AS txn_date, invoice_no AS doc_no, 'SALES_INVOICE' AS txn_type, amount AS debit, 0 AS credit
       FROM sales_invoices
       WHERE company_id=? AND party_id=?`,
      [req.user.company_id, partyId]
    );

    const [receiptsRows] = await pool.query(
      `SELECT receipt_date AS txn_date, receipt_no AS doc_no, 'RECEIPT' AS txn_type, 0 AS debit, amount AS credit
       FROM receipts
       WHERE company_id=? AND party_id=?`,
      [req.user.company_id, partyId]
    );

    const [purchases] = await pool.query(
      `SELECT invoice_date AS txn_date, invoice_no AS doc_no, 'PURCHASE_INVOICE' AS txn_type, 0 AS debit, amount AS credit
       FROM purchase_invoices
       WHERE company_id=? AND party_id=?`,
      [req.user.company_id, partyId]
    );

    const [paymentsRows] = await pool.query(
      `SELECT payment_date AS txn_date, payment_no AS doc_no, 'PAYMENT' AS txn_type, amount AS debit, 0 AS credit
       FROM payments
       WHERE company_id=? AND party_id=?`,
      [req.user.company_id, partyId]
    );

    const allRows = [...sales, ...receiptsRows, ...purchases, ...paymentsRows].sort(
      (a, b) => new Date(a.txn_date) - new Date(b.txn_date)
    );

    let running = 0;
    const ledger = allRows.map((row) => {
      running += Number(row.debit || 0) - Number(row.credit || 0);
      return {
        ...row,
        running_balance: Number(running.toFixed(2)),
      };
    });

    res.json({
      party: partyRows[0],
      rows: ledger,
      closing_balance: Number(running.toFixed(2)),
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load party ledger", error: error.message });
  }
});


app.post("/api/settings/account-mapping", auth, requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.user.company_id;

    const payload = {
      sales_account_id: req.body.sales_account_id || null,
      purchase_account_id: req.body.purchase_account_id || null,
      receivable_account_id: req.body.receivable_account_id || null,
      payable_account_id: req.body.payable_account_id || null,
      cash_account_id: req.body.cash_account_id || null,
      bank_account_id: req.body.bank_account_id || null,
      cgst_output_account_id: req.body.cgst_output_account_id || null,
      sgst_output_account_id: req.body.sgst_output_account_id || null,
      igst_output_account_id: req.body.igst_output_account_id || null,
      cgst_input_account_id: req.body.cgst_input_account_id || null,
      sgst_input_account_id: req.body.sgst_input_account_id || null,
      igst_input_account_id: req.body.igst_input_account_id || null,
    };

    const [exists] = await pool.query(
      `SELECT id FROM company_account_settings WHERE company_id=? LIMIT 1`,
      [companyId]
    );

    if (!exists.length) {
      await pool.query(
        `INSERT INTO company_account_settings
        (
          company_id,
          sales_account_id,
          purchase_account_id,
          receivable_account_id,
          payable_account_id,
          cash_account_id,
          bank_account_id,
          cgst_output_account_id,
          sgst_output_account_id,
          igst_output_account_id,
          cgst_input_account_id,
          sgst_input_account_id,
          igst_input_account_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          companyId,
          payload.sales_account_id,
          payload.purchase_account_id,
          payload.receivable_account_id,
          payload.payable_account_id,
          payload.cash_account_id,
          payload.bank_account_id,
          payload.cgst_output_account_id,
          payload.sgst_output_account_id,
          payload.igst_output_account_id,
          payload.cgst_input_account_id,
          payload.sgst_input_account_id,
          payload.igst_input_account_id,
        ]
      );
    } else {
      await pool.query(
        `UPDATE company_account_settings
         SET
           sales_account_id=?,
           purchase_account_id=?,
           receivable_account_id=?,
           payable_account_id=?,
           cash_account_id=?,
           bank_account_id=?,
           cgst_output_account_id=?,
           sgst_output_account_id=?,
           igst_output_account_id=?,
           cgst_input_account_id=?,
           sgst_input_account_id=?,
           igst_input_account_id=?
         WHERE company_id=?`,
        [
          payload.sales_account_id,
          payload.purchase_account_id,
          payload.receivable_account_id,
          payload.payable_account_id,
          payload.cash_account_id,
          payload.bank_account_id,
          payload.cgst_output_account_id,
          payload.sgst_output_account_id,
          payload.igst_output_account_id,
          payload.cgst_input_account_id,
          payload.sgst_input_account_id,
          payload.igst_input_account_id,
          companyId,
        ]
      );
    }

    await writeAuditLog(pool, {
      companyId: req.user.company_id,
      userId: req.user.id,
      action: "ACCOUNT_SETTINGS_SAVED",
      entityType: "settings",
      details: "Updated default account mapping settings",
    });

    res.json({ message: "Account mapping settings saved ✅" });
  } catch (error) {
    res.status(500).json({
      message: "Failed to save account mapping settings",
      error: error.message,
    });
  }
});

/* ----------------------------- VOUCHERS ----------------------------- */

app.post("/api/vouchers", auth, requireRole("ADMIN", "PREPARER"), async (req, res) => {
  const missing = requireFields(req.body, ["voucher_date", "voucher_type", "lines"]);
  if (missing) return res.status(400).json({ message: `${missing} is required` });

  const { voucher_date, voucher_type, narration, lines } = req.body;

  if (!Array.isArray(lines) || lines.length < 2) {
    return res.status(400).json({ message: "At least 2 lines required (debit & credit)" });
  }

  let totalD = 0;
  let totalC = 0;

  for (const ln of lines) {
    if (!ln.account_id || !ln.dc || ln.amount === undefined || ln.amount === null) {
      return res.status(400).json({ message: "Each line requires account_id, dc, amount" });
    }

    const amt = Number(ln.amount);
    if (!(amt > 0)) return res.status(400).json({ message: "Line amount must be > 0" });

    if (ln.dc === "D") totalD += amt;
    else if (ln.dc === "C") totalC += amt;
    else return res.status(400).json({ message: "dc must be D or C" });
  }

  if (Number(totalD.toFixed(2)) !== Number(totalC.toFixed(2))) {
    return res.status(400).json({ message: "Voucher not balanced (Debit must equal Credit)" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await ensurePostingAllowed(conn, companyId, someDate, req.user.role);

    const normalizedType = String(voucher_type).toUpperCase();
    const voucherNo = await getNextVoucherNo(conn, req.user.company_id, normalizedType);

    const [h] = await conn.query(
      `INSERT INTO voucher_header
       (company_id, voucher_no, voucher_type, voucher_date, narration, status, created_by)
       VALUES (?, ?, ?, ?, ?, 'DRAFT', ?)`,
      [req.user.company_id, voucherNo, normalizedType, voucher_date, narration || null, req.user.id]
    );

    const headerId = h.insertId;
    const accountIds = [...new Set(lines.map((x) => Number(x.account_id)))];

    const [accRows] = await conn.query(
      `SELECT id FROM accounts WHERE company_id=? AND id IN (${accountIds.map(() => "?").join(",")})`,
      [req.user.company_id, ...accountIds]
    );

    if (accRows.length !== accountIds.length) {
      throw new Error("One or more accounts do not belong to your company.");
    }

    let i = 1;
    for (const ln of lines) {
      await conn.query(
        `INSERT INTO voucher_line (header_id, line_no, account_id, dc, amount, line_narration)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [headerId, i++, ln.account_id, ln.dc, ln.amount, ln.line_narration || null]
      );
    }

    await writeAuditLog(conn, {
      companyId: req.user.company_id,
      userId: req.user.id,
      action: "VOUCHER_CREATED",
      entityType: "voucher",
      entityId: headerId,
      details: `Created voucher ${voucherNo}`,
    });

    await conn.commit();
    res.json({
      message: "Voucher created (DRAFT) ✅",
      voucher_id: headerId,
      voucher_no: voucherNo,
      total_debit: Number(totalD.toFixed(2)),
      total_credit: Number(totalC.toFixed(2)),
    });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ message: "Voucher create failed", error: e.message });
  } finally {
    conn.release();
  }
});

app.get("/api/vouchers", auth, async (req, res) => {
  const { from, to, status } = req.query;
  const params = [req.user.company_id];
  let sql = `SELECT * FROM voucher_header WHERE company_id=?`;

  if (status) {
    sql += ` AND status=?`;
    params.push(String(status).toUpperCase());
  }
  if (from && to) {
    sql += ` AND voucher_date BETWEEN ? AND ?`;
    params.push(from, to);
  }

  sql += ` ORDER BY voucher_date DESC, id DESC`;

  const [rows] = await pool.query(sql, params);
  res.json(rows);
});

app.get("/api/vouchers/:id", auth, async (req, res) => {
  const id = Number(req.params.id);

  const [h] = await pool.query(
    `SELECT * FROM voucher_header WHERE company_id=? AND id=?`,
    [req.user.company_id, id]
  );
  if (!h.length) return res.status(404).json({ message: "Voucher not found" });

  const [l] = await pool.query(
    `SELECT vl.*, a.account_name, a.account_code
     FROM voucher_line vl
     JOIN accounts a ON a.id = vl.account_id
     WHERE vl.header_id=?
     ORDER BY vl.line_no ASC`,
    [id]
  );

  const totals = l.reduce(
    (acc, row) => {
      const amt = Number(row.amount || 0);
      if (row.dc === "D") acc.debit += amt;
      if (row.dc === "C") acc.credit += amt;
      return acc;
    },
    { debit: 0, credit: 0 }
  );

  res.json({
    header: h[0],
    lines: l,
    totals: {
      debit: Number(totals.debit.toFixed(2)),
      credit: Number(totals.credit.toFixed(2)),
    },
  });
});

app.post("/api/vouchers/:id/preapprove", auth, requireRole("ADMIN", "APPROVER"), async (req, res) => {
  const id = Number(req.params.id);

  const [r] = await pool.query(
    `UPDATE voucher_header
     SET status='PREAPPROVED'
     WHERE company_id=? AND id=? AND status='DRAFT'`,
    [req.user.company_id, id]
  );

  if (r.affectedRows === 0) {
    return res.status(400).json({ message: "Only DRAFT vouchers can be preapproved" });
  }

  await writeAuditLog(pool, {
    companyId: req.user.company_id,
    userId: req.user.id,
    action: "VOUCHER_PREAPPROVED",
    entityType: "voucher",
    entityId: id,
    details: `Voucher ${id} preapproved`,
  });

  res.json({ message: "Voucher PREAPPROVED ✅" });
});

app.post("/api/vouchers/:id/approve", auth, requireRole("ADMIN", "APPROVER"), async (req, res) => {
  const id = Number(req.params.id);

  const [vhRows] = await pool.query(
    `SELECT voucher_date FROM voucher_header WHERE company_id=? AND id=?`,
    [req.user.company_id, id]
  );
  if (!vhRows.length) return res.status(404).json({ message: "Voucher not found" });

  try {
    await ensurePostingAllowed(conn, companyId, someDate, req.user.role);
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }

  const [sum] = await pool.query(
    `SELECT
       SUM(CASE WHEN dc='D' THEN amount ELSE 0 END) AS deb,
       SUM(CASE WHEN dc='C' THEN amount ELSE 0 END) AS cre
     FROM voucher_line
     WHERE header_id=?`,
    [id]
  );

  const deb = Number(sum[0].deb || 0);
  const cre = Number(sum[0].cre || 0);
  if (Number(deb.toFixed(2)) !== Number(cre.toFixed(2))) {
    return res.status(400).json({ message: "Cannot approve: voucher not balanced" });
  }

  const [r] = await pool.query(
    `UPDATE voucher_header
     SET status='APPROVED', approved_by=?
     WHERE company_id=? AND id=? AND status IN ('DRAFT','PREAPPROVED')`,
    [req.user.id, req.user.company_id, id]
  );

  if (r.affectedRows === 0) {
    return res.status(400).json({ message: "Voucher must be DRAFT/PREAPPROVED to approve" });
  }

  await writeAuditLog(pool, {
    companyId: req.user.company_id,
    userId: req.user.id,
    action: "VOUCHER_APPROVED",
    entityType: "voucher",
    entityId: id,
    details: `Voucher ${id} approved`,
  });

  res.json({ message: "Voucher APPROVED ✅" });
});

app.post("/api/vouchers/:id/cancel", auth, requireRole("ADMIN", "APPROVER"), async (req, res) => {
  const id = Number(req.params.id);
  const { mode } = req.body || {};
  const finalMode = mode === "ROLLBACK" ? "ROLLBACK" : "CANCELLED";

  const [vhRows] = await pool.query(
    `SELECT voucher_date FROM voucher_header WHERE company_id=? AND id=?`,
    [req.user.company_id, id]
  );
  if (!vhRows.length) return res.status(404).json({ message: "Voucher not found" });

  try {
    await ensurePostingAllowed(conn, companyId, someDate, req.user.role);
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }

  const [r] = await pool.query(
    `UPDATE voucher_header
     SET status=?
     WHERE company_id=? AND id=? AND status IN ('DRAFT','PREAPPROVED','APPROVED')`,
    [finalMode, req.user.company_id, id]
  );

  if (r.affectedRows === 0) {
    return res.status(400).json({ message: "Voucher cannot be cancelled/rollback in this state" });
  }

  await writeAuditLog(pool, {
    companyId: req.user.company_id,
    userId: req.user.id,
    action: finalMode === "ROLLBACK" ? "VOUCHER_ROLLBACK" : "VOUCHER_CANCELLED",
    entityType: "voucher",
    entityId: id,
    details: `Voucher ${id} set to ${finalMode}`,
  });

  res.json({ message: `Voucher ${finalMode} ✅` });
});

/* ----------------------------- INVOICES ----------------------------- */

app.post("/api/ai/create-draft-invoice", auth, async (req, res) => {
  try {
    const { intake_id, extracted } = req.body;

    const companyId = req.user.company_id;

    // Find party
    const [party] = await pool.query(
      "SELECT id FROM parties WHERE party_name=? AND company_id=? LIMIT 1",
      [extracted.party_name, companyId]
    );

    const partyId = party[0]?.id || null;

    // Insert draft invoice
    const [invResult] = await pool.query(
      `INSERT INTO ai_purchase_invoices
       (company_id, intake_id, party_id, invoice_no, invoice_date,
        taxable_amount, cgst_amount, sgst_amount, igst_amount, total_amount, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        intake_id,
        partyId,
        extracted.invoice_no,
        extracted.invoice_date,
        extracted.taxable_amount,
        extracted.cgst_amount,
        extracted.sgst_amount,
        extracted.igst_amount,
        extracted.total_amount,
        req.user.id,
      ]
    );

    const draftId = invResult.insertId;

    // Insert lines
    for (const item of extracted.items || []) {
      await pool.query(
        `INSERT INTO ai_purchase_invoice_lines
         (draft_invoice_id, description, qty, rate, amount, is_new_item)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          draftId,
          item.description,
          item.qty || 1,
          item.rate || item.amount,
          item.amount,
          1,
        ]
      );
    }

    res.json({
      message: "Draft invoice created",
      draft_invoice_id: draftId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create draft invoice" });
  }
});
app.post("/api/ai/approve-draft-invoice/:id", auth, async (req, res) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const draftId = req.params.id;

    const [inv] = await conn.query(
      "SELECT * FROM ai_purchase_invoices WHERE id=?",
      [draftId]
    );

    if (!inv.length) throw new Error("Draft not found");

    const draft = inv[0];

    const [lines] = await conn.query(
      "SELECT * FROM ai_purchase_invoice_lines WHERE draft_invoice_id=?",
      [draftId]
    );

    // Create real purchase invoice
    const [realInv] = await conn.query(
      `INSERT INTO purchase_invoices
       (company_id, party_id, invoice_no, invoice_date, total_amount)
       VALUES (?, ?, ?, ?, ?)`,
      [
        draft.company_id,
        draft.party_id,
        draft.invoice_no,
        draft.invoice_date,
        draft.total_amount,
      ]
    );

    const realId = realInv.insertId;

    // Insert lines
    for (const line of lines) {
      await conn.query(
        `INSERT INTO purchase_invoice_lines
         (invoice_id, description, qty, rate, amount)
         VALUES (?, ?, ?, ?, ?)`,
        [realId, line.description, line.qty, line.rate, line.amount]
      );
    }

    // Mark approved
    await conn.query(
      "UPDATE ai_purchase_invoices SET status='APPROVED' WHERE id=?",
      [draftId]
    );

    await conn.commit();

    res.json({
      message: "Invoice created successfully ✅",
      invoice_id: realId,
    });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: err.message });
  } finally {
    conn.release();
  }
});
app.post("/api/ai/parse-voucher", async (req, res) => {
  try {
    const { text } = req.body;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `Convert this into accounting voucher JSON:
"${text}"

Return:
{
  "type": "",
  "entries": [{ "account": "", "debit": 0, "credit": 0 }]
}`,
        },
      ],
    });

    res.json(JSON.parse(response.choices[0].message.content));
  } catch (err) {
    res.status(500).json({ error: "AI voucher failed" });
  }
});
app.post("/api/ai/invoice-to-party", upload.single("file"), async (req, res) => {
  try {
    const fileData = fs.readFileSync(req.file.path, { encoding: "base64" });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract supplier/customer details from invoice.
Return JSON:
{
  "name": "",
  "type": "SUPPLIER or CUSTOMER",
  "phone": "",
  "gst": "",
  "amount": 0
}`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${fileData}`,
              },
            },
          ],
        },
      ],
    });

    fs.unlinkSync(req.file.path);

    const aiData = JSON.parse(response.choices[0].message.content);

    // 🔥 USE YOUR EXISTING DB HERE
    const [existing] = await pool.query(
      "SELECT * FROM parties WHERE name = ?",
      [aiData.name]
    );

    if (existing.length > 0) {
      return res.json({
        message: "Existing party found",
        party: existing[0],
        aiData,
      });
    }

    const [result] = await pool.query(
      `INSERT INTO parties (name, type, phone, gst)
       VALUES (?, ?, ?, ?)`,
      [aiData.name, aiData.type, aiData.phone, aiData.gst]
    );

    res.json({
      message: "New party created",
      party: {
        id: result.insertId,
        ...aiData,
      },
      aiData,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI invoice failed" });
  }
});
app.post("/api/ai/search", async (req, res) => {
  try {
    const { query } = req.body;
    const q = query.toLowerCase();

    if (q.includes("invoice")) return res.json({ route: "/invoices" });
    if (q.includes("voucher")) return res.json({ route: "/vouchers" });
    if (q.includes("supplier")) return res.json({ route: "/parties" });

    res.json({ route: "/" });
  } catch {
    res.status(500).json({ error: "Search failed" });
  }
});
app.get("/api/sales-invoices", auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT si.*, p.party_name
       FROM sales_invoices si
       JOIN parties p ON p.id = si.party_id
       WHERE si.company_id=?
       ORDER BY si.invoice_date DESC, si.id DESC`,
      [req.user.company_id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Failed to load sales invoices", error: error.message });
  }
});

app.get("/api/purchase-invoices", auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT pi.*, p.party_name
       FROM purchase_invoices pi
       JOIN parties p ON p.id = pi.party_id
       WHERE pi.company_id=?
       ORDER BY pi.invoice_date DESC, pi.id DESC`,
      [req.user.company_id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Failed to load purchase invoices", error: error.message });
  }
});

app.post("/api/sales-invoices", auth, requireRole("ADMIN", "PREPARER"), async (req, res) => {
  const missing = requireFields(req.body, ["party_id", "invoice_no", "invoice_date", "lines"]);
  if (missing) return res.status(400).json({ message: `${missing} is required` });

  if (!Array.isArray(req.body.lines) || req.body.lines.length === 0) {
    return res.status(400).json({ message: "At least one invoice line is required" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { party_id, invoice_no, invoice_date, lines } = req.body;
    const companyId = req.user.company_id;

    await ensurePostingAllowed(conn, companyId, someDate, req.user.role);

    const [settingsRows] = await conn.query(
      `SELECT * FROM company_account_settings WHERE company_id=? LIMIT 1`,
      [companyId]
    );
    if (!settingsRows.length) throw new Error("Account mapping settings not configured");

    const settings = settingsRows[0];
    if (!settings.sales_account_id || !settings.receivable_account_id) {
      throw new Error("Sales and receivable accounts must be configured in Settings");
    }

    const itemIds = [...new Set(lines.map((x) => Number(x.item_id)))];
    const [itemRows] = await conn.query(
      `SELECT * FROM items WHERE company_id=? AND id IN (${itemIds.map(() => "?").join(",")})`,
      [companyId, ...itemIds]
    );
    if (itemRows.length !== itemIds.length) {
      throw new Error("One or more items are invalid");
    }

    let taxable = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    const preparedLines = lines.map((ln) => {
      const item = itemRows.find((i) => Number(i.id) === Number(ln.item_id));
      const qty = Number(ln.qty || 0);
      const rate = Number(ln.rate || item.sales_rate || 0);
      const lineTaxable = Number((qty * rate).toFixed(2));

      const taxPct = Number(
        ln.tax_percent !== undefined ? ln.tax_percent : item.tax_percent || 0
      );

      const lineCgst = Number((((lineTaxable * taxPct) / 100) / 2).toFixed(2));
      const lineSgst = Number((((lineTaxable * taxPct) / 100) / 2).toFixed(2));
      const lineIgst = 0;
      const lineTotal = Number((lineTaxable + lineCgst + lineSgst + lineIgst).toFixed(2));

      taxable += lineTaxable;
      cgst += lineCgst;
      sgst += lineSgst;
      igst += lineIgst;

      return {
        item,
        description_text: ln.description_text || item.item_name,
        qty,
        rate,
        taxable_amount: lineTaxable,
        cgst_amount: lineCgst,
        sgst_amount: lineSgst,
        igst_amount: lineIgst,
        line_total: lineTotal,
      };
    });

    const totalAmount = Number((taxable + cgst + sgst + igst).toFixed(2));
    const voucherNo = await getNextVoucherNo(conn, companyId, "RV");

    const [vh] = await conn.query(
      `INSERT INTO voucher_header
       (company_id, voucher_no, voucher_type, voucher_date, narration, status, created_by, approved_by)
       VALUES (?, ?, 'RV', ?, ?, 'APPROVED', ?, ?)`,
      [companyId, voucherNo, invoice_date, `Sales Invoice ${invoice_no}`, req.user.id, req.user.id]
    );

    const voucherId = vh.insertId;
    let voucherLineNo = 1;

    await conn.query(
      `INSERT INTO voucher_line (header_id, line_no, account_id, dc, amount, line_narration)
       VALUES (?, ?, ?, 'D', ?, ?)`,
      [voucherId, voucherLineNo++, settings.receivable_account_id, totalAmount, "Customer receivable"]
    );

    await conn.query(
      `INSERT INTO voucher_line (header_id, line_no, account_id, dc, amount, line_narration)
       VALUES (?, ?, ?, 'C', ?, ?)`,
      [voucherId, voucherLineNo++, settings.sales_account_id, taxable, "Sales credit"]
    );

    if (cgst > 0 && settings.cgst_output_account_id) {
      await conn.query(
        `INSERT INTO voucher_line (header_id, line_no, account_id, dc, amount, line_narration)
         VALUES (?, ?, ?, 'C', ?, ?)`,
        [voucherId, voucherLineNo++, settings.cgst_output_account_id, cgst, "CGST output"]
      );
    }

    if (sgst > 0 && settings.sgst_output_account_id) {
      await conn.query(
        `INSERT INTO voucher_line (header_id, line_no, account_id, dc, amount, line_narration)
         VALUES (?, ?, ?, 'C', ?, ?)`,
        [voucherId, voucherLineNo++, settings.sgst_output_account_id, sgst, "SGST output"]
      );
    }

    if (igst > 0 && settings.igst_output_account_id) {
      await conn.query(
        `INSERT INTO voucher_line (header_id, line_no, account_id, dc, amount, line_narration)
         VALUES (?, ?, ?, 'C', ?, ?)`,
        [voucherId, voucherLineNo++, settings.igst_output_account_id, igst, "IGST output"]
      );
    }

    const [inv] = await conn.query(
      `INSERT INTO sales_invoices
       (company_id, party_id, invoice_no, invoice_date, amount, taxable_amount, cgst_amount, sgst_amount, igst_amount, amount_received, balance_amount, status, voucher_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'POSTED', ?, ?)`,
      [
        companyId,
        party_id,
        invoice_no,
        invoice_date,
        totalAmount,
        taxable,
        cgst,
        sgst,
        igst,
        totalAmount,
        voucherId,
        req.user.id,
      ]
    );

    for (const [index, line] of preparedLines.entries()) {
      await conn.query(
        `INSERT INTO sales_invoice_lines
         (sales_invoice_id, item_id, description_text, qty, rate, taxable_amount, cgst_amount, sgst_amount, igst_amount, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          inv.insertId,
          line.item.id,
          line.description_text,
          line.qty,
          line.rate,
          line.taxable_amount,
          line.cgst_amount,
          line.sgst_amount,
          line.igst_amount,
          line.line_total,
        ]
      );

      if (Number(line.item.track_inventory) === 1 && line.item.item_type === "GOODS") {
        await conn.query(
          `INSERT INTO stock_movements
           (company_id, item_id, txn_date, movement_type, qty_in, qty_out, reference_type, reference_id, remarks)
           VALUES (?, ?, ?, 'SALE', 0, ?, 'sales_invoice', ?, ?)`,
          [
            companyId,
            line.item.id,
            invoice_date,
            line.qty,
            inv.insertId,
            `Sales invoice line ${index + 1}`,
          ]
        );
      }
    }

    await writeAuditLog(conn, {
      companyId,
      userId: req.user.id,
      action: "SALES_INVOICE_POSTED",
      entityType: "sales_invoice",
      entityId: inv.insertId,
      details: `Posted sales invoice ${invoice_no} with ${preparedLines.length} lines`,
    });

    await conn.commit();
    res.json({
      message: "Sales invoice posted ✅",
      invoice_id: inv.insertId,
      voucher_id: voucherId,
      voucher_no: voucherNo,
      total_amount: totalAmount,
    });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ message: "Failed to create sales invoice", error: error.message });
  } finally {
    conn.release();
  }
});

app.post("/api/purchase-invoices", auth, requireRole("ADMIN", "PREPARER"), async (req, res) => {
  const missing = requireFields(req.body, ["party_id", "invoice_no", "invoice_date", "lines"]);
  if (missing) return res.status(400).json({ message: `${missing} is required` });

  if (!Array.isArray(req.body.lines) || req.body.lines.length === 0) {
    return res.status(400).json({ message: "At least one invoice line is required" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { party_id, invoice_no, invoice_date, lines } = req.body;
    const companyId = req.user.company_id;

    await ensurePostingAllowed(conn, companyId, someDate, req.user.role);

    const [settingsRows] = await conn.query(
      `SELECT * FROM company_account_settings WHERE company_id=? LIMIT 1`,
      [companyId]
    );
    if (!settingsRows.length) throw new Error("Account mapping settings not configured");

    const settings = settingsRows[0];
    if (!settings.purchase_account_id || !settings.payable_account_id) {
      throw new Error("Purchase and payable accounts must be configured in Settings");
    }

    const itemIds = [...new Set(lines.map((x) => Number(x.item_id)))];
    const [itemRows] = await conn.query(
      `SELECT * FROM items WHERE company_id=? AND id IN (${itemIds.map(() => "?").join(",")})`,
      [companyId, ...itemIds]
    );
    if (itemRows.length !== itemIds.length) {
      throw new Error("One or more items are invalid");
    }

    let taxable = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    const preparedLines = lines.map((ln) => {
      const item = itemRows.find((i) => Number(i.id) === Number(ln.item_id));
      const qty = Number(ln.qty || 0);
      const rate = Number(ln.rate || item.purchase_rate || 0);
      const lineTaxable = Number((qty * rate).toFixed(2));

      const taxPct = Number(
        ln.tax_percent !== undefined ? ln.tax_percent : item.tax_percent || 0
      );

      const lineCgst = Number((((lineTaxable * taxPct) / 100) / 2).toFixed(2));
      const lineSgst = Number((((lineTaxable * taxPct) / 100) / 2).toFixed(2));
      const lineIgst = 0;
      const lineTotal = Number((lineTaxable + lineCgst + lineSgst + lineIgst).toFixed(2));

      taxable += lineTaxable;
      cgst += lineCgst;
      sgst += lineSgst;
      igst += lineIgst;

      return {
        item,
        description_text: ln.description_text || item.item_name,
        qty,
        rate,
        taxable_amount: lineTaxable,
        cgst_amount: lineCgst,
        sgst_amount: lineSgst,
        igst_amount: lineIgst,
        line_total: lineTotal,
      };
    });

    const totalAmount = Number((taxable + cgst + sgst + igst).toFixed(2));
    const voucherNo = await getNextVoucherNo(conn, companyId, "PV");

    const [vh] = await conn.query(
      `INSERT INTO voucher_header
       (company_id, voucher_no, voucher_type, voucher_date, narration, status, created_by, approved_by)
       VALUES (?, ?, 'PV', ?, ?, 'APPROVED', ?, ?)`,
      [companyId, voucherNo, invoice_date, `Purchase Invoice ${invoice_no}`, req.user.id, req.user.id]
    );

    const voucherId = vh.insertId;
    let voucherLineNo = 1;

    await conn.query(
      `INSERT INTO voucher_line (header_id, line_no, account_id, dc, amount, line_narration)
       VALUES (?, ?, ?, 'D', ?, ?)`,
      [voucherId, voucherLineNo++, settings.purchase_account_id, taxable, "Purchase debit"]
    );

    if (cgst > 0 && settings.cgst_input_account_id) {
      await conn.query(
        `INSERT INTO voucher_line (header_id, line_no, account_id, dc, amount, line_narration)
         VALUES (?, ?, ?, 'D', ?, ?)`,
        [voucherId, voucherLineNo++, settings.cgst_input_account_id, cgst, "CGST input"]
      );
    }

    if (sgst > 0 && settings.sgst_input_account_id) {
      await conn.query(
        `INSERT INTO voucher_line (header_id, line_no, account_id, dc, amount, line_narration)
         VALUES (?, ?, ?, 'D', ?, ?)`,
        [voucherId, voucherLineNo++, settings.sgst_input_account_id, sgst, "SGST input"]
      );
    }

    if (igst > 0 && settings.igst_input_account_id) {
      await conn.query(
        `INSERT INTO voucher_line (header_id, line_no, account_id, dc, amount, line_narration)
         VALUES (?, ?, ?, 'D', ?, ?)`,
        [voucherId, voucherLineNo++, settings.igst_input_account_id, igst, "IGST input"]
      );
    }

    await conn.query(
      `INSERT INTO voucher_line (header_id, line_no, account_id, dc, amount, line_narration)
       VALUES (?, ?, ?, 'C', ?, ?)`,
      [voucherId, voucherLineNo++, settings.payable_account_id, totalAmount, "Vendor payable"]
    );

    const [inv] = await conn.query(
      `INSERT INTO purchase_invoices
       (company_id, party_id, invoice_no, invoice_date, amount, taxable_amount, cgst_amount, sgst_amount, igst_amount, amount_paid, balance_amount, status, voucher_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'POSTED', ?, ?)`,
      [
        companyId,
        party_id,
        invoice_no,
        invoice_date,
        totalAmount,
        taxable,
        cgst,
        sgst,
        igst,
        totalAmount,
        voucherId,
        req.user.id,
      ]
    );

    for (const [index, line] of preparedLines.entries()) {
      await conn.query(
        `INSERT INTO purchase_invoice_lines
         (purchase_invoice_id, item_id, description_text, qty, rate, taxable_amount, cgst_amount, sgst_amount, igst_amount, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          inv.insertId,
          line.item.id,
          line.description_text,
          line.qty,
          line.rate,
          line.taxable_amount,
          line.cgst_amount,
          line.sgst_amount,
          line.igst_amount,
          line.line_total,
        ]
      );

      if (Number(line.item.track_inventory) === 1 && line.item.item_type === "GOODS") {
        await conn.query(
          `INSERT INTO stock_movements
           (company_id, item_id, txn_date, movement_type, qty_in, qty_out, reference_type, reference_id, remarks)
           VALUES (?, ?, ?, 'PURCHASE', ?, 0, 'purchase_invoice', ?, ?)`,
          [
            companyId,
            line.item.id,
            invoice_date,
            line.qty,
            inv.insertId,
            `Purchase invoice line ${index + 1}`,
          ]
        );
      }
    }

    await writeAuditLog(conn, {
      companyId,
      userId: req.user.id,
      action: "PURCHASE_INVOICE_POSTED",
      entityType: "purchase_invoice",
      entityId: inv.insertId,
      details: `Posted purchase invoice ${invoice_no} with ${preparedLines.length} lines`,
    });

    await conn.commit();
    res.json({
      message: "Purchase invoice posted ✅",
      invoice_id: inv.insertId,
      voucher_id: voucherId,
      voucher_no: voucherNo,
      total_amount: totalAmount,
    });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ message: "Failed to create purchase invoice", error: error.message });
  } finally {
    conn.release();
  }
});
app.get("/api/deliveries", auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         dn.*,
         so.so_no,
         p.party_name
       FROM delivery_notes dn
       JOIN sales_orders so ON so.id = dn.sales_order_id
       JOIN parties p ON p.id = so.customer_id
       WHERE dn.company_id=?
       ORDER BY dn.delivery_date DESC, dn.id DESC`,
      [req.user.company_id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Failed to load deliveries", error: error.message });
  }
});

app.get("/api/deliveries/:id", auth, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const [headerRows] = await pool.query(
      `SELECT
         dn.*,
         so.so_no,
         so.customer_id,
         p.party_code,
         p.party_name
       FROM delivery_notes dn
       JOIN sales_orders so ON so.id = dn.sales_order_id
       JOIN parties p ON p.id = so.customer_id
       WHERE dn.company_id=? AND dn.id=?`,
      [req.user.company_id, id]
    );

    if (!headerRows.length) {
      return res.status(404).json({ message: "Delivery not found" });
    }

    const [lineRows] = await pool.query(
      `SELECT
         dnl.*,
         i.item_code,
         i.item_name,
         i.unit
       FROM delivery_note_lines dnl
       JOIN items i ON i.id = dnl.item_id
       WHERE dnl.delivery_note_id=?
       ORDER BY dnl.id ASC`,
      [id]
    );

    res.json({ header: headerRows[0], lines: lineRows });
  } catch (error) {
    res.status(500).json({ message: "Failed to load delivery details", error: error.message });
  }
});

app.post("/api/deliveries", auth, requireRole("ADMIN", "PREPARER"), async (req, res) => {
  const missing = requireFields(req.body, ["sales_order_id", "delivery_no", "delivery_date", "lines"]);
  if (missing) return res.status(400).json({ message: `${missing} is required` });

  if (!Array.isArray(req.body.lines) || req.body.lines.length === 0) {
    return res.status(400).json({ message: "At least one delivery line is required" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { sales_order_id, delivery_no, delivery_date, remarks, lines } = req.body;
    await ensurePostingAllowed(conn, companyId, someDate, req.user.role);
    const [soRows] = await conn.query(
      `SELECT *
       FROM sales_orders
       WHERE company_id=? AND id=?`,
      [req.user.company_id, sales_order_id]
    );

    if (!soRows.length) throw new Error("Sales order not found");

    const [soLineRows] = await conn.query(
      `SELECT
         sol.*,
         i.item_type,
         i.track_inventory
       FROM sales_order_lines sol
       JOIN items i ON i.id = sol.item_id
       WHERE sol.sales_order_id=?
       ORDER BY sol.id ASC`,
      [sales_order_id]
    );

    if (!soLineRows.length) throw new Error("Sales order has no lines");

    const [dnResult] = await conn.query(
      `INSERT INTO delivery_notes
       (company_id, sales_order_id, delivery_no, delivery_date, status, remarks, created_by)
       VALUES (?, ?, ?, ?, 'POSTED', ?, ?)`,
      [
        req.user.company_id,
        sales_order_id,
        delivery_no,
        delivery_date,
        remarks || null,
        req.user.id,
      ]
    );

    for (const ln of lines) {
      const sourceLine = soLineRows.find((x) => Number(x.id) === Number(ln.sales_order_line_id));
      if (!sourceLine) continue;

      const deliveredQty = Number(ln.delivered_qty || 0);
      const rate = Number(sourceLine.rate || 0);
      const taxPercent = Number(sourceLine.tax_percent || 0);
      const taxableAmount = Number((deliveredQty * rate).toFixed(2));
      const taxAmount = Number(((taxableAmount * taxPercent) / 100).toFixed(2));
      const lineTotal = Number((taxableAmount + taxAmount).toFixed(2));

      await conn.query(
        `INSERT INTO delivery_note_lines
         (delivery_note_id, sales_order_line_id, item_id, delivered_qty, rate, tax_percent, taxable_amount, tax_amount, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          dnResult.insertId,
          sourceLine.id,
          sourceLine.item_id,
          deliveredQty,
          rate,
          taxPercent,
          taxableAmount,
          taxAmount,
          lineTotal,
        ]
      );

      if (Number(sourceLine.track_inventory) === 1 && String(sourceLine.item_type) === "GOODS") {
        await conn.query(
          `INSERT INTO stock_movements
           (company_id, item_id, txn_date, movement_type, qty_in, qty_out, reference_type, reference_id, remarks)
           VALUES (?, ?, ?, 'SALE', 0, ?, 'delivery_note', ?, ?)`,
          [
            req.user.company_id,
            sourceLine.item_id,
            delivery_date,
            deliveredQty,
            dnResult.insertId,
            `Delivery ${delivery_no}`,
          ]
        );
      }
    }

    await conn.query(
      `UPDATE sales_orders
       SET status='PARTIAL', approved_by=?
       WHERE company_id=? AND id=?`,
      [req.user.id, req.user.company_id, sales_order_id]
    );

    await writeAuditLog(conn, {
      companyId: req.user.company_id,
      userId: req.user.id,
      action: "DELIVERY_CREATED",
      entityType: "delivery_note",
      entityId: dnResult.insertId,
      details: `Created delivery ${delivery_no}`,
    });

    await conn.commit();
    res.json({ message: "Delivery note created ✅", delivery_note_id: dnResult.insertId });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ message: "Failed to create delivery", error: error.message });
  } finally {
    conn.release();
  }
});
app.post("/api/sales-orders/:id/convert-to-invoice", auth, requireRole("ADMIN", "PREPARER"), async (req, res) => {
  const soId = Number(req.params.id);
  const { invoice_no, invoice_date } = req.body;

  if (!invoice_no || !invoice_date) {
    return res.status(400).json({ message: "invoice_no and invoice_date are required" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await ensurePostingAllowed(conn, companyId, someDate, req.user.role);

    const [soRows] = await conn.query(
      `SELECT * FROM sales_orders WHERE company_id=? AND id=? FOR UPDATE`,
      [req.user.company_id, soId]
    );
    if (!soRows.length) throw new Error("Sales order not found");

    const so = soRows[0];
    if (["CLOSED", "CANCELLED"].includes(String(so.status || "").toUpperCase())) {
      throw new Error("This sales order cannot be converted");
    }

    const [existingInvoiceRows] = await conn.query(
      `SELECT id, invoice_no FROM sales_invoices WHERE company_id=? AND source_so_id=?`,
      [req.user.company_id, soId]
    );
    if (existingInvoiceRows.length) {
      throw new Error(`This SO is already converted to invoice ${existingInvoiceRows[0].invoice_no}`);
    }

    const [lineRows] = await conn.query(
      `SELECT
         sol.*,
         i.item_type,
         i.track_inventory
       FROM sales_order_lines sol
       JOIN items i ON i.id = sol.item_id
       WHERE sol.sales_order_id=?
       ORDER BY sol.id ASC`,
      [soId]
    );
    if (!lineRows.length) throw new Error("Sales order has no lines");

    const [settingsRows] = await conn.query(
      `SELECT * FROM company_account_settings WHERE company_id=? LIMIT 1`,
      [req.user.company_id]
    );
    if (!settingsRows.length) throw new Error("Account mapping settings not configured");

    const settings = settingsRows[0];
    if (!settings.sales_account_id || !settings.receivable_account_id) {
      throw new Error("Sales and receivable accounts must be configured in Settings");
    }

    let taxable = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    const preparedLines = lineRows.map((ln) => {
      const qty = Number(ln.qty || 0);
      const rate = Number(ln.rate || 0);
      const taxPercent = Number(ln.tax_percent || 0);
      const taxableAmount = Number((qty * rate).toFixed(2));
      const totalTax = Number(((taxableAmount * taxPercent) / 100).toFixed(2));
      const lineCgst = Number((totalTax / 2).toFixed(2));
      const lineSgst = Number((totalTax / 2).toFixed(2));
      const lineIgst = 0;
      const lineTotal = Number((taxableAmount + lineCgst + lineSgst + lineIgst).toFixed(2));

      taxable += taxableAmount;
      cgst += lineCgst;
      sgst += lineSgst;
      igst += lineIgst;

      return {
        ...ln,
        taxable_amount: taxableAmount,
        cgst_amount: lineCgst,
        sgst_amount: lineSgst,
        igst_amount: lineIgst,
        line_total: lineTotal,
      };
    });

    const totalAmount = Number((taxable + cgst + sgst + igst).toFixed(2));
    const voucherNo = await getNextVoucherNo(conn, req.user.company_id, "RV");

    const [vh] = await conn.query(
      `INSERT INTO voucher_header
       (company_id, voucher_no, voucher_type, voucher_date, narration, status, created_by, approved_by)
       VALUES (?, ?, 'RV', ?, ?, 'APPROVED', ?, ?)`,
      [
        req.user.company_id,
        voucherNo,
        invoice_date,
        `Sales Invoice ${invoice_no} from SO ${so.so_no}`,
        req.user.id,
        req.user.id,
      ]
    );

    const voucherId = vh.insertId;
    let voucherLineNo = 1;

    await conn.query(
      `INSERT INTO voucher_line (header_id, line_no, account_id, dc, amount, line_narration)
       VALUES (?, ?, ?, 'D', ?, ?)`,
      [voucherId, voucherLineNo++, settings.receivable_account_id, totalAmount, "Customer receivable from SO"]
    );

    await conn.query(
      `INSERT INTO voucher_line (header_id, line_no, account_id, dc, amount, line_narration)
       VALUES (?, ?, ?, 'C', ?, ?)`,
      [voucherId, voucherLineNo++, settings.sales_account_id, taxable, "Sales credit from SO"]
    );

    if (cgst > 0 && settings.cgst_output_account_id) {
      await conn.query(
        `INSERT INTO voucher_line (header_id, line_no, account_id, dc, amount, line_narration)
         VALUES (?, ?, ?, 'C', ?, ?)`,
        [voucherId, voucherLineNo++, settings.cgst_output_account_id, cgst, "CGST output from SO"]
      );
    }

    if (sgst > 0 && settings.sgst_output_account_id) {
      await conn.query(
        `INSERT INTO voucher_line (header_id, line_no, account_id, dc, amount, line_narration)
         VALUES (?, ?, ?, 'C', ?, ?)`,
        [voucherId, voucherLineNo++, settings.sgst_output_account_id, sgst, "SGST output from SO"]
      );
    }

    const [invResult] = await conn.query(
      `INSERT INTO sales_invoices
       (company_id, party_id, invoice_no, invoice_date, amount, taxable_amount, cgst_amount, sgst_amount, igst_amount, amount_received, balance_amount, status, voucher_id, created_by, source_so_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'POSTED', ?, ?, ?)`,
      [
        req.user.company_id,
        so.customer_id,
        invoice_no,
        invoice_date,
        totalAmount,
        taxable,
        cgst,
        sgst,
        igst,
        totalAmount,
        voucherId,
        req.user.id,
        soId,
      ]
    );

    for (const [index, line] of preparedLines.entries()) {
      await conn.query(
        `INSERT INTO sales_invoice_lines
         (sales_invoice_id, item_id, description_text, qty, rate, taxable_amount, cgst_amount, sgst_amount, igst_amount, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          invResult.insertId,
          line.item_id,
          line.description_text || null,
          line.qty,
          line.rate,
          line.taxable_amount,
          line.cgst_amount,
          line.sgst_amount,
          line.igst_amount,
          line.line_total,
        ]
      );

      if (Number(line.track_inventory) === 1 && String(line.item_type) === "GOODS") {
        await conn.query(
          `INSERT INTO stock_movements
           (company_id, item_id, txn_date, movement_type, qty_in, qty_out, reference_type, reference_id, remarks)
           VALUES (?, ?, ?, 'SALE', 0, ?, 'sales_invoice', ?, ?)`,
          [
            req.user.company_id,
            line.item_id,
            invoice_date,
            line.qty,
            invResult.insertId,
            `Converted from SO ${so.so_no}, line ${index + 1}`,
          ]
        );
      }
    }

    await conn.query(
      `UPDATE sales_orders
       SET status='CLOSED', approved_by=?
       WHERE company_id=? AND id=?`,
      [req.user.id, req.user.company_id, soId]
    );

    await writeAuditLog(conn, {
      companyId: req.user.company_id,
      userId: req.user.id,
      action: "SALES_ORDER_CONVERTED",
      entityType: "sales_order",
      entityId: soId,
      details: `Converted SO ${so.so_no} to sales invoice ${invoice_no}`,
    });

    await conn.commit();

    res.json({
      message: "Sales order converted to sales invoice ✅",
      sales_invoice_id: invResult.insertId,
      voucher_id: voucherId,
      voucher_no: voucherNo,
      total_amount: totalAmount,
    });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ message: "Failed to convert sales order", error: error.message });
  } finally {
    conn.release();
  }
});
/* ----------------------------- GST REPORTS ----------------------------- */

app.get("/api/reports/gst-summary", auth, async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ message: "from and to are required" });

  try {
    const companyId = req.user.company_id;

    const [[sales]] = await pool.query(
      `SELECT
         COALESCE(SUM(taxable_amount), 0) AS taxable_amount,
         COALESCE(SUM(cgst_amount), 0) AS cgst_amount,
         COALESCE(SUM(sgst_amount), 0) AS sgst_amount,
         COALESCE(SUM(igst_amount), 0) AS igst_amount,
         COALESCE(SUM(amount), 0) AS invoice_total
       FROM sales_invoices
       WHERE company_id=?
         AND status='POSTED'
         AND invoice_date BETWEEN ? AND ?`,
      [companyId, from, to]
    );

    const [[purchases]] = await pool.query(
      `SELECT
         COALESCE(SUM(taxable_amount), 0) AS taxable_amount,
         COALESCE(SUM(cgst_amount), 0) AS cgst_amount,
         COALESCE(SUM(sgst_amount), 0) AS sgst_amount,
         COALESCE(SUM(igst_amount), 0) AS igst_amount,
         COALESCE(SUM(amount), 0) AS invoice_total
       FROM purchase_invoices
       WHERE company_id=?
         AND status='POSTED'
         AND invoice_date BETWEEN ? AND ?`,
      [companyId, from, to]
    );

    const outputTax =
      Number(sales.cgst_amount || 0) +
      Number(sales.sgst_amount || 0) +
      Number(sales.igst_amount || 0);

    const inputTax =
      Number(purchases.cgst_amount || 0) +
      Number(purchases.sgst_amount || 0) +
      Number(purchases.igst_amount || 0);

    res.json({
      from,
      to,
      sales: {
        taxable_amount: Number(sales.taxable_amount || 0),
        cgst_amount: Number(sales.cgst_amount || 0),
        sgst_amount: Number(sales.sgst_amount || 0),
        igst_amount: Number(sales.igst_amount || 0),
        invoice_total: Number(sales.invoice_total || 0),
      },
      purchases: {
        taxable_amount: Number(purchases.taxable_amount || 0),
        cgst_amount: Number(purchases.cgst_amount || 0),
        sgst_amount: Number(purchases.sgst_amount || 0),
        igst_amount: Number(purchases.igst_amount || 0),
        invoice_total: Number(purchases.invoice_total || 0),
      },
      output_tax: Number(outputTax.toFixed(2)),
      input_tax: Number(inputTax.toFixed(2)),
      net_tax_payable: Number((outputTax - inputTax).toFixed(2)),
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load GST summary", error: error.message });
  }
});

app.get("/api/reports/gst-sales-register", auth, async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ message: "from and to are required" });

  try {
    const companyId = req.user.company_id;
    const [rows] = await pool.query(
      `SELECT
         si.id,
         si.invoice_no,
         si.invoice_date,
         si.taxable_amount,
         si.cgst_amount,
         si.sgst_amount,
         si.igst_amount,
         si.amount,
         p.party_code,
         p.party_name,
         p.gstin
       FROM sales_invoices si
       JOIN parties p ON p.id = si.party_id
       WHERE si.company_id=?
         AND si.status='POSTED'
         AND si.invoice_date BETWEEN ? AND ?
       ORDER BY si.invoice_date DESC, si.id DESC`,
      [companyId, from, to]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Failed to load GST sales register", error: error.message });
  }
});

app.get("/api/reports/gst-purchase-register", auth, async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ message: "from and to are required" });

  try {
    const companyId = req.user.company_id;
    const [rows] = await pool.query(
      `SELECT
         pi.id,
         pi.invoice_no,
         pi.invoice_date,
         pi.taxable_amount,
         pi.cgst_amount,
         pi.sgst_amount,
         pi.igst_amount,
         pi.amount,
         p.party_code,
         p.party_name,
         p.gstin
       FROM purchase_invoices pi
       JOIN parties p ON p.id = pi.party_id
       WHERE pi.company_id=?
         AND pi.status='POSTED'
         AND pi.invoice_date BETWEEN ? AND ?
       ORDER BY pi.invoice_date DESC, pi.id DESC`,
      [companyId, from, to]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Failed to load GST purchase register", error: error.message });
  }
});

/* ----------------------------- SETTLEMENTS ----------------------------- */

app.get("/api/sales-invoices/open", auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT si.*, p.party_name
       FROM sales_invoices si
       JOIN parties p ON p.id = si.party_id
       WHERE si.company_id=?
         AND si.status='POSTED'
         AND COALESCE(si.balance_amount, si.amount) > 0
       ORDER BY si.invoice_date ASC, si.id ASC`,
      [req.user.company_id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Failed to load open sales invoices", error: error.message });
  }
});

app.get("/api/purchase-invoices/open", auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT pi.*, p.party_name
       FROM purchase_invoices pi
       JOIN parties p ON p.id = pi.party_id
       WHERE pi.company_id=?
         AND pi.status='POSTED'
         AND COALESCE(pi.balance_amount, pi.amount) > 0
       ORDER BY pi.invoice_date ASC, pi.id ASC`,
      [req.user.company_id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Failed to load open purchase invoices", error: error.message });
  }
});

app.post("/api/sales-invoices/:id/receive", auth, requireRole("ADMIN", "PREPARER"), async (req, res) => {
  const missing = requireFields(req.body, ["receipt_date", "amount"]);
  if (missing) return res.status(400).json({ message: `${missing} is required` });

  const invoiceId = Number(req.params.id);
  const receiptAmount = Number(req.body.amount || 0);
  const receiptDate = req.body.receipt_date;

  if (!(receiptAmount > 0)) {
    return res.status(400).json({ message: "Receipt amount must be greater than zero" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await ensurePostingAllowed(conn, companyId, someDate, req.user.role);

    const [invRows] = await conn.query(
      `SELECT * FROM sales_invoices
       WHERE company_id=? AND id=?
       FOR UPDATE`,
      [req.user.company_id, invoiceId]
    );

    if (!invRows.length) throw new Error("Sales invoice not found");

    const invoice = invRows[0];
    const currentBalance = Number(invoice.balance_amount ?? invoice.amount);
    if (receiptAmount > currentBalance) {
      throw new Error("Receipt amount cannot exceed invoice balance");
    }

    const [settingsRows] = await conn.query(
      `SELECT * FROM company_account_settings WHERE company_id=? LIMIT 1`,
      [req.user.company_id]
    );

    if (!settingsRows.length) throw new Error("Account mapping settings not configured");
    const settings = settingsRows[0];

    const receiptAccountId = settings.bank_account_id || settings.cash_account_id;
    if (!receiptAccountId || !settings.receivable_account_id) {
      throw new Error("Cash/Bank and Receivable accounts must be configured in Settings");
    }

    const voucherNo = await getNextVoucherNo(conn, req.user.company_id, "RV");

    const [vh] = await conn.query(
      `INSERT INTO voucher_header
       (company_id, voucher_no, voucher_type, voucher_date, narration, status, created_by, approved_by)
       VALUES (?, ?, 'RV', ?, ?, 'APPROVED', ?, ?)`,
      [
        req.user.company_id,
        voucherNo,
        receiptDate,
        `Receipt against Sales Invoice ${invoice.invoice_no}`,
        req.user.id,
        req.user.id,
      ]
    );

    const voucherId = vh.insertId;

    await conn.query(
      `INSERT INTO voucher_line (header_id, line_no, account_id, dc, amount, line_narration)
       VALUES
       (?, 1, ?, 'D', ?, ?),
       (?, 2, ?, 'C', ?, ?)`,
      [
        voucherId,
        receiptAccountId,
        receiptAmount,
        "Cash/Bank received",
        voucherId,
        settings.receivable_account_id,
        receiptAmount,
        "Customer settlement",
      ]
    );

    const newReceived = Number(invoice.amount_received || 0) + receiptAmount;
    const newBalance = Number(invoice.amount || 0) - newReceived;

    await conn.query(
      `UPDATE sales_invoices
       SET amount_received=?,
           balance_amount=?
       WHERE id=? AND company_id=?`,
      [newReceived, newBalance, invoiceId, req.user.company_id]
    );

    await writeAuditLog(conn, {
      companyId: req.user.company_id,
      userId: req.user.id,
      action: "SALES_RECEIPT_POSTED",
      entityType: "sales_invoice",
      entityId: invoiceId,
      details: `Receipt of ${receiptAmount} against sales invoice ${invoice.invoice_no}`,
    });

    await conn.commit();

    res.json({
      message: "Receipt posted ✅",
      voucher_id: voucherId,
      voucher_no: voucherNo,
      amount_received: Number(newReceived.toFixed(2)),
      balance_amount: Number(newBalance.toFixed(2)),
    });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ message: "Failed to post receipt", error: error.message });
  } finally {
    conn.release();
  }
});

app.post("/api/purchase-invoices/:id/pay", auth, requireRole("ADMIN", "PREPARER"), async (req, res) => {
  const missing = requireFields(req.body, ["payment_date", "amount"]);
  if (missing) return res.status(400).json({ message: `${missing} is required` });

  const invoiceId = Number(req.params.id);
  const paymentAmount = Number(req.body.amount || 0);
  const paymentDate = req.body.payment_date;

  if (!(paymentAmount > 0)) {
    return res.status(400).json({ message: "Payment amount must be greater than zero" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await ensurePostingAllowed(conn, companyId, someDate, req.user.role);
    const [invRows] = await conn.query(
      `SELECT * FROM purchase_invoices
       WHERE company_id=? AND id=?
       FOR UPDATE`,
      [req.user.company_id, invoiceId]
    );

    if (!invRows.length) throw new Error("Purchase invoice not found");

    const invoice = invRows[0];
    const currentBalance = Number(invoice.balance_amount ?? invoice.amount);
    if (paymentAmount > currentBalance) {
      throw new Error("Payment amount cannot exceed invoice balance");
    }

    const [settingsRows] = await conn.query(
      `SELECT * FROM company_account_settings WHERE company_id=? LIMIT 1`,
      [req.user.company_id]
    );

    if (!settingsRows.length) throw new Error("Account mapping settings not configured");
    const settings = settingsRows[0];

    const paymentAccountId = settings.bank_account_id || settings.cash_account_id;
    if (!paymentAccountId || !settings.payable_account_id) {
      throw new Error("Cash/Bank and Payable accounts must be configured in Settings");
    }

    const voucherNo = await getNextVoucherNo(conn, req.user.company_id, "PV");

    const [vh] = await conn.query(
      `INSERT INTO voucher_header
       (company_id, voucher_no, voucher_type, voucher_date, narration, status, created_by, approved_by)
       VALUES (?, ?, 'PV', ?, ?, 'APPROVED', ?, ?)`,
      [
        req.user.company_id,
        voucherNo,
        paymentDate,
        `Payment against Purchase Invoice ${invoice.invoice_no}`,
        req.user.id,
        req.user.id,
      ]
    );

    const voucherId = vh.insertId;

    await conn.query(
      `INSERT INTO voucher_line (header_id, line_no, account_id, dc, amount, line_narration)
       VALUES
       (?, 1, ?, 'D', ?, ?),
       (?, 2, ?, 'C', ?, ?)`,
      [
        voucherId,
        settings.payable_account_id,
        paymentAmount,
        "Vendor settlement",
        voucherId,
        paymentAccountId,
        paymentAmount,
        "Cash/Bank paid",
      ]
    );

    const newPaid = Number(invoice.amount_paid || 0) + paymentAmount;
    const newBalance = Number(invoice.amount || 0) - newPaid;

    await conn.query(
      `UPDATE purchase_invoices
       SET amount_paid=?,
           balance_amount=?
       WHERE id=? AND company_id=?`,
      [newPaid, newBalance, invoiceId, req.user.company_id]
    );

    await writeAuditLog(conn, {
      companyId: req.user.company_id,
      userId: req.user.id,
      action: "PURCHASE_PAYMENT_POSTED",
      entityType: "purchase_invoice",
      entityId: invoiceId,
      details: `Payment of ${paymentAmount} against purchase invoice ${invoice.invoice_no}`,
    });

    await conn.commit();

    res.json({
      message: "Payment posted ✅",
      voucher_id: voucherId,
      voucher_no: voucherNo,
      amount_paid: Number(newPaid.toFixed(2)),
      balance_amount: Number(newBalance.toFixed(2)),
    });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ message: "Failed to post payment", error: error.message });
  } finally {
    conn.release();
  }
});

/* ----------------------------- INVOICE CANCELLATION ----------------------------- */

app.post("/api/sales-invoices/:id/cancel", auth, requireRole("ADMIN", "APPROVER"), async (req, res) => {
  const invoiceId = Number(req.params.id);
  const reversalDate = req.body?.reversal_date;

  if (!reversalDate) {
    return res.status(400).json({ message: "reversal_date is required" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await ensurePostingAllowed(conn, companyId, someDate, req.user.role);

    const [invRows] = await conn.query(
      `SELECT * FROM sales_invoices
       WHERE company_id=? AND id=?
       FOR UPDATE`,
      [req.user.company_id, invoiceId]
    );

    if (!invRows.length) throw new Error("Sales invoice not found");

    const invoice = invRows[0];

    if (invoice.status === "CANCELLED") throw new Error("Invoice already cancelled");
    if (Number(invoice.amount_received || 0) > 0) {
      throw new Error("Cannot cancel invoice with receipts already posted");
    }
    if (!invoice.voucher_id) throw new Error("Original voucher not found for this invoice");

    const [origLineRows] = await conn.query(
      `SELECT *
       FROM voucher_line
       WHERE header_id=?
       ORDER BY line_no ASC`,
      [invoice.voucher_id]
    );

    if (!origLineRows.length) throw new Error("Original voucher lines not found");

    const reversalVoucherNo = await getNextVoucherNo(conn, req.user.company_id, "JV");

    const [newHeader] = await conn.query(
      `INSERT INTO voucher_header
       (company_id, voucher_no, voucher_type, voucher_date, narration, status, created_by, approved_by)
       VALUES (?, ?, 'JV', ?, ?, 'APPROVED', ?, ?)`,
      [
        req.user.company_id,
        reversalVoucherNo,
        reversalDate,
        `Reversal of Sales Invoice ${invoice.invoice_no}`,
        req.user.id,
        req.user.id,
      ]
    );

    let lineNo = 1;
    for (const line of origLineRows) {
      const reverseDc = line.dc === "D" ? "C" : "D";
      await conn.query(
        `INSERT INTO voucher_line
         (header_id, line_no, account_id, dc, amount, line_narration)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          newHeader.insertId,
          lineNo++,
          line.account_id,
          reverseDc,
          line.amount,
          `Reversal: ${line.line_narration || "Sales invoice cancellation"}`,
        ]
      );
    }

    await conn.query(
      `UPDATE sales_invoices
       SET status='CANCELLED',
           balance_amount=0,
           reversal_voucher_id=?
       WHERE company_id=? AND id=?`,
      [newHeader.insertId, req.user.company_id, invoiceId]
    );

    await writeAuditLog(conn, {
      companyId: req.user.company_id,
      userId: req.user.id,
      action: "SALES_INVOICE_CANCELLED",
      entityType: "sales_invoice",
      entityId: invoiceId,
      details: `Cancelled sales invoice ${invoice.invoice_no} using reversal voucher ${reversalVoucherNo}`,
    });

    await conn.commit();

    res.json({
      message: "Sales invoice cancelled with reversal voucher ✅",
      reversal_voucher_id: newHeader.insertId,
      reversal_voucher_no: reversalVoucherNo,
    });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({
      message: "Failed to cancel sales invoice",
      error: error.message,
    });
  } finally {
    conn.release();
  }
});

app.post("/api/purchase-invoices/:id/cancel", auth, requireRole("ADMIN", "APPROVER"), async (req, res) => {
  const invoiceId = Number(req.params.id);
  const reversalDate = req.body?.reversal_date;

  if (!reversalDate) {
    return res.status(400).json({ message: "reversal_date is required" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await ensurePostingAllowed(conn, companyId, someDate, req.user.role);
    const [invRows] = await conn.query(
      `SELECT * FROM purchase_invoices
       WHERE company_id=? AND id=?
       FOR UPDATE`,
      [req.user.company_id, invoiceId]
    );

    if (!invRows.length) throw new Error("Purchase invoice not found");

    const invoice = invRows[0];

    if (invoice.status === "CANCELLED") throw new Error("Invoice already cancelled");
    if (Number(invoice.amount_paid || 0) > 0) {
      throw new Error("Cannot cancel invoice with payments already posted");
    }
    if (!invoice.voucher_id) throw new Error("Original voucher not found for this invoice");

    const [origLineRows] = await conn.query(
      `SELECT *
       FROM voucher_line
       WHERE header_id=?
       ORDER BY line_no ASC`,
      [invoice.voucher_id]
    );

    if (!origLineRows.length) throw new Error("Original voucher lines not found");

    const reversalVoucherNo = await getNextVoucherNo(conn, req.user.company_id, "JV");

    const [newHeader] = await conn.query(
      `INSERT INTO voucher_header
       (company_id, voucher_no, voucher_type, voucher_date, narration, status, created_by, approved_by)
       VALUES (?, ?, 'JV', ?, ?, 'APPROVED', ?, ?)`,
      [
        req.user.company_id,
        reversalVoucherNo,
        reversalDate,
        `Reversal of Purchase Invoice ${invoice.invoice_no}`,
        req.user.id,
        req.user.id,
      ]
    );

    let lineNo = 1;
    for (const line of origLineRows) {
      const reverseDc = line.dc === "D" ? "C" : "D";
      await conn.query(
        `INSERT INTO voucher_line
         (header_id, line_no, account_id, dc, amount, line_narration)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          newHeader.insertId,
          lineNo++,
          line.account_id,
          reverseDc,
          line.amount,
          `Reversal: ${line.line_narration || "Purchase invoice cancellation"}`,
        ]
      );
    }

    await conn.query(
      `UPDATE purchase_invoices
       SET status='CANCELLED',
           balance_amount=0,
           reversal_voucher_id=?
       WHERE company_id=? AND id=?`,
      [newHeader.insertId, req.user.company_id, invoiceId]
    );

    await writeAuditLog(conn, {
      companyId: req.user.company_id,
      userId: req.user.id,
      action: "PURCHASE_INVOICE_CANCELLED",
      entityType: "purchase_invoice",
      entityId: invoiceId,
      details: `Cancelled purchase invoice ${invoice.invoice_no} using reversal voucher ${reversalVoucherNo}`,
    });

    await conn.commit();

    res.json({
      message: "Purchase invoice cancelled with reversal voucher ✅",
      reversal_voucher_id: newHeader.insertId,
      reversal_voucher_no: reversalVoucherNo,
    });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({
      message: "Failed to cancel purchase invoice",
      error: error.message,
    });
  } finally {
    conn.release();
  }
});
app.get("/api/purchase-orders", auth, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT po.*, p.party_name
     FROM purchase_orders po
     JOIN parties p ON p.id = po.vendor_id
     WHERE po.company_id=?
     ORDER BY po.id DESC`,
    [req.user.company_id]
  );

  res.json(rows);
});
app.get("/api/purchase-orders/:id", auth, async (req, res) => {
  const id = req.params.id;

  const [[header]] = await pool.query(
    `SELECT po.*, p.party_name
     FROM purchase_orders po
     JOIN parties p ON p.id = po.vendor_id
     WHERE po.id=? AND po.company_id=?`,
    [id, req.user.company_id]
  );

  const [lines] = await pool.query(
    `SELECT pol.*, i.item_code, i.item_name
     FROM purchase_order_lines pol
     JOIN items i ON i.id = pol.item_id
     WHERE pol.purchase_order_id=?`,
    [id]
  );

  res.json({ header, lines });
});
app.get("/api/reports/reorder-suggestions", auth, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT
       i.id,
       i.item_code,
       i.item_name,
       i.reorder_level,
       COALESCE(SUM(sm.qty_in - sm.qty_out),0) AS balance_qty
     FROM items i
     LEFT JOIN stock_movements sm ON sm.item_id=i.id
     WHERE i.company_id=?
       AND i.track_inventory=1
     GROUP BY i.id
     HAVING balance_qty <= i.reorder_level`,
    [req.user.company_id]
  );

  const result = rows.map(r => ({
    ...r,
    suggested_qty: Math.max(Number(r.reorder_level) - Number(r.balance_qty), 0),
  }));

  res.json(result);
});

/* ----------------------------- BANK RECON ----------------------------- */

app.get("/api/bank-reconciliation", auth, async (req, res) => {
  const { bank_account_id } = req.query;
  if (!bank_account_id) return res.status(400).json({ message: "bank_account_id is required" });

  try {
    const companyId = req.user.company_id;

    const [statementLines] = await pool.query(
      `SELECT *
       FROM bank_statement_lines
       WHERE company_id=? AND bank_account_id=?
       ORDER BY txn_date DESC, id DESC`,
      [companyId, bank_account_id]
    );

    const [ledgerLines] = await pool.query(
      `SELECT
         vl.id AS voucher_line_id,
         vh.voucher_no,
         vh.voucher_date,
         vh.narration,
         vl.dc,
         vl.amount,
         vl.line_narration
       FROM voucher_line vl
       JOIN voucher_header vh ON vh.id = vl.header_id
       WHERE vh.company_id=?
         AND vh.status='APPROVED'
         AND vl.account_id=?
       ORDER BY vh.voucher_date DESC, vh.id DESC`,
      [companyId, bank_account_id]
    );

    res.json({
      statement_lines: statementLines,
      ledger_lines: ledgerLines,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load bank reconciliation", error: error.message });
  }
});

app.post("/api/bank-reconciliation/statement-line", auth, requireRole("ADMIN", "PREPARER"), async (req, res) => {
  const missing = requireFields(req.body, ["bank_account_id", "txn_date"]);
  if (missing) return res.status(400).json({ message: `${missing} is required` });

  try {
    const {
      bank_account_id,
      txn_date,
      description_text,
      reference_no,
      debit_amount,
      credit_amount,
    } = req.body;

    await ensurePostingAllowed(conn, companyId, someDate, req.user.role);
    const [r] = await pool.query(
      `INSERT INTO bank_statement_lines
       (company_id, bank_account_id, txn_date, description_text, reference_no, debit_amount, credit_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.company_id,
        bank_account_id,
        txn_date,
        description_text || null,
        reference_no || null,
        Number(debit_amount || 0),
        Number(credit_amount || 0),
      ]
    );

    res.json({ message: "Statement line added ✅", id: r.insertId });
  } catch (error) {
    res.status(500).json({ message: "Failed to add statement line", error: error.message });
  }
});

app.post("/api/bank-reconciliation/match", auth, requireRole("ADMIN", "APPROVER"), async (req, res) => {
  const missing = requireFields(req.body, ["statement_line_id", "voucher_line_id"]);
  if (missing) return res.status(400).json({ message: `${missing} is required` });

  try {
    const { statement_line_id, voucher_line_id } = req.body;

    const [r] = await pool.query(
      `UPDATE bank_statement_lines
       SET is_reconciled=1, reconciled_voucher_line_id=?
       WHERE company_id=? AND id=?`,
      [voucher_line_id, req.user.company_id, statement_line_id]
    );

    if (!r.affectedRows) return res.status(404).json({ message: "Statement line not found" });

    res.json({ message: "Matched successfully ✅" });
  } catch (error) {
    res.status(500).json({ message: "Failed to match statement line", error: error.message });
  }
});

/* ----------------------------- REPORTS ----------------------------- */

app.get("/api/reports/trial-balance", auth, async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ message: "from and to are required" });

  const companyId = req.user.company_id;

  const [rows] = await pool.query(
    `SELECT
       a.id,
       a.account_code,
       a.account_name,
       a.account_type,
       COALESCE(SUM(CASE WHEN vh.id IS NOT NULL AND vl.dc='D' THEN vl.amount ELSE 0 END), 0) AS debit,
       COALESCE(SUM(CASE WHEN vh.id IS NOT NULL AND vl.dc='C' THEN vl.amount ELSE 0 END), 0) AS credit
     FROM accounts a
     LEFT JOIN voucher_line vl ON vl.account_id = a.id
     LEFT JOIN voucher_header vh
       ON vh.id = vl.header_id
      AND vh.company_id = a.company_id
      AND vh.status='APPROVED'
      AND vh.voucher_date BETWEEN ? AND ?
     WHERE a.company_id = ?
     GROUP BY a.id, a.account_code, a.account_name, a.account_type
     ORDER BY a.account_code`,
    [from, to, companyId]
  );

  res.json(rows);
});

app.get("/api/reports/ledger/:accountId", auth, async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ message: "from and to are required" });

  const companyId = req.user.company_id;
  const accountId = Number(req.params.accountId);

  const [acc] = await pool.query(
    `SELECT * FROM accounts WHERE company_id=? AND id=?`,
    [companyId, accountId]
  );
  if (!acc.length) return res.status(404).json({ message: "Account not found" });

  const [open] = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN vl.dc='D' THEN vl.amount ELSE -vl.amount END),0) AS opening_balance
     FROM voucher_line vl
     JOIN voucher_header vh ON vh.id = vl.header_id
     WHERE vh.company_id=?
       AND vh.status='APPROVED'
       AND vl.account_id=?
       AND vh.voucher_date < ?`,
    [companyId, accountId, from]
  );

  const opening = Number(open[0].opening_balance || 0);

  const [tx] = await pool.query(
    `SELECT
       vh.voucher_date,
       vh.voucher_no,
       vh.voucher_type,
       vh.narration AS header_narration,
       vl.line_no,
       vl.dc,
       vl.amount,
       vl.line_narration
     FROM voucher_line vl
     JOIN voucher_header vh ON vh.id = vl.header_id
     WHERE vh.company_id=?
       AND vh.status='APPROVED'
       AND vl.account_id=?
       AND vh.voucher_date BETWEEN ? AND ?
     ORDER BY vh.voucher_date ASC, vh.id ASC, vl.line_no ASC`,
    [companyId, accountId, from, to]
  );

  let running = opening;
  const rows = tx.map((r) => {
    const amt = Number(r.amount);
    running += r.dc === "D" ? amt : -amt;
    return { ...r, running_balance: Number(running.toFixed(2)) };
  });

  res.json({
    account: {
      id: acc[0].id,
      account_code: acc[0].account_code,
      account_name: acc[0].account_name,
      account_type: acc[0].account_type,
    },
    opening_balance: Number(opening.toFixed(2)),
    transactions: rows,
    closing_balance: Number(running.toFixed(2)),
  });
});

app.get("/api/reports/pnl", auth, async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ message: "from and to are required" });

  try {
    const companyId = req.user.company_id;

    const [rows] = await pool.query(
      `SELECT
         a.account_code,
         a.account_name,
         a.account_type,
         COALESCE(SUM(
           CASE
             WHEN a.account_type='INCOME' AND vl.dc='C' THEN vl.amount
             WHEN a.account_type='INCOME' AND vl.dc='D' THEN -vl.amount
             WHEN a.account_type='EXPENSE' AND vl.dc='D' THEN vl.amount
             WHEN a.account_type='EXPENSE' AND vl.dc='C' THEN -vl.amount
             ELSE 0
           END
         ),0) AS amount
       FROM accounts a
       LEFT JOIN voucher_line vl ON vl.account_id = a.id
       LEFT JOIN voucher_header vh
         ON vh.id = vl.header_id
        AND vh.company_id = a.company_id
        AND vh.status='APPROVED'
        AND vh.voucher_date BETWEEN ? AND ?
       WHERE a.company_id = ?
         AND a.account_type IN ('INCOME','EXPENSE')
       GROUP BY a.id, a.account_code, a.account_name, a.account_type
       ORDER BY a.account_type, a.account_code`,
      [from, to, req.user.company_id]
    );

    const income = rows.filter((r) => r.account_type === "INCOME");
    const expenses = rows.filter((r) => r.account_type === "EXPENSE");

    const totalIncome = income.reduce((s, r) => s + Number(r.amount || 0), 0);
    const totalExpense = expenses.reduce((s, r) => s + Number(r.amount || 0), 0);

    res.json({
      from,
      to,
      income,
      expenses,
      total_income: Number(totalIncome.toFixed(2)),
      total_expense: Number(totalExpense.toFixed(2)),
      net_profit: Number((totalIncome - totalExpense).toFixed(2)),
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load P&L", error: error.message });
  }
});

app.get("/api/reports/balance-sheet", auth, async (req, res) => {
  const { as_of } = req.query;
  if (!as_of) return res.status(400).json({ message: "as_of is required" });

  try {
    const companyId = req.user.company_id;

    const [rows] = await pool.query(
      `SELECT
         a.account_code,
         a.account_name,
         a.account_type,
         COALESCE(SUM(
           CASE
             WHEN a.account_type='ASSET' AND vl.dc='D' THEN vl.amount
             WHEN a.account_type='ASSET' AND vl.dc='C' THEN -vl.amount
             WHEN a.account_type='LIABILITY' AND vl.dc='C' THEN vl.amount
             WHEN a.account_type='LIABILITY' AND vl.dc='D' THEN -vl.amount
             WHEN a.account_type='EQUITY' AND vl.dc='C' THEN vl.amount
             WHEN a.account_type='EQUITY' AND vl.dc='D' THEN -vl.amount
             ELSE 0
           END
         ),0) AS amount
       FROM accounts a
       LEFT JOIN voucher_line vl ON vl.account_id = a.id
       LEFT JOIN voucher_header vh
         ON vh.id = vl.header_id
        AND vh.company_id = a.company_id
        AND vh.status='APPROVED'
        AND vh.voucher_date <= ?
       WHERE a.company_id = ?
         AND a.account_type IN ('ASSET','LIABILITY','EQUITY')
       GROUP BY a.id, a.account_code, a.account_name, a.account_type
       ORDER BY a.account_type, a.account_code`,
      [as_of, companyId]
    );

    const assets = rows.filter((r) => r.account_type === "ASSET");
    const liabilities = rows.filter((r) => r.account_type === "LIABILITY");
    const equity = rows.filter((r) => r.account_type === "EQUITY");

    const totalAssets = assets.reduce((s, r) => s + Number(r.amount || 0), 0);
    const totalLiabilities = liabilities.reduce((s, r) => s + Number(r.amount || 0), 0);
    const totalEquity = equity.reduce((s, r) => s + Number(r.amount || 0), 0);

    res.json({
      as_of,
      assets,
      liabilities,
      equity,
      total_assets: Number(totalAssets.toFixed(2)),
      total_liabilities: Number(totalLiabilities.toFixed(2)),
      total_equity: Number(totalEquity.toFixed(2)),
      liabilities_plus_equity: Number((totalLiabilities + totalEquity).toFixed(2)),
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load Balance Sheet", error: error.message });
  }
});

app.get("/api/reports/ar-aging", auth, async (req, res) => {
  const { as_of } = req.query;
  if (!as_of) return res.status(400).json({ message: "as_of is required" });

  try {
    const companyId = req.user.company_id;

    const [rows] = await pool.query(
      `
      SELECT
        p.id AS party_id,
        p.party_code,
        p.party_name,
        COALESCE(SUM(CASE WHEN DATEDIFF(?, si.invoice_date) BETWEEN 0 AND 30 THEN COALESCE(si.balance_amount, si.amount) ELSE 0 END), 0) AS bucket_0_30,
        COALESCE(SUM(CASE WHEN DATEDIFF(?, si.invoice_date) BETWEEN 31 AND 60 THEN COALESCE(si.balance_amount, si.amount) ELSE 0 END), 0) AS bucket_31_60,
        COALESCE(SUM(CASE WHEN DATEDIFF(?, si.invoice_date) BETWEEN 61 AND 90 THEN COALESCE(si.balance_amount, si.amount) ELSE 0 END), 0) AS bucket_61_90,
        COALESCE(SUM(CASE WHEN DATEDIFF(?, si.invoice_date) > 90 THEN COALESCE(si.balance_amount, si.amount) ELSE 0 END), 0) AS bucket_90_plus,
        COALESCE(SUM(COALESCE(si.balance_amount, si.amount)), 0) AS total_outstanding
      FROM parties p
      LEFT JOIN sales_invoices si
        ON si.party_id = p.id
       AND si.company_id = p.company_id
       AND si.status = 'POSTED'
       AND si.invoice_date <= ?
       AND COALESCE(si.balance_amount, si.amount) > 0
      WHERE p.company_id = ?
        AND p.party_type IN ('CUSTOMER', 'BOTH')
      GROUP BY p.id, p.party_code, p.party_name
      HAVING total_outstanding > 0
      ORDER BY p.party_name ASC
      `,
      [as_of, as_of, as_of, as_of, as_of, companyId]
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Failed to load A/R aging", error: error.message });
  }
});

app.get("/api/reports/ap-aging", auth, async (req, res) => {
  const { as_of } = req.query;
  if (!as_of) return res.status(400).json({ message: "as_of is required" });

  try {
    const companyId = req.user.company_id;

    const [rows] = await pool.query(
      `
      SELECT
        p.id AS party_id,
        p.party_code,
        p.party_name,
        COALESCE(SUM(CASE WHEN DATEDIFF(?, pi.invoice_date) BETWEEN 0 AND 30 THEN COALESCE(pi.balance_amount, pi.amount) ELSE 0 END), 0) AS bucket_0_30,
        COALESCE(SUM(CASE WHEN DATEDIFF(?, pi.invoice_date) BETWEEN 31 AND 60 THEN COALESCE(pi.balance_amount, pi.amount) ELSE 0 END), 0) AS bucket_31_60,
        COALESCE(SUM(CASE WHEN DATEDIFF(?, pi.invoice_date) BETWEEN 61 AND 90 THEN COALESCE(pi.balance_amount, pi.amount) ELSE 0 END), 0) AS bucket_61_90,
        COALESCE(SUM(CASE WHEN DATEDIFF(?, pi.invoice_date) > 90 THEN COALESCE(pi.balance_amount, pi.amount) ELSE 0 END), 0) AS bucket_90_plus,
        COALESCE(SUM(COALESCE(pi.balance_amount, pi.amount)), 0) AS total_outstanding
      FROM parties p
      LEFT JOIN purchase_invoices pi
        ON pi.party_id = p.id
       AND pi.company_id = p.company_id
       AND pi.status = 'POSTED'
       AND pi.invoice_date <= ?
       AND COALESCE(pi.balance_amount, pi.amount) > 0
      WHERE p.company_id = ?
        AND p.party_type IN ('VENDOR', 'BOTH')
      GROUP BY p.id, p.party_code, p.party_name
      HAVING total_outstanding > 0
      ORDER BY p.party_name ASC
      `,
      [as_of, as_of, as_of, as_of, as_of, companyId]
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Failed to load A/P aging", error: error.message });
  }
});

/* ----------------------------- DASHBOARD ----------------------------- */

app.get("/api/dashboard/summary", auth, async (req, res) => {
  try {
    const companyId = req.user.company_id;

    const [[revenue]] = await pool.query(
      `SELECT COALESCE(SUM(vl.amount),0) total
       FROM voucher_line vl
       JOIN accounts a ON a.id = vl.account_id
       JOIN voucher_header vh ON vh.id = vl.header_id
       WHERE vh.company_id=?
         AND vh.status='APPROVED'
         AND a.account_type='INCOME'
         AND vl.dc='C'`,
      [companyId]
    );

    const [[expense]] = await pool.query(
      `SELECT COALESCE(SUM(vl.amount),0) total
       FROM voucher_line vl
       JOIN accounts a ON a.id = vl.account_id
       JOIN voucher_header vh ON vh.id = vl.header_id
       WHERE vh.company_id=?
         AND vh.status='APPROVED'
         AND a.account_type='EXPENSE'
         AND vl.dc='D'`,
      [companyId]
    );

    const [[receivables]] = await pool.query(
      `SELECT COALESCE(SUM(balance_amount),0) total
       FROM sales_invoices
       WHERE company_id=?
         AND status='POSTED'
         AND COALESCE(balance_amount,0) > 0`,
      [companyId]
    );

    const [[payables]] = await pool.query(
      `SELECT COALESCE(SUM(balance_amount),0) total
       FROM purchase_invoices
       WHERE company_id=?
         AND status='POSTED'
         AND COALESCE(balance_amount,0) > 0`,
      [companyId]
    );

    const [[inventoryStats]] = await pool.query(
      `SELECT
         COUNT(*) AS total_stock_items,
         COALESCE(SUM(CASE WHEN stock_data.balance_qty <= i.reorder_level THEN 1 ELSE 0 END), 0) AS low_stock_items,
         COALESCE(SUM(CASE WHEN stock_data.balance_qty <= 0 THEN 1 ELSE 0 END), 0) AS out_of_stock_items
       FROM items i
       LEFT JOIN (
         SELECT
           item_id,
           company_id,
           COALESCE(SUM(qty_in - qty_out), 0) AS balance_qty
         FROM stock_movements
         WHERE company_id=?
         GROUP BY item_id, company_id
       ) stock_data
         ON stock_data.item_id = i.id
        AND stock_data.company_id = i.company_id
       WHERE i.company_id=?
         AND i.is_active=1
         AND i.track_inventory=1`,
      [companyId, companyId]
    );

    const [recentVouchers] = await pool.query(
      `SELECT id, voucher_no, voucher_type, voucher_date, narration, status
       FROM voucher_header
       WHERE company_id=?
       ORDER BY voucher_date DESC, id DESC
       LIMIT 5`,
      [companyId]
    );

    res.json({
      revenue: Number(revenue.total || 0),
      expense: Number(expense.total || 0),
      profit: Number((Number(revenue.total || 0) - Number(expense.total || 0)).toFixed(2)),
      receivables: Number(receivables.total || 0),
      payables: Number(payables.total || 0),
      total_stock_items: Number(inventoryStats.total_stock_items || 0),
      low_stock_items: Number(inventoryStats.low_stock_items || 0),
      out_of_stock_items: Number(inventoryStats.out_of_stock_items || 0),
      recent_vouchers: recentVouchers,
    });
  } catch (error) {
    res.status(500).json({
      message: "Dashboard load failed",
      error: error.message,
    });
  }
});

app.get("/api/dashboard/monthly-trend", auth, async (req, res) => {
  try {
    const companyId = req.user.company_id;

    const [rows] = await pool.query(
      `
      SELECT
        DATE_FORMAT(vh.voucher_date, '%b') AS month_name,
        DATE_FORMAT(vh.voucher_date, '%Y-%m') AS month_key,
        COALESCE(SUM(CASE WHEN a.account_type='INCOME' AND vl.dc='C' THEN vl.amount ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN a.account_type='EXPENSE' AND vl.dc='D' THEN vl.amount ELSE 0 END), 0) AS expense
      FROM voucher_header vh
      JOIN voucher_line vl ON vl.header_id = vh.id
      JOIN accounts a ON a.id = vl.account_id
      WHERE vh.company_id = ?
        AND vh.status = 'APPROVED'
      GROUP BY DATE_FORMAT(vh.voucher_date, '%Y-%m'), DATE_FORMAT(vh.voucher_date, '%b')
      ORDER BY month_key ASC
      LIMIT 12
      `,
      [companyId]
    );

    res.json(
      rows.map((r) => ({
        month: r.month_name,
        income: Number(r.income || 0),
        expense: Number(r.expense || 0),
      }))
    );
  } catch (error) {
    res.status(500).json({
      message: "Failed to load monthly trend",
      error: error.message,
    });
  }
});

/* ----------------------------- PERIOD CLOSE / AUDIT ----------------------------- */

app.get("/api/period-closures", auth, requireRole("ADMIN", "APPROVER"), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT *
       FROM accounting_period_closures
       WHERE company_id=?
       ORDER BY period_from DESC, id DESC`,
      [req.user.company_id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({
      message: "Failed to load period closures",
      error: error.message,
    });
  }
});

app.post("/api/period-closures/close", auth, requireRole("ADMIN"), async (req, res) => {
  const missing = requireFields(req.body, ["period_from", "period_to"]);
  if (missing) return res.status(400).json({ message: `${missing} is required` });

  const { period_from, period_to, remarks } = req.body;

  if (period_from > period_to) {
    return res.status(400).json({ message: "period_from cannot be after period_to" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `INSERT INTO accounting_period_closures
       (company_id, period_from, period_to, is_closed, remarks, created_by)
       VALUES (?, ?, ?, 1, ?, ?)`,
      [req.user.company_id, period_from, period_to, remarks || null, req.user.id]
    );

    await writeAuditLog(conn, {
      companyId: req.user.company_id,
      userId: req.user.id,
      action: "PERIOD_CLOSED",
      entityType: "period_closure",
      details: `Closed period from ${period_from} to ${period_to}${remarks ? ` | ${remarks}` : ""}`,
    });

    await conn.commit();
    res.json({ message: "Accounting period closed ✅" });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({
      message: "Failed to close period",
      error: error.message,
    });
  } finally {
    conn.release();
  }
});

app.post("/api/period-closures/:id/reopen", auth, requireRole("ADMIN"), async (req, res) => {
  const id = Number(req.params.id);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT *
       FROM accounting_period_closures
       WHERE company_id=? AND id=?
       FOR UPDATE`,
      [req.user.company_id, id]
    );

    if (!rows.length) throw new Error("Closed period record not found");

    await conn.query(
      `UPDATE accounting_period_closures
       SET is_closed=0, reopened_by=?
       WHERE company_id=? AND id=?`,
      [req.user.id, req.user.company_id, id]
    );

    await writeAuditLog(conn, {
      companyId: req.user.company_id,
      userId: req.user.id,
      action: "PERIOD_REOPENED",
      entityType: "period_closure",
      entityId: id,
      details: `Reopened period from ${rows[0].period_from} to ${rows[0].period_to}`,
    });

    await conn.commit();
    res.json({ message: "Accounting period reopened ✅" });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({
      message: "Failed to reopen period",
      error: error.message,
    });
  } finally {
    conn.release();
  }
});

app.get("/api/audit-logs", auth, requireRole("ADMIN", "APPROVER"), async (req, res) => {
  try {
    const { action, entity_type } = req.query;
    const params = [req.user.company_id];
    let sql = `
      SELECT
        al.*,
        u.full_name AS user_name
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE al.company_id=?
    `;

    if (action) {
      sql += ` AND al.action=?`;
      params.push(action);
    }

    if (entity_type) {
      sql += ` AND al.entity_type=?`;
      params.push(entity_type);
    }

    sql += ` ORDER BY al.id DESC LIMIT 300`;

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({
      message: "Failed to load audit logs",
      error: error.message,
    });
  }
});
app.get("/api/items", auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT *
       FROM items
       WHERE company_id=?
       ORDER BY item_code ASC`,
      [req.user.company_id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Failed to load items", error: error.message });
  }
});

app.post("/api/items", auth, requireRole("ADMIN", "PREPARER"), async (req, res) => {
  const missing = requireFields(req.body, ["item_code", "item_name"]);
  if (missing) return res.status(400).json({ message: `${missing} is required` });

  try {
    const {
      item_code,
      item_name,
      item_type = "GOODS",
      unit = "NOS",
      sales_rate = 0,
      purchase_rate = 0,
      tax_percent = 0,
      hsn_sac,
      track_inventory = true,
      reorder_level = 0,
      minimum_level = 0,
      maximum_level = 0,
    } = req.body;

    const [r] = await pool.query(
      `INSERT INTO items
       (company_id, item_code, item_name, item_type, unit, sales_rate, purchase_rate, tax_percent, hsn_sac, track_inventory, reorder_level, minimum_level, maximum_level, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        req.user.company_id,
        item_code,
        item_name,
        String(item_type).toUpperCase(),
        unit,
        Number(sales_rate || 0),
        Number(purchase_rate || 0),
        Number(tax_percent || 0),
        hsn_sac || null,
        track_inventory ? 1 : 0,
        Number(reorder_level || 0),
        Number(minimum_level || 0),
        Number(maximum_level || 0),
      ]
    );

    await writeAuditLog(pool, {
      companyId: req.user.company_id,
      userId: req.user.id,
      action: "ITEM_CREATED",
      entityType: "item",
      entityId: r.insertId,
      details: `Created item ${item_code} - ${item_name}`,
    });

    res.json({ message: "Item created ✅", item_id: r.insertId });
  } catch (error) {
    res.status(500).json({ message: "Failed to create item", error: error.message });
  }
});

app.put("/api/items/:id", auth, requireRole("ADMIN", "PREPARER"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      item_name,
      item_type,
      unit,
      sales_rate,
      purchase_rate,
      tax_percent,
      hsn_sac,
      track_inventory,
      reorder_level,
      minimum_level,
      maximum_level,
      is_active,
    } = req.body;

    const fields = [];
    const vals = [];

    if (item_name !== undefined) {
      fields.push("item_name=?");
      vals.push(item_name);
    }
    if (item_type !== undefined) {
      fields.push("item_type=?");
      vals.push(String(item_type).toUpperCase());
    }
    if (unit !== undefined) {
      fields.push("unit=?");
      vals.push(unit);
    }
    if (sales_rate !== undefined) {
      fields.push("sales_rate=?");
      vals.push(Number(sales_rate || 0));
    }
    if (purchase_rate !== undefined) {
      fields.push("purchase_rate=?");
      vals.push(Number(purchase_rate || 0));
    }
    if (tax_percent !== undefined) {
      fields.push("tax_percent=?");
      vals.push(Number(tax_percent || 0));
    }
    if (hsn_sac !== undefined) {
      fields.push("hsn_sac=?");
      vals.push(hsn_sac || null);
    }
    if (track_inventory !== undefined) {
      fields.push("track_inventory=?");
      vals.push(track_inventory ? 1 : 0);
    }
    if (reorder_level !== undefined) {
      fields.push("reorder_level=?");
      vals.push(Number(reorder_level || 0));
    }
    if (minimum_level !== undefined) {
      fields.push("minimum_level=?");
      vals.push(Number(minimum_level || 0));
    }
    if (maximum_level !== undefined) {
      fields.push("maximum_level=?");
      vals.push(Number(maximum_level || 0));
    }
    if (is_active !== undefined) {
      fields.push("is_active=?");
      vals.push(is_active ? 1 : 0);
    }

    if (!fields.length) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    vals.push(req.user.company_id, id);

    const [r] = await pool.query(
      `UPDATE items
       SET ${fields.join(", ")}
       WHERE company_id=? AND id=?`,
      vals
    );

    if (!r.affectedRows) {
      return res.status(404).json({ message: "Item not found" });
    }

    await writeAuditLog(pool, {
      companyId: req.user.company_id,
      userId: req.user.id,
      action: "ITEM_UPDATED",
      entityType: "item",
      entityId: id,
      details: `Updated item ${id}`,
    });

    res.json({ message: "Item updated ✅" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update item", error: error.message });
  }
});

app.get("/api/reports/stock-summary", auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         i.id,
         i.item_code,
         i.item_name,
         i.unit,
         i.item_type,
         i.track_inventory,
         COALESCE(SUM(sm.qty_in), 0) AS total_in,
         COALESCE(SUM(sm.qty_out), 0) AS total_out,
         COALESCE(SUM(sm.qty_in - sm.qty_out), 0) AS balance_qty
       FROM items i
       LEFT JOIN stock_movements sm
         ON sm.item_id = i.id
        AND sm.company_id = i.company_id
       WHERE i.company_id=?
       GROUP BY i.id, i.item_code, i.item_name, i.unit, i.item_type, i.track_inventory
       ORDER BY i.item_code ASC`,
      [req.user.company_id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Failed to load stock summary", error: error.message });
  }
});
app.get("/api/sales-invoices/:id", auth, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const [headerRows] = await pool.query(
      `SELECT
         si.*,
         p.party_code,
         p.party_name,
         p.gstin,
         p.email,
         p.phone
       FROM sales_invoices si
       JOIN parties p ON p.id = si.party_id
       WHERE si.company_id=? AND si.id=?`,
      [req.user.company_id, id]
    );

    if (!headerRows.length) {
      return res.status(404).json({ message: "Sales invoice not found" });
    }

    const [lineRows] = await pool.query(
      `SELECT
         sil.*,
         i.item_code,
         i.item_name,
         i.unit,
         i.hsn_sac
       FROM sales_invoice_lines sil
       JOIN items i ON i.id = sil.item_id
       WHERE sil.sales_invoice_id=?
       ORDER BY sil.id ASC`,
      [id]
    );

    res.json({
      header: headerRows[0],
      lines: lineRows,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to load sales invoice details",
      error: error.message,
    });
  }
});

app.get("/api/purchase-invoices/:id", auth, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const [headerRows] = await pool.query(
      `SELECT
         pi.*,
         p.party_code,
         p.party_name,
         p.gstin,
         p.email,
         p.phone
       FROM purchase_invoices pi
       JOIN parties p ON p.id = pi.party_id
       WHERE pi.company_id=? AND pi.id=?`,
      [req.user.company_id, id]
    );

    if (!headerRows.length) {
      return res.status(404).json({ message: "Purchase invoice not found" });
    }

    const [lineRows] = await pool.query(
      `SELECT
         pil.*,
         i.item_code,
         i.item_name,
         i.unit,
         i.hsn_sac
       FROM purchase_invoice_lines pil
       JOIN items i ON i.id = pil.item_id
       WHERE pil.purchase_invoice_id=?
       ORDER BY pil.id ASC`,
      [id]
    );

    res.json({
      header: headerRows[0],
      lines: lineRows,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to load purchase invoice details",
      error: error.message,
    });
  }
});
app.get("/api/reports/stock-ledger/:itemId", auth, async (req, res) => {
  try {
    const itemId = Number(req.params.itemId);
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ message: "from and to are required" });
    }

    const [itemRows] = await pool.query(
      `SELECT *
       FROM items
       WHERE company_id=? AND id=?`,
      [req.user.company_id, itemId]
    );

    if (!itemRows.length) {
      return res.status(404).json({ message: "Item not found" });
    }

    const [openingRows] = await pool.query(
      `SELECT
         COALESCE(SUM(qty_in), 0) AS total_in,
         COALESCE(SUM(qty_out), 0) AS total_out
       FROM stock_movements
       WHERE company_id=?
         AND item_id=?
         AND txn_date < ?`,
      [req.user.company_id, itemId, from]
    );

    const openingQty =
      Number(openingRows[0].total_in || 0) - Number(openingRows[0].total_out || 0);

    const [rows] = await pool.query(
      `SELECT
         id,
         txn_date,
         movement_type,
         qty_in,
         qty_out,
         reference_type,
         reference_id,
         remarks,
         created_at
       FROM stock_movements
       WHERE company_id=?
         AND item_id=?
         AND txn_date BETWEEN ? AND ?
       ORDER BY txn_date ASC, id ASC`,
      [req.user.company_id, itemId, from, to]
    );

    let runningQty = openingQty;
    const ledger = rows.map((row) => {
      runningQty += Number(row.qty_in || 0) - Number(row.qty_out || 0);
      return {
        ...row,
        running_qty: Number(runningQty.toFixed(3)),
      };
    });

    res.json({
      item: itemRows[0],
      from,
      to,
      opening_qty: Number(openingQty.toFixed(3)),
      closing_qty: Number(runningQty.toFixed(3)),
      rows: ledger,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to load stock ledger",
      error: error.message,
    });
  }
});

app.get("/api/reports/item-sales-register", auth, async (req, res) => {
  try {
    const { from, to, item_id } = req.query;

    if (!from || !to) {
      return res.status(400).json({ message: "from and to are required" });
    }

    const params = [req.user.company_id, from, to];
    let sql = `
      SELECT
        si.id AS sales_invoice_id,
        si.invoice_no,
        si.invoice_date,
        p.party_code,
        p.party_name,
        i.id AS item_id,
        i.item_code,
        i.item_name,
        i.unit,
        sil.qty,
        sil.rate,
        sil.taxable_amount,
        sil.cgst_amount,
        sil.sgst_amount,
        sil.igst_amount,
        sil.line_total
      FROM sales_invoice_lines sil
      JOIN sales_invoices si ON si.id = sil.sales_invoice_id
      JOIN items i ON i.id = sil.item_id
      JOIN parties p ON p.id = si.party_id
      WHERE si.company_id=?
        AND si.invoice_date BETWEEN ? AND ?
        AND si.status='POSTED'
    `;

    if (item_id) {
      sql += ` AND i.id=?`;
      params.push(Number(item_id));
    }

    sql += ` ORDER BY si.invoice_date DESC, si.id DESC, sil.id ASC`;

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({
      message: "Failed to load item sales register",
      error: error.message,
    });
  }
});

app.get("/api/reports/item-purchase-register", auth, async (req, res) => {
  try {
    const { from, to, item_id } = req.query;

    if (!from || !to) {
      return res.status(400).json({ message: "from and to are required" });
    }

    const params = [req.user.company_id, from, to];
    let sql = `
      SELECT
        pi.id AS purchase_invoice_id,
        pi.invoice_no,
        pi.invoice_date,
        p.party_code,
        p.party_name,
        i.id AS item_id,
        i.item_code,
        i.item_name,
        i.unit,
        pil.qty,
        pil.rate,
        pil.taxable_amount,
        pil.cgst_amount,
        pil.sgst_amount,
        pil.igst_amount,
        pil.line_total
      FROM purchase_invoice_lines pil
      JOIN purchase_invoices pi ON pi.id = pil.purchase_invoice_id
      JOIN items i ON i.id = pil.item_id
      JOIN parties p ON p.id = pi.party_id
      WHERE pi.company_id=?
        AND pi.invoice_date BETWEEN ? AND ?
        AND pi.status='POSTED'
    `;

    if (item_id) {
      sql += ` AND i.id=?`;
      params.push(Number(item_id));
    }

    sql += ` ORDER BY pi.invoice_date DESC, pi.id DESC, pil.id ASC`;

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({
      message: "Failed to load item purchase register",
      error: error.message,
    });
  }
});
app.get("/api/reports/low-stock", auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         i.id,
         i.item_code,
         i.item_name,
         i.unit,
         i.item_type,
         i.track_inventory,
         i.reorder_level,
         i.minimum_level,
         i.maximum_level,
         COALESCE(SUM(sm.qty_in), 0) AS total_in,
         COALESCE(SUM(sm.qty_out), 0) AS total_out,
         COALESCE(SUM(sm.qty_in - sm.qty_out), 0) AS balance_qty
       FROM items i
       LEFT JOIN stock_movements sm
         ON sm.item_id = i.id
        AND sm.company_id = i.company_id
       WHERE i.company_id=?
         AND i.is_active=1
         AND i.track_inventory=1
       GROUP BY
         i.id, i.item_code, i.item_name, i.unit, i.item_type,
         i.track_inventory, i.reorder_level, i.minimum_level, i.maximum_level
       HAVING balance_qty <= reorder_level
       ORDER BY balance_qty ASC, i.item_code ASC`,
      [req.user.company_id]
    );

    const result = rows.map((row) => {
      const balance = Number(row.balance_qty || 0);
      const reorder = Number(row.reorder_level || 0);
      return {
        ...row,
        shortage_qty: Number(Math.max(reorder - balance, 0).toFixed(3)),
        status:
          balance <= 0 ? "OUT_OF_STOCK" :
          balance <= Number(row.minimum_level || 0) ? "CRITICAL" :
          "LOW_STOCK",
      };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      message: "Failed to load low stock report",
      error: error.message,
    });
  }
});
app.post("/api/purchase-orders/:id/convert-to-invoice", auth, requireRole("ADMIN", "PREPARER"), async (req, res) => {
  const poId = Number(req.params.id);
  const { invoice_no, invoice_date } = req.body;

  if (!invoice_no || !invoice_date) {
    return res.status(400).json({ message: "invoice_no and invoice_date are required" });
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await ensurePostingAllowed(conn, companyId, someDate, req.user.role);

    const [poRows] = await conn.query(
      `SELECT *
       FROM purchase_orders
       WHERE company_id=? AND id=?
       FOR UPDATE`,
      [req.user.company_id, poId]
    );

    if (!poRows.length) {
      throw new Error("Purchase order not found");
    }

    const po = poRows[0];

    if (["CLOSED", "CANCELLED"].includes(String(po.status || "").toUpperCase())) {
      throw new Error("This purchase order cannot be converted");
    }

    const [existingInvoiceRows] = await conn.query(
      `SELECT id, invoice_no
       FROM purchase_invoices
       WHERE company_id=? AND source_po_id=?`,
      [req.user.company_id, poId]
    );

    if (existingInvoiceRows.length) {
      throw new Error(`This PO is already converted to invoice ${existingInvoiceRows[0].invoice_no}`);
    }

    const [lineRows] = await conn.query(
      `SELECT
         pol.*,
         i.item_type,
         i.track_inventory
       FROM purchase_order_lines pol
       JOIN items i ON i.id = pol.item_id
       WHERE pol.purchase_order_id=?
       ORDER BY pol.id ASC`,
      [poId]
    );

    if (!lineRows.length) {
      throw new Error("Purchase order has no lines");
    }

    const [settingsRows] = await conn.query(
      `SELECT * FROM company_account_settings WHERE company_id=? LIMIT 1`,
      [req.user.company_id]
    );

    if (!settingsRows.length) {
      throw new Error("Account mapping settings not configured");
    }

    const settings = settingsRows[0];

    if (!settings.purchase_account_id || !settings.payable_account_id) {
      throw new Error("Purchase and payable accounts must be configured in Settings");
    }

    let taxable = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    const preparedLines = lineRows.map((ln) => {
      const qty = Number(ln.qty || 0);
      const rate = Number(ln.rate || 0);
      const taxPercent = Number(ln.tax_percent || 0);
      const taxableAmount = Number((qty * rate).toFixed(2));
      const totalTax = Number(((taxableAmount * taxPercent) / 100).toFixed(2));

      const lineCgst = Number((totalTax / 2).toFixed(2));
      const lineSgst = Number((totalTax / 2).toFixed(2));
      const lineIgst = 0;
      const lineTotal = Number((taxableAmount + lineCgst + lineSgst + lineIgst).toFixed(2));

      taxable += taxableAmount;
      cgst += lineCgst;
      sgst += lineSgst;
      igst += lineIgst;

      return {
        ...ln,
        taxable_amount: taxableAmount,
        cgst_amount: lineCgst,
        sgst_amount: lineSgst,
        igst_amount: lineIgst,
        line_total: lineTotal,
      };
    });

    const totalAmount = Number((taxable + cgst + sgst + igst).toFixed(2));
    const voucherNo = await getNextVoucherNo(conn, req.user.company_id, "PV");

    const [vh] = await conn.query(
      `INSERT INTO voucher_header
       (company_id, voucher_no, voucher_type, voucher_date, narration, status, created_by, approved_by)
       VALUES (?, ?, 'PV', ?, ?, 'APPROVED', ?, ?)`,
      [
        req.user.company_id,
        voucherNo,
        invoice_date,
        `Purchase Invoice ${invoice_no} from PO ${po.po_no}`,
        req.user.id,
        req.user.id,
      ]
    );

    const voucherId = vh.insertId;
    let voucherLineNo = 1;

    await conn.query(
      `INSERT INTO voucher_line (header_id, line_no, account_id, dc, amount, line_narration)
       VALUES (?, ?, ?, 'D', ?, ?)`,
      [voucherId, voucherLineNo++, settings.purchase_account_id, taxable, "Purchase debit from PO"]
    );

    if (cgst > 0 && settings.cgst_input_account_id) {
      await conn.query(
        `INSERT INTO voucher_line (header_id, line_no, account_id, dc, amount, line_narration)
         VALUES (?, ?, ?, 'D', ?, ?)`,
        [voucherId, voucherLineNo++, settings.cgst_input_account_id, cgst, "CGST input from PO"]
      );
    }

    if (sgst > 0 && settings.sgst_input_account_id) {
      await conn.query(
        `INSERT INTO voucher_line (header_id, line_no, account_id, dc, amount, line_narration)
         VALUES (?, ?, ?, 'D', ?, ?)`,
        [voucherId, voucherLineNo++, settings.sgst_input_account_id, sgst, "SGST input from PO"]
      );
    }

    if (igst > 0 && settings.igst_input_account_id) {
      await conn.query(
        `INSERT INTO voucher_line (header_id, line_no, account_id, dc, amount, line_narration)
         VALUES (?, ?, ?, 'D', ?, ?)`,
        [voucherId, voucherLineNo++, settings.igst_input_account_id, igst, "IGST input from PO"]
      );
    }

    await conn.query(
      `INSERT INTO voucher_line (header_id, line_no, account_id, dc, amount, line_narration)
       VALUES (?, ?, ?, 'C', ?, ?)`,
      [voucherId, voucherLineNo++, settings.payable_account_id, totalAmount, "Vendor payable from PO"]
    );

    const [invResult] = await conn.query(
      `INSERT INTO purchase_invoices
       (company_id, party_id, invoice_no, invoice_date, amount, taxable_amount, cgst_amount, sgst_amount, igst_amount, amount_paid, balance_amount, status, voucher_id, created_by, source_po_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'POSTED', ?, ?, ?)`,
      [
        req.user.company_id,
        po.vendor_id,
        invoice_no,
        invoice_date,
        totalAmount,
        taxable,
        cgst,
        sgst,
        igst,
        totalAmount,
        voucherId,
        req.user.id,
        poId,
      ]
    );

    const purchaseInvoiceId = invResult.insertId;

    for (const [index, line] of preparedLines.entries()) {
      await conn.query(
        `INSERT INTO purchase_invoice_lines
         (purchase_invoice_id, item_id, description_text, qty, rate, taxable_amount, cgst_amount, sgst_amount, igst_amount, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          purchaseInvoiceId,
          line.item_id,
          line.description_text || null,
          line.qty,
          line.rate,
          line.taxable_amount,
          line.cgst_amount,
          line.sgst_amount,
          line.igst_amount,
          line.line_total,
        ]
      );

      if (Number(line.track_inventory) === 1 && String(line.item_type) === "GOODS") {
        await conn.query(
          `INSERT INTO stock_movements
           (company_id, item_id, txn_date, movement_type, qty_in, qty_out, reference_type, reference_id, remarks)
           VALUES (?, ?, ?, 'PURCHASE', ?, 0, 'purchase_invoice', ?, ?)`,
          [
            req.user.company_id,
            line.item_id,
            invoice_date,
            line.qty,
            purchaseInvoiceId,
            `Converted from PO ${po.po_no}, line ${index + 1}`,
          ]
        );
      }
    }

    await conn.query(
      `UPDATE purchase_orders
       SET status='CLOSED', approved_by=?
       WHERE company_id=? AND id=?`,
      [req.user.id, req.user.company_id, poId]
    );

    await writeAuditLog(conn, {
      companyId: req.user.company_id,
      userId: req.user.id,
      action: "PURCHASE_ORDER_CONVERTED",
      entityType: "purchase_order",
      entityId: poId,
      details: `Converted PO ${po.po_no} to purchase invoice ${invoice_no}`,
    });

    await writeAuditLog(conn, {
      companyId: req.user.company_id,
      userId: req.user.id,
      action: "PURCHASE_INVOICE_POSTED",
      entityType: "purchase_invoice",
      entityId: purchaseInvoiceId,
      details: `Posted purchase invoice ${invoice_no} from PO ${po.po_no}`,
    });

    await conn.commit();

    res.json({
      message: "Purchase order converted to purchase invoice ✅",
      purchase_invoice_id: purchaseInvoiceId,
      voucher_id: voucherId,
      voucher_no: voucherNo,
      total_amount: totalAmount,
    });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({
      message: "Failed to convert purchase order",
      error: error.message,
    });
  } finally {
    conn.release();
  }
});
app.get("/api/sales-orders", auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         so.*,
         p.party_code,
         p.party_name
       FROM sales_orders so
       JOIN parties p ON p.id = so.customer_id
       WHERE so.company_id=?
       ORDER BY so.so_date DESC, so.id DESC`,
      [req.user.company_id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Failed to load sales orders", error: error.message });
  }
});

app.get("/api/sales-orders/:id", auth, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const [headerRows] = await pool.query(
      `SELECT
         so.*,
         p.party_code,
         p.party_name,
         p.gstin,
         p.phone,
         p.email
       FROM sales_orders so
       JOIN parties p ON p.id = so.customer_id
       WHERE so.company_id=? AND so.id=?`,
      [req.user.company_id, id]
    );

    if (!headerRows.length) {
      return res.status(404).json({ message: "Sales order not found" });
    }

    const [lineRows] = await pool.query(
      `SELECT
         sol.*,
         i.item_code,
         i.item_name,
         i.unit,
         i.hsn_sac
       FROM sales_order_lines sol
       JOIN items i ON i.id = sol.item_id
       WHERE sol.sales_order_id=?
       ORDER BY sol.id ASC`,
      [id]
    );

    res.json({ header: headerRows[0], lines: lineRows });
  } catch (error) {
    res.status(500).json({ message: "Failed to load sales order details", error: error.message });
  }
});

app.post("/api/sales-orders", auth, requireRole("ADMIN", "PREPARER"), async (req, res) => {
  const missing = requireFields(req.body, ["customer_id", "so_no", "so_date", "lines"]);
  if (missing) return res.status(400).json({ message: `${missing} is required` });

  if (!Array.isArray(req.body.lines) || req.body.lines.length === 0) {
    return res.status(400).json({ message: "At least one sales order line is required" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { customer_id, so_no, so_date, expected_date, remarks, lines } = req.body;

    await ensurePostingAllowed(conn, companyId, someDate, req.user.role);

    const itemIds = [...new Set(lines.map((x) => Number(x.item_id)).filter(Boolean))];
    if (!itemIds.length) throw new Error("Valid item lines are required");

    const [itemRows] = await conn.query(
      `SELECT * FROM items WHERE company_id=? AND id IN (${itemIds.map(() => "?").join(",")})`,
      [req.user.company_id, ...itemIds]
    );

    if (itemRows.length !== itemIds.length) {
      throw new Error("One or more items are invalid");
    }

    let totalAmount = 0;

    const preparedLines = lines.map((ln) => {
      const item = itemRows.find((x) => Number(x.id) === Number(ln.item_id));
      const qty = Number(ln.qty || 0);
      const rate = Number(ln.rate || item.sales_rate || 0);
      const taxPercent = Number(ln.tax_percent !== undefined ? ln.tax_percent : item.tax_percent || 0);
      const taxableAmount = Number((qty * rate).toFixed(2));
      const taxAmount = Number(((taxableAmount * taxPercent) / 100).toFixed(2));
      const lineTotal = Number((taxableAmount + taxAmount).toFixed(2));
      totalAmount += lineTotal;

      return {
        item_id: item.id,
        description_text: ln.description_text || item.item_name,
        qty,
        rate,
        tax_percent: taxPercent,
        taxable_amount: taxableAmount,
        tax_amount: taxAmount,
        line_total: lineTotal,
      };
    });

    const [soResult] = await conn.query(
      `INSERT INTO sales_orders
       (company_id, customer_id, so_no, so_date, expected_date, status, remarks, total_amount, created_by)
       VALUES (?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?)`,
      [
        req.user.company_id,
        customer_id,
        so_no,
        so_date,
        expected_date || null,
        remarks || null,
        Number(totalAmount.toFixed(2)),
        req.user.id,
      ]
    );

    for (const line of preparedLines) {
      await conn.query(
        `INSERT INTO sales_order_lines
         (sales_order_id, item_id, description_text, qty, rate, tax_percent, taxable_amount, tax_amount, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          soResult.insertId,
          line.item_id,
          line.description_text,
          line.qty,
          line.rate,
          line.tax_percent,
          line.taxable_amount,
          line.tax_amount,
          line.line_total,
        ]
      );
    }

    await writeAuditLog(conn, {
      companyId: req.user.company_id,
      userId: req.user.id,
      action: "SALES_ORDER_CREATED",
      entityType: "sales_order",
      entityId: soResult.insertId,
      details: `Created sales order ${so_no}`,
    });

    await conn.commit();

    res.json({
      message: "Sales order created ✅",
      sales_order_id: soResult.insertId,
      total_amount: Number(totalAmount.toFixed(2)),
    });
const [partyRows] = await conn.query(
  `SELECT id, party_name, credit_limit
   FROM parties
   WHERE company_id=? AND id=?`,
  [companyId, party_id]
);

if (!partyRows.length) {
  throw new Error("Customer not found");
}

const party = partyRows[0];
const creditLimit = Number(party.credit_limit || 0);

if (creditLimit > 0) {
  const [[outstandingRow]] = await conn.query(
    `SELECT COALESCE(SUM(balance_amount), 0) AS outstanding
     FROM sales_invoices
     WHERE company_id=?
       AND party_id=?
       AND status='POSTED'`,
    [companyId, party_id]
  );

  const currentOutstanding = Number(outstandingRow.outstanding || 0);
  const projectedOutstanding = currentOutstanding + totalAmount;

  if (projectedOutstanding > creditLimit) {
    throw new Error(
      `Credit limit exceeded for ${party.party_name}. Limit: ${creditLimit.toFixed(2)}, Current Outstanding: ${currentOutstanding.toFixed(2)}, After Invoice: ${projectedOutstanding.toFixed(2)}`
    );
  }
}
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ message: "Failed to create sales order", error: error.message });
  } finally {
    conn.release();
  }
});

app.post("/api/sales-orders/:id/status", auth, requireRole("ADMIN", "APPROVER"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;

    const allowed = ["DRAFT", "CONFIRMED", "PARTIAL", "CLOSED", "CANCELLED"];
    if (!allowed.includes(String(status || "").toUpperCase())) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const [r] = await pool.query(
      `UPDATE sales_orders
       SET status=?, approved_by=?
       WHERE company_id=? AND id=?`,
      [String(status).toUpperCase(), req.user.id, req.user.company_id, id]
    );

    if (!r.affectedRows) {
      return res.status(404).json({ message: "Sales order not found" });
    }

    await writeAuditLog(pool, {
      companyId: req.user.company_id,
      userId: req.user.id,
      action: "SALES_ORDER_STATUS_CHANGED",
      entityType: "sales_order",
      entityId: id,
      details: `Sales order ${id} moved to ${String(status).toUpperCase()}`,
    });

    res.json({ message: "Sales order status updated ✅" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update sales order status", error: error.message });
  }
});
app.get("/api/collections/summary", auth, async (req, res) => {
  try {
    const companyId = req.user.company_id;

    const [[totalOutstandingRow]] = await pool.query(
      `SELECT COALESCE(SUM(balance_amount), 0) AS total_outstanding
       FROM sales_invoices
       WHERE company_id=?
         AND status='POSTED'
         AND COALESCE(balance_amount, 0) > 0`,
      [companyId]
    );

    const [[overdueRow]] = await pool.query(
      `SELECT COALESCE(SUM(balance_amount), 0) AS overdue_outstanding
       FROM sales_invoices
       WHERE company_id=?
         AND status='POSTED'
         AND COALESCE(balance_amount, 0) > 0
         AND invoice_date < CURDATE() - INTERVAL 30 DAY`,
      [companyId]
    );

    const [[customerCountRow]] = await pool.query(
      `SELECT COUNT(DISTINCT party_id) AS customers_with_dues
       FROM sales_invoices
       WHERE company_id=?
         AND status='POSTED'
         AND COALESCE(balance_amount, 0) > 0`,
      [companyId]
    );

    const [[followupRow]] = await pool.query(
      `SELECT COUNT(*) AS open_followups
       FROM collection_followups
       WHERE company_id=?
         AND status='OPEN'`,
      [companyId]
    );

    res.json({
      total_outstanding: Number(totalOutstandingRow.total_outstanding || 0),
      overdue_outstanding: Number(overdueRow.overdue_outstanding || 0),
      customers_with_dues: Number(customerCountRow.customers_with_dues || 0),
      open_followups: Number(followupRow.open_followups || 0),
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to load collections summary",
      error: error.message,
    });
  }
});
app.get("/api/collections/overdue-invoices", auth, async (req, res) => {
  try {
    const companyId = req.user.company_id;

    const [rows] = await pool.query(
      `SELECT
         si.id,
         si.invoice_no,
         si.invoice_date,
         si.amount,
         si.balance_amount,
         DATEDIFF(CURDATE(), si.invoice_date) AS overdue_days,
         p.party_code,
         p.party_name,
         p.credit_limit
       FROM sales_invoices si
       JOIN parties p ON p.id = si.party_id
       WHERE si.company_id=?
         AND si.status='POSTED'
         AND COALESCE(si.balance_amount, 0) > 0
         AND si.invoice_date < CURDATE() - INTERVAL 30 DAY
       ORDER BY overdue_days DESC, si.invoice_date ASC`,
      [companyId]
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({
      message: "Failed to load overdue invoices",
      error: error.message,
    });
  }
});
app.get("/api/collections/customer-risk", auth, async (req, res) => {
  try {
    const companyId = req.user.company_id;

    const [rows] = await pool.query(
      `SELECT
         p.id AS party_id,
         p.party_code,
         p.party_name,
         p.credit_limit,
         COALESCE(SUM(si.balance_amount), 0) AS outstanding,
         CASE
           WHEN p.credit_limit > 0
             THEN ROUND((COALESCE(SUM(si.balance_amount), 0) / p.credit_limit) * 100, 2)
           ELSE 0
         END AS credit_utilization_percent
       FROM parties p
       LEFT JOIN sales_invoices si
         ON si.party_id = p.id
        AND si.company_id = p.company_id
        AND si.status='POSTED'
        AND COALESCE(si.balance_amount, 0) > 0
       WHERE p.company_id=?
         AND p.party_type IN ('CUSTOMER', 'BOTH')
       GROUP BY p.id, p.party_code, p.party_name, p.credit_limit
       ORDER BY credit_utilization_percent DESC, outstanding DESC`,
      [companyId]
    );

    const result = rows.map((row) => {
      const util = Number(row.credit_utilization_percent || 0);
      return {
        ...row,
        risk_status:
          util >= 100 ? "OVER_LIMIT" :
          util >= 80 ? "HIGH_RISK" :
          util > 0 ? "WATCH" :
          "NORMAL",
      };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      message: "Failed to load customer risk",
      error: error.message,
    });
  }
});
app.get("/api/collections/followups", auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         cf.*,
         p.party_code,
         p.party_name,
         si.invoice_no
       FROM collection_followups cf
       JOIN parties p ON p.id = cf.party_id
       LEFT JOIN sales_invoices si ON si.id = cf.sales_invoice_id
       WHERE cf.company_id=?
       ORDER BY cf.followup_date ASC, cf.id DESC`,
      [req.user.company_id]
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({
      message: "Failed to load followups",
      error: error.message,
    });
  }
});

app.post("/api/collections/followups", auth, requireRole("ADMIN", "PREPARER", "APPROVER"), async (req, res) => {
  const missing = requireFields(req.body, ["party_id", "followup_date", "followup_mode"]);
  if (missing) return res.status(400).json({ message: `${missing} is required` });

  try {
    const {
      party_id,
      sales_invoice_id,
      followup_date,
      followup_mode,
      notes,
    } = req.body;

    const [r] = await pool.query(
      `INSERT INTO collection_followups
       (company_id, party_id, sales_invoice_id, followup_date, followup_mode, notes, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 'OPEN', ?)`,
      [
        req.user.company_id,
        party_id,
        sales_invoice_id || null,
        followup_date,
        String(followup_mode).toUpperCase(),
        notes || null,
        req.user.id,
      ]
    );

    await writeAuditLog(pool, {
      companyId: req.user.company_id,
      userId: req.user.id,
      action: "FOLLOWUP_CREATED",
      entityType: "collection_followup",
      entityId: r.insertId,
      details: `Created collection follow-up for party ${party_id}`,
    });

    res.json({ message: "Follow-up created ✅", followup_id: r.insertId });
  } catch (error) {
    res.status(500).json({
      message: "Failed to create follow-up",
      error: error.message,
    });
  }
});

app.post("/api/collections/followups/:id/status", auth, requireRole("ADMIN", "PREPARER", "APPROVER"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;

    const allowed = ["OPEN", "DONE", "SKIPPED"];
    if (!allowed.includes(String(status || "").toUpperCase())) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const [r] = await pool.query(
      `UPDATE collection_followups
       SET status=?
       WHERE company_id=? AND id=?`,
      [String(status).toUpperCase(), req.user.company_id, id]
    );

    if (!r.affectedRows) {
      return res.status(404).json({ message: "Follow-up not found" });
    }

    res.json({ message: "Follow-up status updated ✅" });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update follow-up status",
      error: error.message,
    });
  }
});
app.get("/api/companies", auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         c.id,
         c.code,
         c.name,
         c.base_currency,
         c.is_active,
         c.default_financial_year_id
       FROM companies c
       WHERE c.is_active=1
       ORDER BY c.name ASC`
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Failed to load companies", error: error.message });
  }
});

app.post("/api/companies/switch", auth, async (req, res) => {
  try {
    const companyId = Number(req.body.company_id);
    if (!companyId) {
      return res.status(400).json({ message: "company_id is required" });
    }

    const [companyRows] = await pool.query(
      `SELECT * FROM companies WHERE id=? AND is_active=1`,
      [companyId]
    );

    if (!companyRows.length) {
      return res.status(404).json({ message: "Company not found" });
    }

    await pool.query(
      `UPDATE users
       SET active_company_id=?
       WHERE id=?`,
      [companyId, req.user.id]
    );

    await writeAuditLog(pool, {
      companyId,
      userId: req.user.id,
      action: "COMPANY_SWITCHED",
      entityType: "company",
      entityId: companyId,
      details: `Switched active company to ${companyRows[0].name}`,
    });

    res.json({
      message: "Active company switched ✅",
      company_id: companyId,
      company_name: companyRows[0].name,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to switch company", error: error.message });
  }
});
app.get("/api/companies", auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         c.id,
         c.code,
         c.name,
         c.base_currency,
         c.is_active,
         c.default_financial_year_id
       FROM companies c
       WHERE c.is_active=1
       ORDER BY c.name ASC`
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Failed to load companies", error: error.message });
  }
});

app.post("/api/companies/switch", auth, async (req, res) => {
  try {
    const companyId = Number(req.body.company_id);
    if (!companyId) {
      return res.status(400).json({ message: "company_id is required" });
    }

    const [companyRows] = await pool.query(
      `SELECT * FROM companies WHERE id=? AND is_active=1`,
      [companyId]
    );

    if (!companyRows.length) {
      return res.status(404).json({ message: "Company not found" });
    }

    await pool.query(
      `UPDATE users
       SET active_company_id=?
       WHERE id=?`,
      [companyId, req.user.id]
    );

    await writeAuditLog(pool, {
      companyId,
      userId: req.user.id,
      action: "COMPANY_SWITCHED",
      entityType: "company",
      entityId: companyId,
      details: `Switched active company to ${companyRows[0].name}`,
    });

    res.json({
      message: "Active company switched ✅",
      company_id: companyId,
      company_name: companyRows[0].name,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to switch company", error: error.message });
  }
});
app.get("/api/financial-years", auth, async (req, res) => {
  try {
    const companyId = await getActiveCompanyIdForUser(pool, req.user);

    const [rows] = await pool.query(
      `SELECT *
       FROM financial_years
       WHERE company_id=?
       ORDER BY start_date DESC`,
      [companyId]
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Failed to load financial years", error: error.message });
  }
});

app.post("/api/financial-years", auth, requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = await getActiveCompanyIdForUser(pool, req.user);
    const { year_code, start_date, end_date } = req.body;

    if (!year_code || !start_date || !end_date) {
      return res.status(400).json({ message: "year_code, start_date and end_date are required" });
    }

    const [openRows] = await pool.query(
      `SELECT id FROM financial_years
       WHERE company_id=?
         AND status='OPEN'`,
      [companyId]
    );

    const status = openRows.length ? "ARCHIVED" : "OPEN";

    const [r] = await pool.query(
      `INSERT INTO financial_years
       (company_id, year_code, start_date, end_date, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [companyId, year_code, start_date, end_date, status, req.user.id]
    );

    await writeAuditLog(pool, {
      companyId,
      userId: req.user.id,
      action: "FINANCIAL_YEAR_CREATED",
      entityType: "financial_year",
      entityId: r.insertId,
      details: `Created financial year ${year_code}`,
    });

    res.json({ message: "Financial year created ✅", financial_year_id: r.insertId });
  } catch (error) {
    res.status(500).json({ message: "Failed to create financial year", error: error.message });
  }
});

app.post("/api/financial-years/:id/open", auth, requireRole("ADMIN"), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const companyId = await getActiveCompanyIdForUser(conn, req.user);
    const fyId = Number(req.params.id);

    const [rows] = await conn.query(
      `SELECT * FROM financial_years WHERE company_id=? AND id=? FOR UPDATE`,
      [companyId, fyId]
    );

    if (!rows.length) {
      throw new Error("Financial year not found");
    }

    await conn.query(
      `UPDATE financial_years
       SET status='ARCHIVED'
       WHERE company_id=?
         AND status='OPEN'
         AND id<>?`,
      [companyId, fyId]
    );

    await conn.query(
      `UPDATE financial_years
       SET status='OPEN'
       WHERE company_id=? AND id=?`,
      [companyId, fyId]
    );

    await conn.query(
      `UPDATE companies
       SET default_financial_year_id=?
       WHERE id=?`,
      [fyId, companyId]
    );

    await writeAuditLog(conn, {
      companyId,
      userId: req.user.id,
      action: "FINANCIAL_YEAR_OPENED",
      entityType: "financial_year",
      entityId: fyId,
      details: `Opened financial year ${rows[0].year_code}`,
    });

    await conn.commit();
    res.json({ message: "Financial year opened ✅" });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ message: "Failed to open financial year", error: error.message });
  } finally {
    conn.release();
  }
});
app.get("/api/posting-locks", auth, async (req, res) => {
  try {
    const companyId = await getActiveCompanyIdForUser(pool, req.user);

    const [rows] = await pool.query(
      `SELECT *
       FROM posting_locks
       WHERE company_id=?
       ORDER BY lock_from DESC, id DESC`,
      [companyId]
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Failed to load posting locks", error: error.message });
  }
});

app.post("/api/posting-locks", auth, requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = await getActiveCompanyIdForUser(pool, req.user);
    const { lock_from, lock_to, reason } = req.body;

    if (!lock_from || !lock_to) {
      return res.status(400).json({ message: "lock_from and lock_to are required" });
    }

    const [r] = await pool.query(
      `INSERT INTO posting_locks
       (company_id, lock_from, lock_to, reason, is_active, created_by)
       VALUES (?, ?, ?, ?, 1, ?)`,
      [companyId, lock_from, lock_to, reason || null, req.user.id]
    );

    await writeAuditLog(pool, {
      companyId,
      userId: req.user.id,
      action: "POSTING_LOCK_CREATED",
      entityType: "posting_lock",
      entityId: r.insertId,
      details: `Created posting lock from ${lock_from} to ${lock_to}`,
    });

    res.json({ message: "Posting lock created ✅", posting_lock_id: r.insertId });
  } catch (error) {
    res.status(500).json({ message: "Failed to create posting lock", error: error.message });
  }
});

app.post("/api/posting-locks/:id/toggle", auth, requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = await getActiveCompanyIdForUser(pool, req.user);
    const id = Number(req.params.id);

    const [rows] = await pool.query(
      `SELECT * FROM posting_locks WHERE company_id=? AND id=?`,
      [companyId, id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Posting lock not found" });
    }

    const nextValue = Number(rows[0].is_active) === 1 ? 0 : 1;

    await pool.query(
      `UPDATE posting_locks
       SET is_active=?
       WHERE company_id=? AND id=?`,
      [nextValue, companyId, id]
    );

    res.json({ message: `Posting lock ${nextValue ? "enabled" : "disabled"} ✅` });
  } catch (error) {
    res.status(500).json({ message: "Failed to toggle posting lock", error: error.message });
  }
});
app.post("/api/financial-years/:id/close", auth, requireRole("ADMIN"), async (req, res) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const companyId = await getActiveCompanyIdForUser(conn, req.user);
    const sourceFyId = Number(req.params.id);

    const [sourceRows] = await conn.query(
      `SELECT * FROM financial_years
       WHERE company_id=? AND id=?
       FOR UPDATE`,
      [companyId, sourceFyId]
    );

    if (!sourceRows.length) {
      throw new Error("Source financial year not found");
    }

    const sourceFy = sourceRows[0];
    if (String(sourceFy.status || "").toUpperCase() !== "OPEN") {
      throw new Error("Only open financial year can be closed");
    }

    const nextStart = new Date(sourceFy.end_date);
    nextStart.setDate(nextStart.getDate() + 1);

    const nextEnd = new Date(nextStart);
    nextEnd.setFullYear(nextEnd.getFullYear() + 1);
    nextEnd.setDate(nextEnd.getDate() - 1);

    const formatDate = (d) => d.toISOString().slice(0, 10);
    const nextStartStr = formatDate(nextStart);
    const nextEndStr = formatDate(nextEnd);

    const [targetRows] = await conn.query(
      `SELECT * FROM financial_years
       WHERE company_id=? AND start_date=? AND end_date=?
       LIMIT 1`,
      [companyId, nextStartStr, nextEndStr]
    );

    let targetFyId;
    let targetYearCode;

    if (targetRows.length) {
      targetFyId = targetRows[0].id;
      targetYearCode = targetRows[0].year_code;
    } else {
      const nextCode = `FY${nextStartStr.slice(0, 4)}-${nextEndStr.slice(2, 4)}`;
      const [newFy] = await conn.query(
        `INSERT INTO financial_years
         (company_id, year_code, start_date, end_date, status, created_by)
         VALUES (?, ?, ?, ?, 'ARCHIVED', ?)`,
        [companyId, nextCode, nextStartStr, nextEndStr, req.user.id]
      );
      targetFyId = newFy.insertId;
      targetYearCode = nextCode;
    }

    const [existingRunRows] = await conn.query(
      `SELECT id
       FROM opening_balance_runs
       WHERE company_id=? AND target_financial_year_id=?`,
      [companyId, targetFyId]
    );

    if (existingRunRows.length) {
      throw new Error("Opening balances already carried forward for the next year");
    }

    const [balanceRows] = await conn.query(
      `SELECT
         a.id AS account_id,
         a.account_code,
         a.account_name,
         a.account_type,
         COALESCE(SUM(CASE WHEN vl.dc='D' THEN vl.amount ELSE 0 END), 0) AS debit_total,
         COALESCE(SUM(CASE WHEN vl.dc='C' THEN vl.amount ELSE 0 END), 0) AS credit_total
       FROM accounts a
       LEFT JOIN voucher_line vl ON vl.account_id = a.id
       LEFT JOIN voucher_header vh ON vh.id = vl.header_id
         AND vh.company_id = a.company_id
         AND vh.status='APPROVED'
         AND vh.voucher_date BETWEEN ? AND ?
       WHERE a.company_id=?
         AND a.account_type IN ('ASSET','LIABILITY','EQUITY')
       GROUP BY a.id, a.account_code, a.account_name, a.account_type
       ORDER BY a.account_code ASC`,
      [sourceFy.start_date, sourceFy.end_date, companyId]
    );

    const openingVoucherNo = `OPEN-${targetYearCode}`;
    const [vh] = await conn.query(
      `INSERT INTO voucher_header
       (company_id, voucher_no, voucher_type, voucher_date, narration, status, created_by, approved_by)
       VALUES (?, ?, 'JV', ?, ?, 'APPROVED', ?, ?)`,
      [
        companyId,
        openingVoucherNo,
        nextStartStr,
        `Opening balances for ${targetYearCode}`,
        req.user.id,
        req.user.id,
      ]
    );

    const openingVoucherId = vh.insertId;
    let lineNo = 1;
    let totalDebits = 0;
    let totalCredits = 0;

    for (const row of balanceRows) {
      const debit = Number(row.debit_total || 0);
      const credit = Number(row.credit_total || 0);
      const net = Number((debit - credit).toFixed(2));

      if (Math.abs(net) < 0.005) continue;

      let dc = "D";
      let amount = Math.abs(net);

      if (["LIABILITY", "EQUITY"].includes(String(row.account_type))) {
        if (net > 0) {
          dc = "D";
        } else {
          dc = "C";
        }
      } else {
        if (net > 0) {
          dc = "D";
        } else {
          dc = "C";
        }
      }

      if (amount <= 0) continue;

      if (dc === "D") totalDebits += amount;
      else totalCredits += amount;

      await conn.query(
        `INSERT INTO voucher_line
         (header_id, line_no, account_id, dc, amount, line_narration)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          openingVoucherId,
          lineNo++,
          row.account_id,
          dc,
          amount,
          `Opening balance for ${row.account_code} ${row.account_name}`,
        ]
      );
    }

    const diff = Number((totalDebits - totalCredits).toFixed(2));
    if (Math.abs(diff) >= 0.01) {
      const [capitalRows] = await conn.query(
        `SELECT id, account_code, account_name
         FROM accounts
         WHERE company_id=?
           AND account_type='EQUITY'
         ORDER BY id ASC
         LIMIT 1`,
        [companyId]
      );

      if (!capitalRows.length) {
        throw new Error("No equity account found to balance opening entry");
      }

      const balancingDc = diff > 0 ? "C" : "D";
      const balancingAmount = Math.abs(diff);

      await conn.query(
        `INSERT INTO voucher_line
         (header_id, line_no, account_id, dc, amount, line_narration)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          openingVoucherId,
          lineNo++,
          capitalRows[0].id,
          balancingDc,
          balancingAmount,
          "Opening balance adjustment",
        ]
      );
    }

    await conn.query(
      `INSERT INTO opening_balance_runs
       (company_id, source_financial_year_id, target_financial_year_id, opening_voucher_id, run_date, status, notes, created_by)
       VALUES (?, ?, ?, ?, CURDATE(), 'SUCCESS', ?, ?)`,
      [
        companyId,
        sourceFyId,
        targetFyId,
        openingVoucherId,
        `Opening balances created from ${sourceFy.year_code} to ${targetYearCode}`,
        req.user.id,
      ]
    );

    await conn.query(
      `UPDATE financial_years
       SET status='CLOSED', closed_by=?, closed_at=NOW()
       WHERE company_id=? AND id=?`,
      [req.user.id, companyId, sourceFyId]
    );

    await conn.query(
      `INSERT INTO posting_locks
       (company_id, lock_from, lock_to, reason, is_active, created_by)
       VALUES (?, ?, ?, ?, 1, ?)`,
      [
        companyId,
        sourceFy.start_date,
        sourceFy.end_date,
        `Auto lock after closing ${sourceFy.year_code}`,
        req.user.id,
      ]
    );

    await conn.query(
      `UPDATE companies
       SET default_financial_year_id=?
       WHERE id=?`,
      [targetFyId, companyId]
    );

    await conn.query(
      `UPDATE financial_years
       SET status='OPEN'
       WHERE company_id=? AND id=?`,
      [companyId, targetFyId]
    );

    await writeAuditLog(conn, {
      companyId,
      userId: req.user.id,
      action: "FINANCIAL_YEAR_CLOSED",
      entityType: "financial_year",
      entityId: sourceFyId,
      details: `Closed ${sourceFy.year_code} and created opening balances for ${targetYearCode}`,
    });

    await conn.commit();

    res.json({
      message: "Financial year closed and opening balances carried forward ✅",
      source_financial_year: sourceFy.year_code,
      target_financial_year: targetYearCode,
      opening_voucher_id: openingVoucherId,
    });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({
      message: "Failed to close financial year",
      error: error.message,
    });
  } finally {
    conn.release();
  }
});
app.post("/api/ai/parse-voucher", auth, requireRole("ADMIN", "PREPARER", "APPROVER"), async (req, res) => {
  try {
    const text = String(req.body.text || "").trim();
    if (!text) {
      return res.status(400).json({ message: "text is required" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        message: "OPENAI_API_KEY is missing in backend .env",
      });
    }

    const companyId = req.user.active_company_id || req.user.company_id;

    const [accounts] = await pool.query(
      `SELECT id, account_code, account_name, account_type
       FROM accounts
       WHERE company_id=? AND is_active=1
       ORDER BY account_name ASC`,
      [companyId]
    );

    const [parties] = await pool.query(
      `SELECT id, party_code, party_name, party_type
       FROM parties
       WHERE company_id=?
       ORDER BY party_name ASC`,
      [companyId]
    );

    const [items] = await pool.query(
      `SELECT id, item_code, item_name
       FROM items
       WHERE company_id=? AND is_active=1
       ORDER BY item_name ASC`,
      [companyId]
    );

    const aiResult = await parseVoucherWithAI({
      text,
      accounts,
      parties,
      items,
    });

    const matchedLines = (aiResult.lines || []).map((line) => {
      const matchedAccount = accounts.find(
        (a) =>
          String(a.account_name || "").toLowerCase() ===
          String(line.account_name || "").toLowerCase()
      );

      return {
        account_id: matchedAccount ? matchedAccount.id : null,
        account_name: line.account_name || "",
        dc: line.dc || "D",
        amount: Number(line.amount || 0),
        line_narration: line.line_narration || "",
        matched: !!matchedAccount,
      };
    });

    const debitTotal = matchedLines
      .filter((x) => x.dc === "D")
      .reduce((s, x) => s + Number(x.amount || 0), 0);

    const creditTotal = matchedLines
      .filter((x) => x.dc === "C")
      .reduce((s, x) => s + Number(x.amount || 0), 0);

    res.json({
      voucher_type: aiResult.voucher_type || "JV",
      narration: aiResult.narration || text,
      confidence: Number(aiResult.confidence || 0),
      notes: aiResult.notes || [],
      lines: matchedLines,
      debit_total: Number(debitTotal.toFixed(2)),
      credit_total: Number(creditTotal.toFixed(2)),
      balanced: Math.abs(debitTotal - creditTotal) < 0.01,
    });
  } catch (error) {
    console.error("AI voucher parse error:", error);

    res.status(500).json({
      message: "Failed to parse voucher with AI",
      error: error?.message || "Unknown AI error",
    });
  }
});
app.post(
  "/api/ai/intake/upload",
  auth,
  requireRole("ADMIN", "PREPARER", "APPROVER"),
  upload.single("document"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "document file is required" });
      }

      const companyId = req.user.active_company_id || req.user.company_id;

      const [parties] = await pool.query(
        `SELECT id, party_name, gstin, party_type
         FROM parties
         WHERE company_id=?`,
        [companyId]
      );

      const extracted = await extractInvoiceDataWithAI({
        filePath: req.file.path,
        fileMimeType: req.file.mimetype,
        parties,
      });

      const [intakeResult] = await pool.query(
        `INSERT INTO ai_document_intake
         (company_id, doc_type, original_filename, stored_file_path, extracted_json,
          detected_party_name, detected_invoice_no, detected_invoice_date, detected_total_amount,
          matched_party_id, draft_party_status, status, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'EXTRACTED', ?, ?)`,
        [
          companyId,
          extracted.doc_type || "OTHER",
          req.file.originalname,
          req.file.path,
          JSON.stringify(extracted),
          extracted.party_name || null,
          extracted.invoice_no || null,
          extracted.invoice_date || null,
          extracted.total_amount || null,
          extracted.matched_party_id || null,
          extracted.matched_party_id ? "NOT_NEEDED" : "SUGGESTED",
          (extracted.notes || []).join(" | ") || null,
          req.user.id,
        ]
      );

      let draftParty = null;

      if (!extracted.matched_party_id && extracted.party_name) {
        const [draftResult] = await pool.query(
          `INSERT INTO ai_party_drafts
           (company_id, intake_id, party_type, party_name, party_code, gstin, phone, email,
            address_line1, city, state_name, pincode, country, status, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?)`,
          [
            companyId,
            intakeResult.insertId,
            extracted.suggested_party_type || "VENDOR",
            extracted.party_name,
            null,
            extracted.gstin || null,
            extracted.phone || null,
            extracted.email || null,
            extracted.address_line1 || null,
            extracted.city || null,
            extracted.state_name || null,
            extracted.pincode || null,
            extracted.country || "India",
            req.user.id,
          ]
        );

        draftParty = {
          id: draftResult.insertId,
          party_name: extracted.party_name,
          gstin: extracted.gstin || null,
          party_type: extracted.suggested_party_type || "VENDOR",
        };
      }

      await writeAuditLog(pool, {
        companyId,
        userId: req.user.id,
        action: "AI_DOCUMENT_UPLOADED",
        entityType: "ai_document_intake",
        entityId: intakeResult.insertId,
        details: `AI extracted document ${req.file.originalname}`,
      });

      res.json({
        message: "Document extracted successfully ✅",
        intake_id: intakeResult.insertId,
        extracted,
        draft_party: draftParty,
      });
    } catch (error) {
      console.error("AI intake upload error:", error);
      res.status(500).json({
        message: "Failed to extract document with AI",
        error: error.message,
      });
    }
  }
);
app.get("/api/ai/intake", auth, async (req, res) => {
  try {
    const companyId = req.user.active_company_id || req.user.company_id;

    const [rows] = await pool.query(
      `SELECT *
       FROM ai_document_intake
       WHERE company_id=?
       ORDER BY id DESC`,
      [companyId]
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Failed to load AI intake records", error: error.message });
  }
});
app.get("/api/ai/intake/:id", auth, async (req, res) => {
  try {
    const companyId = req.user.active_company_id || req.user.company_id;
    const id = Number(req.params.id);

    const [intakeRows] = await pool.query(
      `SELECT * FROM ai_document_intake WHERE company_id=? AND id=?`,
      [companyId, id]
    );

    if (!intakeRows.length) {
      return res.status(404).json({ message: "AI intake record not found" });
    }

    const [draftRows] = await pool.query(
      `SELECT * FROM ai_party_drafts WHERE company_id=? AND intake_id=? ORDER BY id DESC`,
      [companyId, id]
    );

    res.json({
      intake: intakeRows[0],
      draft_party: draftRows[0] || null,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load AI intake details", error: error.message });
  }
});
app.post("/api/ai/party-drafts/:id/approve", auth, requireRole("ADMIN", "PREPARER"), async (req, res) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const companyId = req.user.active_company_id || req.user.company_id;
    const draftId = Number(req.params.id);

    const [draftRows] = await conn.query(
      `SELECT * FROM ai_party_drafts
       WHERE company_id=? AND id=?
       FOR UPDATE`,
      [companyId, draftId]
    );

    if (!draftRows.length) {
      throw new Error("Draft party not found");
    }

    const draft = draftRows[0];

    if (String(draft.status) === "APPROVED") {
      throw new Error("Draft party already approved");
    }

    const generatedCode = `PTY-${Date.now()}`;

    const [partyResult] = await conn.query(
      `INSERT INTO parties
       (company_id, party_code, party_name, party_type, gstin, phone, email, address_line1, city, state_name, pincode, country)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        draft.party_code || generatedCode,
        draft.party_name,
        draft.party_type,
        draft.gstin || null,
        draft.phone || null,
        draft.email || null,
        draft.address_line1 || null,
        draft.city || null,
        draft.state_name || null,
        draft.pincode || null,
        draft.country || "India",
      ]
    );

    await conn.query(
      `UPDATE ai_party_drafts
       SET status='APPROVED', approved_party_id=?
       WHERE company_id=? AND id=?`,
      [partyResult.insertId, companyId, draftId]
    );

    await conn.query(
      `UPDATE ai_document_intake
       SET matched_party_id=?, draft_party_status='APPROVED', status='REVIEWED'
       WHERE company_id=? AND id=?`,
      [partyResult.insertId, companyId, draft.intake_id]
    );

    await writeAuditLog(conn, {
      companyId,
      userId: req.user.id,
      action: "AI_PARTY_DRAFT_APPROVED",
      entityType: "party",
      entityId: partyResult.insertId,
      details: `Approved AI party draft ${draft.party_name}`,
    });

    await conn.commit();

    res.json({
      message: "Draft party approved and created ✅",
      party_id: partyResult.insertId,
    });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({
      message: "Failed to approve draft party",
      error: error.message,
    });
  } finally {
    conn.release();
  }
});
app.post("/api/ai/party-drafts/:id/reject", auth, requireRole("ADMIN", "PREPARER"), async (req, res) => {
  try {
    const companyId = req.user.active_company_id || req.user.company_id;
    const draftId = Number(req.params.id);

    const [draftRows] = await pool.query(
      `SELECT * FROM ai_party_drafts WHERE company_id=? AND id=?`,
      [companyId, draftId]
    );

    if (!draftRows.length) {
      return res.status(404).json({ message: "Draft party not found" });
    }

    await pool.query(
      `UPDATE ai_party_drafts
       SET status='REJECTED'
       WHERE company_id=? AND id=?`,
      [companyId, draftId]
    );

    await pool.query(
      `UPDATE ai_document_intake
       SET draft_party_status='REJECTED', status='REVIEWED'
       WHERE company_id=? AND id=?`,
      [companyId, draftRows[0].intake_id]
    );

    res.json({ message: "Draft party rejected ✅" });
  } catch (error) {
    res.status(500).json({
      message: "Failed to reject draft party",
      error: error.message,
    });
  }
});
app.post(
  "/api/ai/full-automation/upload",
  auth,
  requireRole("ADMIN", "PREPARER", "APPROVER"),
  aiUpload.single("document"),
  async (req, res) => {
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      if (!req.file) {
        throw new Error("document file is required");
      }

      if (!process.env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is missing in backend .env");
      }

      const companyId = req.user.active_company_id || req.user.company_id;

      const [parties] = await conn.query(
        `SELECT id, party_name, gstin, party_type
         FROM parties
         WHERE company_id=?`,
        [companyId]
      );

      const extracted = await extractInvoiceDataWithAI({
        filePath: req.file.path,
        fileMimeType: req.file.mimetype,
        parties,
      });

      const [intakeResult] = await conn.query(
        `INSERT INTO ai_document_intake
         (company_id, doc_type, original_filename, stored_file_path, extracted_json,
          detected_party_name, detected_invoice_no, detected_invoice_date, detected_total_amount,
          matched_party_id, draft_party_status, status, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'EXTRACTED', ?, ?)`,
        [
          companyId,
          extracted.doc_type || "PURCHASE_INVOICE",
          req.file.originalname,
          req.file.path,
          JSON.stringify(extracted),
          extracted.party_name || null,
          extracted.invoice_no || null,
          extracted.invoice_date || null,
          extracted.total_amount || null,
          extracted.matched_party_id || null,
          "NOT_NEEDED",
          "AI full automation run",
          req.user.id,
        ]
      );

      const partyResult = await findOrCreatePartyFromAI(
        conn,
        companyId,
        extracted,
        req.user.id
      );

      const extractedItems = Array.isArray(extracted.items) ? extracted.items : [];
      const finalItems = [];

      for (const row of extractedItems) {
        const itemResult = await findOrCreateItemFromAI(conn, companyId, row);

        finalItems.push({
          item_id: itemResult.item ? itemResult.item.id : null,
          description_text: row.description || row.name || "AI Line",
          qty: Number(row.qty || 1),
          rate: Number(row.rate || 0),
          taxable_amount: Number(row.amount || 0),
          line_total: Number(row.amount || 0),
        });
      }

      const confidence = Number(extracted.matched_party_confidence || 0);
      const shouldAutoPost =
        confidence >= 0.85 &&
        partyResult.party &&
        finalItems.length > 0 &&
        Number(extracted.total_amount || 0) > 0;

      let createdPurchaseInvoiceId = null;
      let createdVoucherId = null;
      let createdVoucherNo = null;
      let finalStatus = "DRAFT_CREATED";

      if (shouldAutoPost) {
        const created = await createPurchaseInvoiceAndVoucherFromAI(
          conn,
          companyId,
          partyResult.party.id,
          extracted,
          finalItems,
          req.user.id,
          req.user.role
        );

        createdPurchaseInvoiceId = created.purchaseInvoiceId;
        createdVoucherId = created.voucherId;
        createdVoucherNo = created.voucherNo;
        finalStatus = "AUTO_POSTED";
      } else {
        const [draftInvoiceResult] = await conn.query(
          `INSERT INTO ai_purchase_invoice_drafts
           (company_id, intake_id, party_id, invoice_no, invoice_date, taxable_amount, cgst_amount, sgst_amount, igst_amount, total_amount, status, notes, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?)`,
          [
            companyId,
            intakeResult.insertId,
            partyResult.party.id,
            extracted.invoice_no || null,
            extracted.invoice_date || null,
            Number(extracted.taxable_amount || 0),
            Number(extracted.cgst_amount || 0),
            Number(extracted.sgst_amount || 0),
            Number(extracted.igst_amount || 0),
            Number(extracted.total_amount || 0),
            "AI automation created review draft",
            req.user.id,
          ]
        );

        for (let i = 0; i < finalItems.length; i++) {
          const row = finalItems[i];
          await conn.query(
            `INSERT INTO ai_purchase_invoice_draft_lines
             (draft_id, line_no, item_description, qty, rate, amount, matched_item_id, new_item_suggested)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              draftInvoiceResult.insertId,
              i + 1,
              row.description_text,
              row.qty,
              row.rate,
              row.line_total,
              row.item_id,
              row.item_id ? 0 : 1,
            ]
          );
        }
      }

      await conn.query(
        `UPDATE ai_document_intake
         SET matched_party_id=?, status=?
         WHERE company_id=? AND id=?`,
        [
          partyResult.party.id,
          finalStatus === "AUTO_POSTED" ? "POSTED" : "REVIEWED",
          companyId,
          intakeResult.insertId,
        ]
      );

      await conn.query(
        `INSERT INTO ai_automation_runs
         (company_id, intake_id, run_type, status, confidence, created_party_id, created_purchase_invoice_id, created_voucher_id, notes, created_by)
         VALUES (?, ?, 'PURCHASE_INVOICE', ?, ?, ?, ?, ?, ?, ?)`,
        [
          companyId,
          intakeResult.insertId,
          finalStatus,
          confidence,
          partyResult.created ? partyResult.party.id : null,
          createdPurchaseInvoiceId,
          createdVoucherId,
          finalStatus === "AUTO_POSTED"
            ? `Auto-posted successfully. Voucher ${createdVoucherNo || ""}`.trim()
            : "Draft created for review due to lower confidence",
          req.user.id,
        ]
      );

      if (typeof writeAuditLog === "function") {
        await writeAuditLog(conn, {
          companyId,
          userId: req.user.id,
          action: "AI_FULL_AUTOMATION_RUN",
          entityType: "ai_document_intake",
          entityId: intakeResult.insertId,
          details: finalStatus === "AUTO_POSTED"
            ? `AI auto-posted purchase invoice from ${req.file.originalname}`
            : `AI created draft purchase invoice from ${req.file.originalname}`,
        });
      }

      await conn.commit();

      res.json({
        message:
          finalStatus === "AUTO_POSTED"
            ? "AI automation completed and auto-posted ✅"
            : "AI automation completed and created review draft ✅",
        status: finalStatus,
        intake_id: intakeResult.insertId,
        extracted,
        party: partyResult.party,
        party_created: partyResult.created,
        purchase_invoice_id: createdPurchaseInvoiceId,
        voucher_id: createdVoucherId,
        voucher_no: createdVoucherNo,
      });
    } catch (error) {
      await conn.rollback();
      console.error("AI full automation error:", error);
      res.status(500).json({
        message: "Failed to run full AI automation",
        error: error.message,
      });
    } finally {
      conn.release();
    }
  }
);

app.post(
  "/api/bank-ai/import",
  auth,
  requireRole("ADMIN", "PREPARER", "APPROVER"),
  aiUpload.single("document"),
  async (req, res) => {
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      if (!req.file) {
        throw new Error("document file is required");
      }

      const companyId = req.user.active_company_id || req.user.company_id;
      const { bank_account_id, import_name } = req.body;

      if (!bank_account_id) {
        throw new Error("bank_account_id is required");
      }

      const csvText = fs.readFileSync(req.file.path, "utf8");
      const parsedRows = parseCsvBankStatement(csvText);

      if (!parsedRows.length) {
        throw new Error("No rows found in bank statement");
      }

      const dates = parsedRows
        .map((x) => x.txn_date)
        .filter(Boolean)
        .sort();

      const [importResult] = await conn.query(
        `INSERT INTO bank_statement_imports
         (company_id, bank_account_id, import_name, statement_date_from, statement_date_to, status, created_by)
         VALUES (?, ?, ?, ?, ?, 'IMPORTED', ?)`,
        [
          companyId,
          Number(bank_account_id),
          import_name || req.file.originalname,
          dates[0] || null,
          dates[dates.length - 1] || null,
          req.user.id,
        ]
      );

      for (const row of parsedRows) {
        await conn.query(
          `INSERT INTO bank_statement_lines
           (import_id, txn_date, description_text, reference_no, debit_amount, credit_amount, balance_amount)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            importResult.insertId,
            row.txn_date,
            row.description_text || null,
            row.reference_no || null,
            Number(row.debit_amount || 0),
            Number(row.credit_amount || 0),
            row.balance_amount == null ? null : Number(row.balance_amount),
          ]
        );
      }

      await conn.commit();

      res.json({
        message: "Bank statement imported ✅",
        import_id: importResult.insertId,
        row_count: parsedRows.length,
      });
    } catch (error) {
      await conn.rollback();
      res.status(500).json({
        message: "Failed to import bank statement",
        error: error.message,
      });
    } finally {
      conn.release();
    }
  }
);
app.post("/api/bank-ai/match/:importId", auth, async (req, res) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const companyId = req.user.active_company_id || req.user.company_id;
    const importId = Number(req.params.importId);

    const [importRows] = await conn.query(
      `SELECT * FROM bank_statement_imports
       WHERE company_id=? AND id=?`,
      [companyId, importId]
    );

    if (!importRows.length) {
      throw new Error("Bank import not found");
    }

    const [stmtRows] = await conn.query(
      `SELECT * FROM bank_statement_lines
       WHERE import_id=?
       ORDER BY txn_date ASC, id ASC`,
      [importId]
    );

    const [receiptRows] = await conn.query(
      `SELECT
         id,
         receipt_date AS txn_date,
         receipt_no AS doc_no,
         reference_no,
         remarks AS narration,
         amount,
         'RECEIPT' AS doc_type
       FROM receipts
       WHERE company_id=?`,
      [companyId]
    );

    const [paymentRows] = await conn.query(
      `SELECT
         id,
         payment_date AS txn_date,
         payment_no AS doc_no,
         reference_no,
         remarks AS narration,
         amount,
         'PAYMENT' AS doc_type
       FROM payments
       WHERE company_id=?`,
      [companyId]
    );

    const [settlementRows] = await conn.query(
      `SELECT
         id,
         settlement_date AS txn_date,
         settlement_no AS doc_no,
         reference_no,
         remarks AS narration,
         amount,
         'SETTLEMENT' AS doc_type
       FROM settlements
       WHERE company_id=?`,
      [companyId]
    );

    const [voucherRows] = await conn.query(
      `SELECT
         id,
         voucher_date AS txn_date,
         voucher_no AS doc_no,
         narration,
         0 AS amount,
         'VOUCHER' AS doc_type
       FROM voucher_header
       WHERE company_id=?`,
      [companyId]
    );

    const candidates = [
      ...receiptRows.map((x) => ({ ...x, matched_type: "RECEIPT" })),
      ...paymentRows.map((x) => ({ ...x, matched_type: "PAYMENT" })),
      ...settlementRows.map((x) => ({ ...x, matched_type: "SETTLEMENT" })),
      ...voucherRows.map((x) => ({ ...x, matched_type: "VOUCHER" })),
    ];

    await conn.query(
      `DELETE FROM bank_reconciliation_results
       WHERE company_id=? AND bank_statement_line_id IN (
         SELECT id FROM bank_statement_lines WHERE import_id=?
       )`,
      [companyId, importId]
    );

    let matchedCount = 0;

    for (const stmt of stmtRows) {
      let best = null;
      let bestScore = 0;

      for (const cand of candidates) {
        const score = scoreBankMatch(stmt, cand);
        if (score > bestScore) {
          bestScore = score;
          best = cand;
        }
      }

      if (best && bestScore >= 60) {
        await conn.query(
          `INSERT INTO bank_reconciliation_results
           (company_id, bank_statement_line_id, matched_type, matched_id, confidence, notes)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            companyId,
            stmt.id,
            best.matched_type,
            best.id,
            Number(bestScore.toFixed(2)),
            "AI suggested match",
          ]
        );

        await conn.query(
          `UPDATE bank_statement_lines
           SET matched_type=?, matched_id=?, match_confidence=?, reconciliation_status=?
           WHERE id=?`,
          [
            best.matched_type,
            best.id,
            Number(bestScore.toFixed(2)),
            bestScore >= 80 ? "MATCHED" : "SUGGESTED",
            stmt.id,
          ]
        );

        matchedCount++;
      } else {
        await conn.query(
          `UPDATE bank_statement_lines
           SET matched_type='NONE', matched_id=NULL, match_confidence=0, reconciliation_status='UNMATCHED'
           WHERE id=?`,
          [stmt.id]
        );
      }
    }

    await conn.query(
      `UPDATE bank_statement_imports
       SET status='MATCHED'
       WHERE id=?`,
      [importId]
    );

    await conn.commit();

    res.json({
      message: "Bank AI matching completed ✅",
      import_id: importId,
      matched_count: matchedCount,
      total_rows: stmtRows.length,
    });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({
      message: "Failed to run bank AI matching",
      error: error.message,
    });
  } finally {
    conn.release();
  }
});
app.get("/api/bank-ai/import/:importId", auth, async (req, res) => {
  try {
    const companyId = req.user.active_company_id || req.user.company_id;
    const importId = Number(req.params.importId);

    const [importRows] = await pool.query(
      `SELECT * FROM bank_statement_imports
       WHERE company_id=? AND id=?`,
      [companyId, importId]
    );

    if (!importRows.length) {
      return res.status(404).json({ message: "Import not found" });
    }

    const [lineRows] = await pool.query(
      `SELECT *
       FROM bank_statement_lines
       WHERE import_id=?
       ORDER BY txn_date ASC, id ASC`,
      [importId]
    );

    res.json({
      header: importRows[0],
      lines: lineRows,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to load bank import details",
      error: error.message,
    });
  }
});
app.post("/api/bank-ai/confirm-line/:lineId", auth, async (req, res) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const companyId = req.user.active_company_id || req.user.company_id;
    const lineId = Number(req.params.lineId);

    const [lineRows] = await conn.query(
      `SELECT l.*, i.company_id
       FROM bank_statement_lines l
       JOIN bank_statement_imports i ON i.id = l.import_id
       WHERE l.id=? AND i.company_id=?`,
      [lineId, companyId]
    );

    if (!lineRows.length) {
      throw new Error("Bank statement line not found");
    }

    await conn.query(
      `UPDATE bank_statement_lines
       SET reconciliation_status='CONFIRMED'
       WHERE id=?`,
      [lineId]
    );

    await conn.query(
      `UPDATE bank_reconciliation_results
       SET confirmed_by=?, confirmed_at=NOW()
       WHERE bank_statement_line_id=?`,
      [req.user.id, lineId]
    );

    await conn.commit();

    res.json({ message: "Bank line confirmed ✅" });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({
      message: "Failed to confirm bank line",
      error: error.message,
    });
  } finally {
    conn.release();
  }
});
app.post("/api/bank-ai/import", aiUpload.single("document"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "File required" });
    }

    const csv = fs.readFileSync(req.file.path, "utf8");

    const rows = csv.split("\n").slice(1).map(line => {
      const cols = line.split(",");
      return {
        date: cols[0],
        description: cols[1],
        debit: Number(cols[2] || 0),
        credit: Number(cols[3] || 0),
      };
    });

    res.json({
      message: "Imported successfully ✅",
      rows,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/bank-ai/match", async (req, res) => {
  try {
    const { rows } = req.body;

    const results = rows.map(r => {
      let status = "UNMATCHED";

      if (r.description?.toLowerCase().includes("upi")) {
        status = "MATCHED";
      }

      return {
        ...r,
        status,
        confidence: status === "MATCHED" ? 85 : 20,
      };
    });

    res.json({
      message: "AI Matching Done ✅",
      results,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/ai/assistant/chat", auth, async (req, res) => {
  try {
    const message = String(req.body.message || "").trim();
	const lower = message.toLowerCase();
    const history = Array.isArray(req.body.history) ? req.body.history : [];
if (
      lower.includes("top customer") ||
      lower.includes("expense") ||
      lower.includes("receivable") ||
      lower.includes("bank balance")
    ) {
      const axios = require("axios");

      const summary = await axios.post(
        "http://localhost:5000/api/ai/summary",
        { query: message },
        {
          headers: {
            Authorization: req.headers.authorization,
          },
        }
      );

      const data = summary.data;

      if (data.type === "number") {
        return res.json({
          reply: '₹${Number(data.data).toLocaleString("en-IN")}',
        });
      }
// ==============================
    // 1. HIGH-INTENT ACTION COMMANDS
    // ==============================

    if (
      lower.includes("close the period") ||
      lower.includes("close period") ||
      lower.includes("period close") ||
      lower.includes("month close") ||
      lower.includes("month-end close")
    ) {
      return res.json({
        command_type: "navigation",
        route: "/period-close",
        reply: "Opening Period Close.",
      });
    }

    if (
      lower.includes("post purchase invoice") ||
      lower.includes("create purchase invoice") ||
      lower.includes("open purchase invoice")
    ) {
      return res.json({
        command_type: "navigation",
        route: "/purchase-orders",
        reply: "Opening Purchase Orders.",
      });
    }

    if (
      lower.includes("post sales invoice") ||
      lower.includes("create sales invoice") ||
      lower.includes("open sales invoice")
    ) {
      return res.json({
        command_type: "navigation",
        route: "/invoices",
        reply: "Opening Invoices.",
      });
    }

    if (
      lower.includes("post invoice") ||
      lower.includes("can you post invoice")
    ) {
      return res.json({
        command_type: "navigation",
        route: "/invoices",
        reply: "Opening Invoices.",
      });
    }

    // ==============================
    // 2. INVENTORY / STOCK
    // ==============================
    if (
      lower.includes("stock") ||
      lower.includes("inventory") ||
      lower.includes("current stock") ||
      lower.includes("stock summary") ||
      lower.includes("low stock") ||
      lower.includes("out of stock")
    ) {
      if (lower.includes("low stock") || lower.includes("out of stock")) {
        return res.json({
          command_type: "navigation",
          route: "/reports/low-stock",
          reply: "Opening Low Stock report.",
        });
      }

      return res.json({
        command_type: "navigation",
        route: "/reports/stock-summary",
        reply: "Opening Stock Summary.",
      });
    }

    // ==============================
    // 3. BANK AI
    // ==============================
    if (
      lower.includes("bank ai") ||
      lower.includes("reconcile bank") ||
      lower.includes("bank reconciliation")
    ) {
      return res.json({
        command_type: "navigation",
        route: "/bank-ai",
        reply: "Opening AI Bank Reconciliation.",
      });
    }

    // ==============================
    // 4. INVOICE AI
    // ==============================
    if (
      lower.includes("upload invoice") ||
      lower.includes("scan invoice") ||
      lower.includes("supplier from invoice") ||
      lower.includes("customer from invoice") ||
      lower.includes("invoice ai")
    ) {
      return res.json({
        command_type: "navigation",
        route: "/ai-invoice-intake",
        reply: "Opening AI Invoice Intake.",
      });
    }

    // ==============================
    // 5. ERP SUMMARIES
    // ==============================
    if (
      lower.includes("top customer") ||
      lower.includes("top customers") ||
      lower.includes("expense") ||
      lower.includes("expenses") ||
      lower.includes("receivable") ||
      lower.includes("receivables") ||
      lower.includes("overdue") ||
      lower.includes("bank balance")
    ) {
      const axios = require("axios");

      const summary = await axios.post(
        "http://localhost:5000/api/ai/summary",
        { query: message },
        {
          headers: {
            Authorization: req.headers.authorization,
          },
        }
      );

      const data = summary.data;

      if (data.type === "number") {
        return res.json({
          reply: `₹${Number(data.data).toLocaleString("en-IN")}`,
        });
      }

      if (data.type === "table") {
        const text = data.data
          .map((r, i) => {
            return `${i + 1}. ${r.name} - ₹${Number(r.total || r.balance).toLocaleString("en-IN")}`;
          })
          .join("\n");

        return res.json({
          reply: text || "No data found.",
        });
      }

      if (data.type === "text") {
        return res.json({
          reply: data.data || "No summary found.",
        });
      }
    }

    // ==============================
    // 6. GENERAL SCREEN NAVIGATION
    // ==============================
    if (lower.includes("invoice")) {
      return res.json({
        command_type: "navigation",
        route: "/invoices",
        reply: "Opening Invoices.",
      });
    }

    if (lower.includes("voucher")) {
      return res.json({
        command_type: "navigation",
        route: "/vouchers",
        reply: "Opening Vouchers.",
      });
    }

    if (lower.includes("ledger")) {
      return res.json({
        command_type: "navigation",
        route: "/ledger",
        reply: "Opening General Ledger.",
      });
    }

    if (lower.includes("party")) {
      return res.json({
        command_type: "navigation",
        route: "/parties",
        reply: "Opening Party Master.",
      });
    }

    if (lower.includes("account")) {
      return res.json({
        command_type: "navigation",
        route: "/accounts",
        reply: "Opening Chart of Accounts.",
      });
    }

    if (lower.includes("item")) {
      return res.json({
        command_type: "navigation",
        route: "/items",
        reply: "Opening Items.",
      });
    }

    if (lower.includes("approval")) {
      return res.json({
        command_type: "navigation",
        route: "/approvals",
        reply: "Opening Approvals.",
      });
    }

    if (lower.includes("receivable")) {
      return res.json({
        command_type: "navigation",
        route: "/receivables",
        reply: "Opening Receivables.",
      });
    }

    if (lower.includes("payable")) {
      return res.json({
        command_type: "navigation",
        route: "/payables",
        reply: "Opening Payables.",
      });
    }

    // ==============================
    // 7. ACCOUNTING TRANSACTION PARSE
    // only for real transaction text
    // ==============================
    if (
      lower.startsWith("paid ") ||
      lower.startsWith("received ") ||
      lower.startsWith("bought ") ||
      lower.startsWith("sold ") ||
      lower.includes(" by bank") ||
      lower.includes(" by cash")
    ) {
      return res.json({
        command_type: "voucher_parse",
        original_message: message,
        route: "/",
        reply:
          "This looks like an accounting transaction. I’ve prepared it for the Dashboard AI Voucher Assistant.",
      });
    }
app.get("/api/accounts", auth, async (req, res) => {
  try {
    const companyId = req.user.active_company_id || req.user.company_id;

    const [rows] = await pool.query(
      `SELECT
         id,
         company_id,
         account_code,
         account_name,
         account_type,
         parent_id,
         is_group,
         is_active
       FROM accounts
       WHERE company_id=?
       ORDER BY account_code ASC`,
      [companyId]
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({
      message: "Failed to load accounts",
      error: error.message,
    });
  }
});
if (
  lower.includes("show") ||
  lower.includes("top") ||
  lower.includes("list") ||
  lower.includes("how much") ||
  lower.includes("total") ||
  lower.includes("sales") ||
  lower.includes("profit")
) {
  const axios = require("axios");

  const result = await axios.post(
    "http://localhost:5000/api/ai/sql-query",
    { message },
    {
      headers: {
        Authorization: req.headers.authorization,
      },
    }
  );

  const rows = result.data.data || [];

  if (!rows.length) {
    return res.json({ reply: "No data found." });
  }

  const text = rows
    .slice(0, 5)
    .map((r, i) => `${i + 1}. ${Object.values(r).join(" | ")}`)
    .join("\n");

  return res.json({
    reply: text,
  });
}
if (data.type === "table") {
  const text = data.data
    .map((r, i) => {
      return `${i + 1}. ${r.name} - ₹${Number(r.total || r.balance).toLocaleString("en-IN")}`;
    })
    .join("\n");

  return res.json({
    reply: text || "No data found.",
  });
}
    }
    if (!message) {
      return res.status(400).json({ message: "message is required" });
    }


    if (
      lower.includes("upload invoice") ||
      lower.includes("scan invoice") ||
      lower.includes("supplier from invoice") ||
      lower.includes("customer from invoice")
    ) {
      return res.json({
        command_type: "navigation",
        route: "/ai-invoice-intake",
        reply: "Opening AI Invoice Intake so you can upload and scan an invoice.",
      });
    }

    if (
      lower.includes("bank ai") ||
      lower.includes("reconcile bank") ||
      lower.includes("bank reconciliation")
    ) {
      return res.json({
        command_type: "navigation",
        route: "/bank-ai",
        reply: "Opening AI Bank Reconciliation.",
      });
    }
// ==============================
    // 1. INVENTORY / STOCK FIRST
    // ==============================
    if (
      lower.includes("stock") ||
      lower.includes("inventory") ||
      lower.includes("current stock") ||
      lower.includes("stock summary") ||
      lower.includes("low stock") ||
      lower.includes("out of stock")
    ) {
      if (lower.includes("low stock") || lower.includes("out of stock")) {
        return res.json({
          command_type: "navigation",
          route: "/reports/low-stock",
          reply: "Opening Low Stock report.",
        });
      }

      return res.json({
        command_type: "navigation",
        route: "/reports/stock-summary",
        reply: "Opening Stock Summary.",
      });
    }

    // ==============================
    // 2. BANK AI
    // ==============================
    if (
      lower.includes("bank ai") ||
      lower.includes("reconcile bank") ||
      lower.includes("bank reconciliation")
    ) {
      return res.json({
        command_type: "navigation",
        route: "/bank-ai",
        reply: "Opening AI Bank Reconciliation.",
      });
    }

    // ==============================
    // 3. INVOICE AI
    // ==============================
    if (
      lower.includes("upload invoice") ||
      lower.includes("scan invoice") ||
      lower.includes("supplier from invoice") ||
      lower.includes("customer from invoice") ||
      lower.includes("invoice ai")
    ) {
      return res.json({
        command_type: "navigation",
        route: "/ai-invoice-intake",
        reply: "Opening AI Invoice Intake so you can upload and scan an invoice.",
      });
    }

    // ==============================
    // 4. ERP SUMMARIES
    // ==============================
    if (
      lower.includes("top customer") ||
      lower.includes("top customers") ||
      lower.includes("expense") ||
      lower.includes("expenses") ||
      lower.includes("receivable") ||
      lower.includes("receivables") ||
      lower.includes("overdue") ||
      lower.includes("bank balance")
    ) {
      const axios = require("axios");

      const summary = await axios.post(
        "http://localhost:5000/api/ai/summary",
        { query: message },
        {
          headers: {
            Authorization: req.headers.authorization,
          },
        }
      );

      const data = summary.data;

      if (data.type === "number") {
        return res.json({
          reply: `₹${Number(data.data).toLocaleString("en-IN")}`,
        });
      }

      if (data.type === "table") {
        const text = data.data
          .map((r, i) => {
            return `${i + 1}. ${r.name} - ₹${Number(r.total || r.balance).toLocaleString("en-IN")}`;
          })
          .join("\n");

        return res.json({
          reply: text || "No data found.",
        });
      }

      if (data.type === "text") {
        return res.json({
          reply: data.data || "No summary found.",
        });
      }
    }

    // ==============================
    // 5. GENERAL NAVIGATION
    // ==============================
    if (lower.includes("receivable")) {
      return res.json({
        command_type: "navigation",
        route: "/receivables",
        reply: "Opening Receivables.",
      });
    }

    if (lower.includes("payable")) {
      return res.json({
        command_type: "navigation",
        route: "/payables",
        reply: "Opening Payables.",
      });
    }

    if (lower.includes("ledger")) {
      return res.json({
        command_type: "navigation",
        route: "/ledger",
        reply: "Opening General Ledger.",
      });
    }

    if (lower.includes("party")) {
      return res.json({
        command_type: "navigation",
        route: "/parties",
        reply: "Opening Party Master.",
      });
    }

    if (lower.includes("voucher")) {
      return res.json({
        command_type: "navigation",
        route: "/vouchers",
        reply: "Opening Vouchers.",
      });
    }

    if (lower.includes("invoice")) {
      return res.json({
        command_type: "navigation",
        route: "/invoices",
        reply: "Opening Invoices.",
      });
    }

    // ==============================
    // 6. VOUCHER TRANSACTION INTENT
    // keep this AFTER stock/invoice/navigation checks
    // ==============================
    if (
      lower.includes("paid") ||
      lower.includes("received") ||
      lower.includes("rent") ||
      lower.includes("cash") ||
      lower.includes("bank") ||
      lower.includes("purchase") ||
      lower.includes("sale")
    ) {
      return res.json({
        command_type: "voucher_parse",
        original_message: message,
        route: "/",
        reply:
          "This looks like an accounting transaction. I’ve prepared it for the Dashboard AI Voucher Assistant.",
      });
    }
    if (
      lower.includes("paid") ||
      lower.includes("received") ||
      lower.includes("rent") ||
      lower.includes("cash") ||
      lower.includes("bank") ||
      lower.includes("purchase") ||
      lower.includes("sale")
    ) {
      return res.json({
        command_type: "voucher_parse",
        original_message: message,
        route: "/",
        reply:
          "This looks like an accounting transaction. I’ve prepared it for the Dashboard AI Voucher Assistant.",
      });
    }

    if (lower.includes("receivable") || lower.includes("overdue customer")) {
      return res.json({
        command_type: "navigation",
        route: "/receivables",
        reply: "Opening Receivables.",
      });
    }

    if (lower.includes("payable") || lower.includes("vendor due")) {
      return res.json({
        command_type: "navigation",
        route: "/payables",
        reply: "Opening Payables.",
      });
    }

    if (lower.includes("stock")) {
      return res.json({
        command_type: "navigation",
        route: "/reports/stock-summary",
        reply: "Opening Stock Summary.",
      });
    }

    if (lower.includes("ledger")) {
      return res.json({
        command_type: "navigation",
        route: "/ledger",
        reply: "Opening General Ledger.",
      });
    }

    const prompt = `
You are an ERP AI assistant inside accounting software.

The user wants help with ERP tasks, navigation, or accounting explanations.
Respond in short, practical language.

User message:
${message}

Recent chat history:
${JSON.stringify(history.slice(-8))}
`;

    const response = await openai.responses.create({
      model: process.env.AI_MODEL || "gpt-5.4",
      input: prompt,
    });

    const reply = String(response.output_text || "").trim();

    res.json({
      command_type: "chat",
      reply: reply || "I understood your request, but I need more ERP actions connected to complete it.",
    });
  } catch (error) {
    console.error("AI assistant chat error:", error);
    res.status(500).json({
      message: "Failed to process AI assistant request",
      error: error.message,
    });
  }
});
app.post("/api/ai/summary", auth, async (req, res) => {
  try {
    const { query } = req.body;
    const companyId = req.user.active_company_id || req.user.company_id;

    const lower = String(query || "").toLowerCase();

    // 🔹 1. TOP CUSTOMERS
    if (lower.includes("top customer")) {
      const [rows] = await pool.query(
        `SELECT p.name, SUM(v.total_amount) as total
         FROM vouchers v
         JOIN parties p ON p.id = v.party_id
         WHERE v.company_id=?
         GROUP BY v.party_id
         ORDER BY total DESC
         LIMIT 5`,
        [companyId]
      );

      return res.json({ type: "table", data: rows });
    }

    // 🔹 2. TOTAL EXPENSE THIS MONTH
    if (lower.includes("expense")) {
      const [rows] = await pool.query(
        `SELECT SUM(amount) as total
         FROM payments
         WHERE company_id=? 
         AND MONTH(payment_date)=MONTH(CURRENT_DATE())
         AND YEAR(payment_date)=YEAR(CURRENT_DATE())`,
        [companyId]
      );

      return res.json({ type: "number", data: rows[0].total || 0 });
    }

    // 🔹 3. RECEIVABLES
    if (lower.includes("receivable") || lower.includes("overdue")) {
      const [rows] = await pool.query(
        `SELECT p.name, SUM(i.balance) as balance
         FROM invoices i
         JOIN parties p ON p.id = i.party_id
         WHERE i.company_id=? AND i.balance > 0
         GROUP BY i.party_id
         ORDER BY balance DESC
         LIMIT 5`,
        [companyId]
      );

      return res.json({ type: "table", data: rows });
    }

    // 🔹 4. BANK BALANCE
    if (lower.includes("bank balance")) {
      const [rows] = await pool.query(
        `SELECT SUM(balance) as total FROM bank_accounts WHERE company_id=?`,
        [companyId]
      );

      return res.json({ type: "number", data: rows[0].total || 0 });
    }

    // 🔹 DEFAULT
    return res.json({
      type: "text",
      data: "I need more ERP logic connected to answer this.",
    });

  } catch (error) {
    res.status(500).json({
      message: "AI summary error",
      error: error.message,
    });
  }
});
app.post("/api/ai/sql-query", auth, async (req, res) => {
  try {
    const { message } = req.body;
    const companyId = req.user.active_company_id || req.user.company_id;

    const schema = `
Tables:
- vouchers(id, company_id, voucher_date, total_amount)
- parties(id, name)
- invoices(id, company_id, party_id, total, balance)
- payments(id, company_id, amount, payment_date)
- receipts(id, company_id, amount, receipt_date)

Rules:
- Always filter by company_id = ${companyId}
- Return SELECT query only
- No DELETE/UPDATE
`;

    const prompt = `
Convert this user request into SQL query.

User:
${message}

${schema}
`;

    const response = await openai.responses.create({
      model: process.env.AI_MODEL || "gpt-5.4",
      input: prompt,
    });

    let sql = String(response.output_text || "").trim();

    // safety check
    if (!sql.toLowerCase().startsWith("select")) {
      return res.json({ error: "Only SELECT allowed" });
    }

    const [rows] = await pool.query(sql);

    res.json({
      sql,
      data: rows,
    });

  } catch (error) {
    res.status(500).json({
      message: "SQL AI failed",
      error: error.message,
    });
  }
});
app.post("/api/search/internal", auth, async (req, res) => {
  try {
    const companyId = req.user.active_company_id || req.user.company_id;
    const query = String(req.body.query || "").trim();

    if (!query) {
      return res.json({ message: "Search query is required" });
    }

    const like = `%${query}%`;

    const [voucherRows] = await pool.query(
      `SELECT id, voucher_no
       FROM voucher_header
       WHERE company_id=? AND voucher_no LIKE ?
       LIMIT 5`,
      [companyId, like]
    );

    if (voucherRows.length) {
      return res.json({
        route: `/vouchers/${voucherRows[0].id}`,
        message: `Found voucher ${voucherRows[0].voucher_no}`,
      });
    }

    const [invoiceRows] = await pool.query(
      `SELECT id, invoice_no
       FROM invoices
       WHERE company_id=? AND invoice_no LIKE ?
       LIMIT 5`,
      [companyId, like]
    );

    if (invoiceRows.length) {
      return res.json({
        route: `/invoices/${invoiceRows[0].id}`,
        message: `Found invoice ${invoiceRows[0].invoice_no}`,
      });
    }

    const [partyRows] = await pool.query(
      `SELECT id, party_name
       FROM parties
       WHERE company_id=? AND party_name LIKE ?
       LIMIT 5`,
      [companyId, like]
    );

    if (partyRows.length) {
      return res.json({
        route: "/parties",
        message: `Found party ${partyRows[0].party_name}`,
      });
    }

    const [itemRows] = await pool.query(
      `SELECT id, item_name
       FROM items
       WHERE company_id=? AND item_name LIKE ?
       LIMIT 5`,
      [companyId, like]
    );

    if (itemRows.length) {
      return res.json({
        route: "/items",
        message: `Found item ${itemRows[0].item_name}`,
      });
    }

    return res.json({ message: "No matching record found" });
  } catch (error) {
    res.status(500).json({
      message: "Internal search failed",
      error: error.message,
    });
  }
});

/* ----------------------------- ERROR / START ----------------------------- */

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Running on port ${PORT}`));