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
  updateProfile: (payload) => api.patch("/auth/profile", payload),
  updateAvatar: (payload) => api.post("/auth/avatar", payload),
  changePassword: (payload) => api.post("/auth/change-password", payload),
  resetPassword: (token, payload) => api.post(`/auth/reset-password/${token}`, payload),
};

export const testsApi = {
  startSession: () => api.get("/tests/session"),
  submitSession: (payload) => api.post("/tests/submit", payload),
  getBank: () => api.get("/tests/bank"),
  getStudents: () => api.get("/tests/admin/students"),
  createQuestion: (payload) => api.post("/tests/bank", payload),
  importQuestionsFromCsv: (csvText) => api.post("/tests/bank/import", { csvText }),
  updateQuestion: (questionId, payload) => api.put(`/tests/bank/${questionId}`, payload),
  deleteQuestions: (ids) => api.delete("/tests/bank", { data: { ids } }),
  deleteQuestion: (questionId) => api.delete(`/tests/bank/${questionId}`),
};

export default api;
