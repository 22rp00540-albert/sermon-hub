import axios from "axios";

const envApiBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
const fallbackApiBaseUrl =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:5000/api/v1`
    : "http://localhost:5000/api/v1";

export const API_BASE_URL = (envApiBaseUrl || fallbackApiBaseUrl).replace(/\/+$/, "");

/** Must match `TOKEN_KEY` in `AuthContext.tsx` — used so the first API call has a Bearer before React effects run. */
const AUTH_TOKEN_STORAGE_KEY = "sermon_token";

export const api = axios.create({
  baseURL: API_BASE_URL,
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
