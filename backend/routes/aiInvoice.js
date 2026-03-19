const express = require("express");
const multer = require("multer");
const OpenAI = require("openai");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// MOCK DB (replace later with real DB if needed)
let parties = [];

router.post("/scan-invoice", upload.single("file"), async (req, res) => {
  try {
    const extractedText = `
    ABC Traders
    GST: 27ABCDE1234F1Z5
    Invoice No: 123
    Date: 18-03-2026
    Total: 25000
    Item: Steel Material
    `;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
Extract structured invoice data as JSON:
{
  "supplier_name": "",
  "gst": "",
  "invoice_number": "",
  "date": "",
  "total_amount": 0,
  "items": [{ "name": "", "amount": 0 }]
}
`,
        },
        { role: "user", content: extractedText },
      ],
    });

    const content = response.choices[0].message.content;

    let data;
    try {
      data = JSON.parse(content);
    } catch (e) {
      return res.status(400).json({ error: "AI parsing failed", raw: content });
    }

    let supplier = parties.find(
      (p) => p.gst === data.gst || p.name === data.supplier_name
    );

    if (!supplier) {
      supplier = {
        id: parties.length + 1,
        name: data.supplier_name,
        gst: data.gst,
      };
      parties.push(supplier);
    }

    const voucher = {
      narration: `Purchase from ${supplier.name}`,
      amount: data.total_amount,
      supplier_id: supplier.id,
    };

    res.json({
      supplier,
      invoice: data,
      voucher,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Invoice AI failed" });
  }
});

module.exports = router;