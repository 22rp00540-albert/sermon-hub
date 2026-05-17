import axios from "axios";

const normalizeBase = (url: string) => url.replace(/\/+$/, "");

/** Resolve API base: env var → same host in production → localhost:5000 in dev. */
export const resolveApiBaseUrl = (): string => {
  const fromEnv = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (fromEnv?.trim()) return normalizeBase(fromEnv.trim());

  if (typeof window !== "undefined") {
    const { protocol, hostname, port } = window.location;
    const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
    if (isLocal) {
      return normalizeBase(`${protocol}//${hostname}:5000/api/v1`);
    }
    // Render / production: API on same origin (Express serves /api/v1 + static client)
    const host = port ? `${hostname}:${port}` : hostname;
    return normalizeBase(`${protocol}//${host}/api/v1`);
  }

  return "http://localhost:5000/api/v1";
};

export const API_BASE_URL = resolveApiBaseUrl();

/** Must match `TOKEN_KEY` in `AuthContext.tsx` — used so the first API call has a Bearer before React effects run. */
const AUTH_TOKEN_STORAGE_KEY = "sermon_token";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 600_000,
});

if (typeof window !== "undefined") {
  const stored = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  if (stored) {
    api.defaults.headers.common.Authorization = `Bearer ${stored}`;
  }
}

export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};
