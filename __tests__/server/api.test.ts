import { api } from "@/server/api";
import { AppError } from "@/utils/app-error";
import { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios";

jest.mock("@/storage/auth-token", () => ({
  storageAuthTokenGet: jest.fn(() => Promise.resolve({ token: null })),
}));

const mockAdapter = jest.fn();

function failWithResponse(status: number, data: unknown) {
  mockAdapter.mockImplementation((config: InternalAxiosRequestConfig) => {
    const response = {
      status,
      statusText: "",
      headers: {},
      config,
      data,
    } as AxiosResponse;

    return Promise.reject(
      new AxiosError(
        `Request failed with status code ${status}`,
        AxiosError.ERR_BAD_RESPONSE,
        config,
        {},
        response,
      ),
    );
  });
}

function failWithoutResponse() {
  mockAdapter.mockImplementation((config: InternalAxiosRequestConfig) =>
    Promise.reject(
      new AxiosError("Network Error", AxiosError.ERR_NETWORK, config, {}),
    ),
  );
}

async function captureError(request: Promise<unknown>) {
  try {
    await request;
  } catch (error) {
    return error;
  }

  throw new Error("Expected the request to fail");
}

describe("api", () => {
  let unregister: (() => void) | undefined;

  beforeAll(() => {
    api.defaults.adapter = mockAdapter;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    unregister?.();
    unregister = undefined;
  });

  it("should reject an AppError with the status and the api message", async () => {
    unregister = api.registerInterceptTokenManager(jest.fn());
    failWithResponse(409, { message: "Viagem em conflito" });

    const error = await captureError(api.put("/trips/t1/update"));

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ status: 409, message: "Viagem em conflito" });
  });

  it("should reject an AppError with the status when the response has no message", async () => {
    unregister = api.registerInterceptTokenManager(jest.fn());
    failWithResponse(502, "");

    const error = await captureError(api.get("/traveler/trips"));

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({
      status: 502,
      message: "Request failed with status code 502",
    });
  });

  it("should not use a non string message from the api", async () => {
    unregister = api.registerInterceptTokenManager(jest.fn());
    failWithResponse(400, { message: { field: "invalid" } });

    const error = await captureError(api.post("/trips/register"));

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({
      status: 400,
      message: "Request failed with status code 400",
    });
  });

  it("should reject a network AppError when there is no response", async () => {
    unregister = api.registerInterceptTokenManager(jest.fn());
    failWithoutResponse();

    const error = await captureError(api.get("/traveler/trips"));

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({
      code: "NETWORK",
      message: "Sem conexão com o servidor.",
      status: undefined,
    });
  });

  it("should keep the original error as cause", async () => {
    unregister = api.registerInterceptTokenManager(jest.fn());
    failWithResponse(500, { message: "Internal server error" });

    const error = (await captureError(api.get("/traveler/trips"))) as AppError;

    expect(error.cause).toBeInstanceOf(AxiosError);
  });

  it("should normalize errors without a registered sign out handler", async () => {
    failWithResponse(404, { message: "Viagem não encontrada" });

    const error = await captureError(api.get("/trips/t1"));

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ status: 404, message: "Viagem não encontrada" });
  });

  it("should call the registered sign out on a 401 outside auth routes", async () => {
    const signOut = jest.fn();
    unregister = api.registerInterceptTokenManager(signOut);
    failWithResponse(401, { message: "Token inválido" });

    await captureError(api.get("/traveler/trips"));

    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("should not sign out on a 401 from the auth route", async () => {
    const signOut = jest.fn();
    unregister = api.registerInterceptTokenManager(signOut);
    failWithResponse(401, { message: "Credenciais incorretas" });

    const error = await captureError(api.post("/travelers/auth"));

    expect(signOut).not.toHaveBeenCalled();
    expect(error).toMatchObject({ status: 401, message: "Credenciais incorretas" });
  });

  it("should not call sign out after the handler is unregistered", async () => {
    const signOut = jest.fn();
    api.registerInterceptTokenManager(signOut)();
    failWithResponse(401, { message: "Token inválido" });

    await captureError(api.get("/traveler/trips"));

    expect(signOut).not.toHaveBeenCalled();
  });
});
