import { api, dataOf } from "./api";

export async function getCurrentUser() {
  const payload = await api.get("/api/auth/me");
  return dataOf(payload).user;
}

export async function getCsrfToken() {
  const payload = await api.get("/api/auth/csrf");
  return dataOf(payload).csrf_token;
}

export async function loginRequest(email, password) {
  const payload = await api.post("/api/auth/login", { email, password });
  const user = dataOf(payload).user;
  const csrfToken = await getCsrfToken();
  return { user, csrfToken };
}

export async function logoutRequest(csrfToken) {
  return api.post("/api/auth/logout", {}, { "X-CSRF-Token": csrfToken });
}

export async function registerRequest(form) {
  return api.post("/api/auth/register", form);
}