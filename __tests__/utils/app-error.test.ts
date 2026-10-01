import { AppError, getErrorStatus } from "@/utils/app-error";

describe("AppError", () => {
  it("should be an instance of Error with the AppError name", () => {
    const error = new AppError("Viagem não encontrada");

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error.name).toBe("AppError");
    expect(error.message).toBe("Viagem não encontrada");
  });

  it("should keep status, code and cause", () => {
    const cause = new Error("original");

    const error = new AppError("Sem conexão com o servidor.", {
      status: 503,
      code: "NETWORK",
      cause,
    });

    expect(error.status).toBe(503);
    expect(error.code).toBe("NETWORK");
    expect(error.cause).toBe(cause);
  });
});

describe("getErrorStatus", () => {
  it("should read the status from an AppError", () => {
    expect(getErrorStatus(new AppError("Conflito", { status: 409 }))).toBe(409);
  });

  it("should read the status from an axios-like error", () => {
    expect(getErrorStatus({ response: { status: 401 } })).toBe(401);
  });

  it("should return undefined when the error has no status", () => {
    expect(getErrorStatus(new Error("boom"))).toBeUndefined();
    expect(getErrorStatus(new AppError("Sem conexão", { code: "NETWORK" }))).toBeUndefined();
    expect(getErrorStatus(null)).toBeUndefined();
    expect(getErrorStatus("erro")).toBeUndefined();
  });
});
