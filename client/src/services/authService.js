import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

export const login = (mobileNumber, password) =>
  api.post("/auth/login", { mobile_number: mobileNumber, password });

export const getMe = () => api.get("/auth/me");

export const logout = () => api.post("/auth/logout");
