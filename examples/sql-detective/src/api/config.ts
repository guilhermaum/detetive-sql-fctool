import axios from "axios";

const urlDev = "http://localhost:3000";
const urlProd = "https://sql-detective-api.vercel.app";

const baseURL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? urlDev : urlProd);
const api = axios.create({ baseURL, timeout: 10000 });

function requestLabel(config: { method?: string; baseURL?: string; url?: string }): string {
  const method = config.method?.toUpperCase() ?? "UNKNOWN";
  return `${method} ${config.baseURL ?? ""}${config.url ?? ""}`;
}

api.interceptors.request.use((config) => {
  if (import.meta.env.DEV) {
    console.groupCollapsed(`[Detetive SQL API] ${requestLabel(config)}`);
    if (config.params !== undefined) {
      console.log("Query params:", config.params);
    }
    if (config.data !== undefined) {
      console.log("Request payload:", config.data);
    }
    console.groupEnd();
  }

  return config;
});

api.interceptors.response.use(
  (response) => {
    if (import.meta.env.DEV) {
      console.groupCollapsed(
        `[Detetive SQL API] ${requestLabel(response.config)} -> ${response.status}`,
      );
      console.log("Response payload:", response.data);
      console.groupEnd();
    }

    return response;
  },
  (error: unknown) => {
    if (import.meta.env.DEV) {
      const apiError = error as {
        config?: { method?: string; baseURL?: string; url?: string; params?: unknown; data?: unknown };
        response?: { status?: number; data?: unknown };
        message?: string;
      };
      const config = apiError.config;
      console.groupCollapsed(
        `[Detetive SQL API] ${requestLabel(config ?? {})} -> ${apiError.response?.status ?? "ERROR"}`,
      );
      if (config?.params !== undefined) {
        console.log("Query params:", config.params);
      }
      if (config?.data !== undefined) {
        console.log("Request payload:", config.data);
      }
      if (apiError.response?.data !== undefined) {
        console.log("Error response payload:", apiError.response.data);
      } else {
        console.error(apiError.message ?? error);
      }
      console.groupEnd();
    }

    return Promise.reject(error);
  },
);

export default api;
