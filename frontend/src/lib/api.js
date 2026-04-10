import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5001/api",
  withCredentials: true,
});

export const authApi = {
  register: (payload) => api.post("/auth/register", payload),
  login: (payload) => api.post("/auth/login", payload),
  forgotPassword: (payload) => api.post("/auth/forgot-password", payload),
  logout: () => api.post("/auth/logout"),
  me: () => api.get("/auth/me"),
  updateAvatar: (payload) => api.post("/auth/avatar", payload),
  changePassword: (payload) => api.post("/auth/change-password", payload),
  resetPassword: (token, payload) => api.post(`/auth/reset-password/${token}`, payload),
};

export default api;
