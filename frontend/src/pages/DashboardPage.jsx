import React from "react";
import Dashboard from "../Dashboard";
import AIVoucherWidget from "../components/AIVoucherWidget";

function DashboardPage() {
  return (
    <div>
      <Dashboard />
      <div style={{ marginTop: 24 }}>
        <AIVoucherWidget />
      </div>
    </div>
  );
}

export default DashboardPage;