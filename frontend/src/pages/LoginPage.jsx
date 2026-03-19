import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import API from "../api";
import { isLoggedIn, saveAuth } from "../auth";

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "#f8fafc",
    fontFamily: "Arial, sans-serif",
  },
  card: {
    width: 420,
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    padding: 28,
    boxShadow: "0 8px 30px rgba(15,23,42,0.08)",
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    marginBottom: 8,
  },
  sub: {
    color: "#64748b",
    marginBottom: 20,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginBottom: 14,
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
    outline: "none",
  },
  btn: {
    width: "100%",
    background: "#0f172a",
    color: "#fff",
    border: "none",
    borderRadius: 14,
    padding: "12px 16px",
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 8,
  },
  error: {
    color: "#991b1b",
    background: "#fee2e2",
    border: "1px solid #fecaca",
    borderRadius: 12,
    padding: "10px 12px",
    fontSize: 14,
    marginBottom: 14,
  },
};

function LoginPage() {
  const [email, setEmail] = useState("admin@demo.com");
  const [password, setPassword] = useState("Admin@123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isLoggedIn()) {
    return <Navigate to="/" replace />;
  }

  const login = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError("");

      const res = await API.post("/login", { email, password });
      saveAuth(res.data.token, res.data.user);
      window.location.href = "/";
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Login failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <form style={styles.card} onSubmit={login}>
        <div style={styles.title}>ERP Accounting Login</div>
        <div style={styles.sub}>
          Sign in to access finance operations and approvals.
        </div>

        {error ? <div style={styles.error}>{error}</div> : null}

        <div style={styles.field}>
          <label style={styles.label}>Email</label>
          <input
            style={styles.input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Password</label>
          <input
            style={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button style={styles.btn} type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Login"}
        </button>
      </form>
    </div>
  );
}

export default LoginPage;