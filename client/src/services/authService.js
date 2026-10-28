import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

export const login = (email, password) =>
  api.post("/auth/login", { email, password });

export const getMe = () => api.get("/auth/me");

export const logout = () => api.post("/auth/logout");
