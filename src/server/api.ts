import { storageAuthTokenGet } from "@/storage/auth-token";
import { AppError } from "@/utils/app-error";
import axios, { AxiosError, AxiosInstance } from "axios";

type SignOut = () => void;

type APIInstanceProps = AxiosInstance & {
  registerInterceptTokenManager: (signOut: SignOut) => () => void;
};

const api = axios.create({
  baseURL: "https://overscented-loamless-etha.ngrok-free.dev",
}) as APIInstanceProps;

api.interceptors.request.use(
  async (config) => {
    const { token } = await storageAuthTokenGet();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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
      if (requestError.response?.status === 401) {
        signOut();
        return Promise.reject(requestError);
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
