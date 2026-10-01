import { storageAuthTokenGet } from "@/storage/auth-token";
import { AppError } from "@/utils/app-error";
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

const AUTH_PATHS = ["/travelers/auth", "/travelers/register"];

function isAuthRequest(url?: string) {
  return AUTH_PATHS.some((path) => url?.includes(path));
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
    cause: requestError,
  });
}

api.interceptors.response.use(
  (response) => response,
  (requestError: AxiosError) => {
    if (
      requestError.response?.status === 401 &&
      !isAuthRequest(requestError.config?.url)
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
