import { routes } from "@/server/routes";
import { storageAuthTokenGet } from "@/storage/auth-token";
import { AppError, FieldErrors } from "@/utils/app-error";
import axios, { AxiosError, AxiosInstance } from "axios";

type SignOut = () => void;

type APIInstanceProps = AxiosInstance & {
  registerInterceptTokenManager: (signOut: SignOut) => () => void;
};

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  "https://trichitic-presley-cloisterlike.ngrok-free.dev";

const api = axios.create({
  baseURL: API_URL,
}) as APIInstanceProps;

const AUTH_ROUTES = [
  { method: "post", url: routes.sessions() },
  { method: "post", url: routes.travelers() },
];

function isAuthRequest(config?: { method?: string; url?: string }) {
  return AUTH_ROUTES.some(
    (route) =>
      route.method === config?.method?.toLowerCase() && route.url === config?.url,
  );
}

const MISSING_ROUTE_MESSAGE = /^Route [A-Z]+:\S+ not found$/;

function isMissingRoute(status: number, data: unknown) {
  if (status !== 404 || typeof data !== "object" || data === null) {
    return false;
  }

  const { error, message } = data as { error?: unknown; message?: unknown };

  return (
    error === "Not Found" &&
    typeof message === "string" &&
    MISSING_ROUTE_MESSAGE.test(message)
  );
}

async function readStoredToken() {
  try {
    const { token } = await storageAuthTokenGet();
    return token;
  } catch {
    return null;
  }
}

api.interceptors.request.use(
  async (config) => {
    const token = await readStoredToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

const NETWORK_ERROR_MESSAGE = "Sem conexão com o servidor.";

let unauthorizedHandler: SignOut | null = null;

function readApiMessage(data: unknown) {
  if (typeof data !== "object" || data === null || !("message" in data)) {
    return null;
  }

  const { message } = data as { message: unknown };

  return typeof message === "string" && message.length > 0 ? message : null;
}

function readFieldErrors(data: unknown): FieldErrors | undefined {
  if (typeof data !== "object" || data === null || !("errors" in data)) {
    return undefined;
  }

  const { errors } = data as { errors: unknown };

  if (typeof errors !== "object" || errors === null || Array.isArray(errors)) {
    return undefined;
  }

  return errors as FieldErrors;
}

function parseRetryAfter(value: unknown, now = Date.now()) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  if (/^\d+$/.test(value.trim())) {
    return Number(value.trim()) * 1000;
  }

  const retryAt = Date.parse(value);

  if (Number.isNaN(retryAt)) {
    return undefined;
  }

  return Math.max(retryAt - now, 0);
}

function toAppError(requestError: AxiosError) {
  const { response } = requestError;

  if (!response) {
    return new AppError(NETWORK_ERROR_MESSAGE, {
      code: "NETWORK",
      cause: requestError,
    });
  }

  return new AppError(readApiMessage(response.data) ?? requestError.message, {
    status: response.status,
    code: isMissingRoute(response.status, response.data)
      ? "ROUTE_NOT_FOUND"
      : undefined,
    cause: requestError,
    fieldErrors:
      response.status === 400 ? readFieldErrors(response.data) : undefined,
    retryAfterMs:
      response.status === 429
        ? parseRetryAfter(response.headers?.["retry-after"])
        : undefined,
  });
}

api.interceptors.response.use(
  (response) => response,
  (requestError: AxiosError) => {
    if (
      requestError.response?.status === 401 &&
      !isAuthRequest(requestError.config)
    ) {
      unauthorizedHandler?.();
    }

    return Promise.reject(toAppError(requestError));
  },
);

api.registerInterceptTokenManager = (signOut) => {
  unauthorizedHandler = signOut;

  return () => {
    if (unauthorizedHandler === signOut) {
      unauthorizedHandler = null;
    }
  };
};

export { api };
