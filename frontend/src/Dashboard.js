import axios from "axios";
import { useEffect, useState } from "react";

function Dashboard() {
  const [data, setData] = useState({});

  useEffect(() => {
    axios.get("http://localhost:5000/api/dashboard", {
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token")
      }
    })
    .then(res => setData(res.data))
    .catch(() => window.location.href = "/");
  }, []);

  const logout = () => {
    localStorage.clear();
    window.location.href = "/";
  };

  return (
    <div>
      <h1>{data.message}</h1>
      <h3>Role: {data.role}</h3>
      <p>Live Users: {data.liveUsers}</p>
      <p>Active Sessions: {data.activeSessions}</p>

      <button onClick={logout}>Logout</button>
    </div>
  );
}

export default Dashboard;
