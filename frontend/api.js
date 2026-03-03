const API_BASE = process.env.REACT_APP_API_BASE || "/api";

export const apiPost = async (url, data) => {
  const response = await fetch(`${API_BASE}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return response.json();
};

export const apiGet = async (url) => {
  const response = await fetch(`${API_BASE}${url}`);
  return response.json();
};
