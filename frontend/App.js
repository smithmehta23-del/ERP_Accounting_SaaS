import React from "react";
import "./App.css";
import Invoice from "./Invoice";

function App() {
  return (
    <div style={{ fontFamily: "Arial", minHeight: "100vh", background: "#f1f5f9" }}>
      <div style={{
        backgroundColor: "#1e293b",
        color: "white",
        padding: "15px 20px",
        fontSize: "20px"
      }}>
        ERP Accounting System
      </div>

      <Invoice />
    </div>
  );
}

export default App;
