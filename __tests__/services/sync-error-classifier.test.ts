import { classifySyncError } from "@/services/sync-error-classifier";
import { AppError } from "@/utils/app-error";

describe("sync-error-classifier", () => {
  it("should classify a 401 as auth", () => {
    const result = classifySyncError(
      new AppError("Token inválido", { status: 401 }),
    );

    expect(result).toMatchObject({ kind: "auth", status: 401 });
  });

  it.each([400, 415, 422])(
    "should classify a %i as permanent with the api message",
    (status) => {
      const result = classifySyncError(
        new AppError("Data de início inválida.", { status }),
      );

      expect(result).toEqual({
        kind: "permanent",
        status,
        message: "Data de início inválida.",
      });
    },
  );

  it("should use the field validation message for a 400 with field errors", () => {
    const result = classifySyncError(
      new AppError("Validation error", {
        status: 400,
        fieldErrors: { destination: ["Too short"] },
      }),
    );

    expect(result).toEqual({
      kind: "permanent",
      status: 400,
      message: "Verifique os campos: destino.",
    });
  });

  it("should use the file too large message for a 413", () => {
    const result = classifySyncError(
      new AppError("request file too large", { status: 413 }),
    );

    expect(result).toEqual({
      kind: "permanent",
      status: 413,
      message: "A imagem é grande demais.",
    });
  });

  it("should classify a 403 as permanent with the permission message", () => {
    const result = classifySyncError(
      new AppError("Não permitido", { status: 403 }),
    );

    expect(result).toEqual({
      kind: "permanent",
      status: 403,
      message: "Você não tem permissão para alterar esta viagem.",
    });
  });

  it("should classify an unlisted 4xx as permanent", () => {
    const result = classifySyncError(
      new AppError("Versão da viagem desatualizada", { status: 412 }),
    );

    expect(result).toEqual({
      kind: "permanent",
      status: 412,
      message: "Versão da viagem desatualizada",
    });
  });

  it("should classify a 404 as not_found", () => {
    const result = classifySyncError(
      new AppError("Recurso não encontrado.", { status: 404 }),
    );

    expect(result).toEqual({
      kind: "not_found",
      status: 404,
      message: "Recurso não encontrado.",
    });
  });

  it("should classify a 429 as rate_limited with the retry-after delay", () => {
    const result = classifySyncError(
      new AppError("Too many requests", { status: 429, retryAfterMs: 30000 }),
    );

    expect(result).toEqual({
      kind: "rate_limited",
      status: 429,
      message: "Muitas requisições, tentando novamente em instantes.",
      retryAfterMs: 30000,
    });
  });

  it("should classify a 429 without retry-after as rate_limited without delay", () => {
    const result = classifySyncError(
      new AppError("Too many requests", { status: 429 }),
    );

    expect(result.kind).toBe("rate_limited");
    expect(result.retryAfterMs).toBeUndefined();
  });

  it("should classify a 409 as retryable with the api message", () => {
    const result = classifySyncError(
      new AppError("A viagem foi alterada por outra requisição", {
        status: 409,
      }),
    );

    expect(result).toEqual({
      kind: "retryable",
      status: 409,
      message: "A viagem foi alterada por outra requisição",
    });
  });

  it.each([500, 502, 503])(
    "should classify a %i as retryable with the server message",
    (status) => {
      const result = classifySyncError(
        new AppError("Internal server error", { status }),
      );

      expect(result).toEqual({
        kind: "retryable",
        status,
        message: "Algo deu errado no servidor. Tente novamente em instantes.",
      });
    },
  );

  it("should classify a network error as retryable with the network message", () => {
    const result = classifySyncError(
      new AppError("Sem conexão com o servidor.", { code: "NETWORK" }),
    );

    expect(result).toEqual({
      kind: "retryable",
      message:
        "Sem conexão com o servidor. Verifique sua internet e tente novamente.",
    });
  });

  it("should classify an unknown error as retryable with the sync failed message", () => {
    const result = classifySyncError(new Error("SQLITE_BUSY"));

    expect(result).toEqual({
      kind: "retryable",
      message: "Não foi possível sincronizar uma alteração.",
    });
  });
});
