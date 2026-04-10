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

export const testsApi = {
  startSession: () => api.get("/tests/session"),
  submitSession: (payload) => api.post("/tests/submit", payload),
  getBank: () => api.get("/tests/bank"),
  createQuestion: (payload) => api.post("/tests/bank", payload),
  updateQuestion: (questionId, payload) => api.put(`/tests/bank/${questionId}`, payload),
  deleteQuestion: (questionId) => api.delete(`/tests/bank/${questionId}`),
};

export default api;
