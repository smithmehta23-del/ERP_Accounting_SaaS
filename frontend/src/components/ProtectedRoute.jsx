import React from "react";
import { Navigate } from "react-router-dom";
import { getUser, isLoggedIn } from "../auth";

function ProtectedRoute({ children, roles = [] }) {
  if (!isLoggedIn()) {
    return <Navigate to="/login" replace />;
  }

  if (roles.length > 0) {
    const user = getUser();
    const role = String(user?.role || "").toUpperCase();
    if (!roles.includes(role)) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
}

export default ProtectedRoute;