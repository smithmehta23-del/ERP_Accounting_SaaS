<<<<<<< Updated upstream
// API configuration
const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export const fetchData = async () => {
    const response = await fetch(`${apiUrl}/data`);
    return response.json();
};

export const postData = async (data) => {
    const response = await fetch(`${apiUrl}/data`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
    return response.json();
};
=======
import axios from "axios";
import { getToken, clearAuth } from "./auth";

const API = axios.create({
  baseURL: "http://localhost:5000/api",
});

API.interceptors.request.use(
  (config) => {
    const token = getToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearAuth();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default API;
>>>>>>> Stashed changes
