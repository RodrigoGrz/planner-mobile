import { storageAuthTokenGet } from "@/storage/auth-token";
import { AppError } from "@/utils/app-error";
import axios, { AxiosError, AxiosInstance } from "axios";

type SignOut = () => void;

type APIInstanceProps = AxiosInstance & {
  registerInterceptTokenManager: (signOut: SignOut) => () => void;
};

const api = axios.create({
  baseURL: "https://trichitic-presley-cloisterlike.ngrok-free.dev",
}) as APIInstanceProps;

const AUTH_PATHS = ["/travelers/auth", "/travelers/register"];

function isAuthRequest(url?: string) {
  return AUTH_PATHS.some((path) => url?.includes(path));
}

api.interceptors.request.use(
  async (config) => {
    try {
      const { token } = await storageAuthTokenGet();

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Ignore storage read errors so auth requests can still proceed.
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

api.registerInterceptTokenManager = (signOut) => {
  const interceptTokenManager = api.interceptors.response.use(
    (response) => response,
    async (requestError: AxiosError<any>) => {
      const requestUrl = requestError.config?.url;

      if (
        requestError.response?.status === 401 &&
        !isAuthRequest(requestUrl)
      ) {
        signOut();
      }

      if (requestError.response?.data?.message) {
        return Promise.reject(new AppError(requestError.response.data.message));
      }

      return Promise.reject(requestError);
    },
  );

  return () => {
    api.interceptors.response.eject(interceptTokenManager);
  };
};

export { api };
