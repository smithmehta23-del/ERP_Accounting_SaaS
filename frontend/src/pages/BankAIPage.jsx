import React, { useState } from "react";
import axios from "axios";

function BankAIPage() {
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [results, setResults] = useState([]);

  const uploadFile = async () => {
    const form = new FormData();
    form.append("document", file);

    const res = await axios.post("http://localhost:5000/api/bank-ai/import", form);
    setRows(res.data.rows);
  };

  const runAI = async () => {
    const res = await axios.post("http://localhost:5000/api/bank-ai/match", { rows });
    setResults(res.data.results);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>AI Bank Reconciliation</h2>

      <input type="file" onChange={(e) => setFile(e.target.files[0])} />

      <br /><br />

      <button onClick={uploadFile}>Upload</button>
      <button onClick={runAI}>Run AI</button>

      <hr />

      {results.map((r, i) => (
        <div key={i}>
          {r.date} | {r.description} | ₹{r.debit || r.credit}
          👉 {r.status} ({r.confidence}%)
        </div>
      ))}
    </div>
  );
}

export default BankAIPage;