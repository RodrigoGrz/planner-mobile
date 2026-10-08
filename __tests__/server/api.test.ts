import { api } from "@/server/api";
import { AppError } from "@/utils/app-error";
import { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios";

jest.mock("@/storage/auth-token", () => ({
  storageAuthTokenGet: jest.fn(() => Promise.resolve({ token: null })),
}));

const mockAdapter = jest.fn();

function failWithResponse(
  status: number,
  data: unknown,
  headers: Record<string, string> = {},
) {
  mockAdapter.mockImplementation((config: InternalAxiosRequestConfig) => {
    const response = {
      status,
      statusText: "",
      headers,
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
    jest.restoreAllMocks();
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

  it("should keep field errors on a 400 validation response", async () => {
    failWithResponse(400, {
      message: "Validation error",
      errors: { email: ["Invalid email"], password: ["Too short"] },
    });

    const error = (await captureError(api.post("/travelers/register"))) as AppError;

    expect(error.fieldErrors).toEqual({
      email: ["Invalid email"],
      password: ["Too short"],
    });
  });

  it("should not keep field errors when errors is not an object", async () => {
    failWithResponse(400, { message: "Validation error", errors: "invalid" });

    const error = (await captureError(api.post("/travelers/register"))) as AppError;

    expect(error.fieldErrors).toBeUndefined();
  });

  it("should not keep field errors on non validation statuses", async () => {
    failWithResponse(409, {
      message: "E-mail já cadastrado",
      errors: { email: ["taken"] },
    });

    const error = (await captureError(api.post("/travelers/register"))) as AppError;

    expect(error.fieldErrors).toBeUndefined();
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

    const error = await captureError(api.post("/sessions"));

    expect(signOut).not.toHaveBeenCalled();
    expect(error).toMatchObject({ status: 401, message: "Credenciais incorretas" });
  });

  it("should not sign out on a 401 from the sign up route", async () => {
    const signOut = jest.fn();
    unregister = api.registerInterceptTokenManager(signOut);
    failWithResponse(401, { message: "Não autorizado" });

    await captureError(api.post("/travelers"));

    expect(signOut).not.toHaveBeenCalled();
  });

  it("should sign out on a 401 from a route that only resembles an auth route", async () => {
    const signOut = jest.fn();
    unregister = api.registerInterceptTokenManager(signOut);
    failWithResponse(401, { message: "Não autorizado" });

    await captureError(api.get("/travelers"));
    await captureError(api.get("/sessions/current"));

    expect(signOut).toHaveBeenCalledTimes(2);
  });

  it("should mark a missing route as ROUTE_NOT_FOUND", async () => {
    failWithResponse(404, {
      message: "Route POST:/trips/register not found",
      error: "Not Found",
      statusCode: 404,
    });

    const error = await captureError(api.post("/trips/register"));

    expect(error).toMatchObject({ status: 404, code: "ROUTE_NOT_FOUND" });
  });

  it("should not mark a missing resource as ROUTE_NOT_FOUND", async () => {
    failWithResponse(404, { message: "Recurso não encontrado." });

    const error = (await captureError(api.get("/trips/t1"))) as AppError;

    expect(error.status).toBe(404);
    expect(error.code).toBeUndefined();
  });

  it("should set retryAfterMs from a Retry-After in seconds on a 429", async () => {
    failWithResponse(
      429,
      { message: "Muitas requisições" },
      { "retry-after": "30" },
    );

    const error = (await captureError(api.get("/traveler/trips"))) as AppError;

    expect(error).toMatchObject({ status: 429, retryAfterMs: 30000 });
  });

  it("should set retryAfterMs from a Retry-After http date on a 429", async () => {
    jest
      .spyOn(Date, "now")
      .mockReturnValue(new Date("2026-10-06T12:00:00.000Z").getTime());
    failWithResponse(
      429,
      { message: "Muitas requisições" },
      { "retry-after": "Tue, 06 Oct 2026 12:00:45 GMT" },
    );

    const error = (await captureError(api.get("/traveler/trips"))) as AppError;

    expect(error.retryAfterMs).toBe(45000);
  });

  it("should not set retryAfterMs when Retry-After is missing or invalid", async () => {
    failWithResponse(429, { message: "Muitas requisições" });
    const withoutHeader = (await captureError(
      api.get("/traveler/trips"),
    )) as AppError;

    failWithResponse(
      429,
      { message: "Muitas requisições" },
      { "retry-after": "logo" },
    );
    const withInvalidHeader = (await captureError(
      api.get("/traveler/trips"),
    )) as AppError;

    expect(withoutHeader.retryAfterMs).toBeUndefined();
    expect(withInvalidHeader.retryAfterMs).toBeUndefined();
  });

  it("should not set retryAfterMs on statuses other than 429", async () => {
    failWithResponse(
      503,
      { message: "Service unavailable" },
      { "retry-after": "30" },
    );

    const error = (await captureError(api.get("/traveler/trips"))) as AppError;

    expect(error.retryAfterMs).toBeUndefined();
  });

  it("should not call sign out after the handler is unregistered", async () => {
    const signOut = jest.fn();
    api.registerInterceptTokenManager(signOut)();
    failWithResponse(401, { message: "Token inválido" });

    await captureError(api.get("/traveler/trips"));

    expect(signOut).not.toHaveBeenCalled();
  });
});
