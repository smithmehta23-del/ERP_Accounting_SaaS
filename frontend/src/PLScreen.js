import React, { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import { apiGet } from "./api";

function PLScreen() {
  const [data, setData] = useState([]);

  useEffect(() => {
    apiGet("/pl_data").then(res => setData(res));
  }, []);

  const chartData = {
    labels: data.map(item => item.month),
    datasets: [
      {
        label: "Profit/Loss",
        data: data.map(item => item.amount),
      },
    ],
  };

  return (
    <div>
      <h2>Profit & Loss</h2>
      <Bar data={chartData} />
    </div>
  );
}

export default PLScreen;
