import { AppError } from "@/utils/app-error";
import { getFriendlyErrorMessage } from "@/utils/get-friendly-error-message";

const FALLBACK = "Não foi possível salvar a viagem.";

describe("getFriendlyErrorMessage", () => {
  it("should return the network message when there is no response", () => {
    const error = new AppError("Sem conexão com o servidor.", {
      code: "NETWORK",
    });

    expect(getFriendlyErrorMessage(error, FALLBACK)).toBe(
      "Sem conexão com o servidor. Verifique sua internet e tente novamente.",
    );
  });

  it("should ask to update the app when the route does not exist", () => {
    const error = new AppError("Route POST:/travelers/auth not found", {
      status: 404,
      code: "ROUTE_NOT_FOUND",
    });

    expect(getFriendlyErrorMessage(error, FALLBACK)).toBe(
      "Esta versão do app não é mais compatível com o servidor. Atualize o app.",
    );
  });

  it("should list translated field labels on validation errors", () => {
    const error = new AppError("Validation error", {
      status: 400,
      fieldErrors: {
        email: ["Invalid email"],
        password: ["Too short"],
      },
    });

    expect(getFriendlyErrorMessage(error, FALLBACK)).toBe(
      "Verifique os campos: e-mail, senha.",
    );
  });

  it("should return the generic validation message when no field label is known", () => {
    const error = new AppError("Validation error", {
      status: 400,
      fieldErrors: { unknownField: ["Invalid"] },
    });

    expect(getFriendlyErrorMessage(error, FALLBACK)).toBe(
      "Verifique os dados informados.",
    );
  });

  it("should return the generic validation message for a validation error without fields", () => {
    const error = new AppError("Validation error", { status: 400 });

    expect(getFriendlyErrorMessage(error, FALLBACK)).toBe(
      "Verifique os dados informados.",
    );
  });

  it("should return the api message on 4xx errors", () => {
    const error = new AppError("Credenciais incorretas.", { status: 401 });

    expect(getFriendlyErrorMessage(error, FALLBACK)).toBe(
      "Credenciais incorretas.",
    );
  });

  it("should not return the server message on 5xx errors", () => {
    const error = new AppError("relation travelers violates constraint", {
      status: 500,
    });

    expect(getFriendlyErrorMessage(error, FALLBACK)).toBe(
      "Algo deu errado no servidor. Tente novamente em instantes.",
    );
  });

  it("should return the fallback when a 4xx error has the default axios message", () => {
    const error = new AppError("Request failed with status code 413", {
      status: 413,
    });

    expect(getFriendlyErrorMessage(error, FALLBACK)).toBe(FALLBACK);
  });

  it("should return the fallback for non api errors", () => {
    expect(getFriendlyErrorMessage(new Error("SQLITE_BUSY"), FALLBACK)).toBe(
      FALLBACK,
    );
    expect(getFriendlyErrorMessage({ message: { a: 1 } }, FALLBACK)).toBe(
      FALLBACK,
    );
    expect(getFriendlyErrorMessage(undefined, FALLBACK)).toBe(FALLBACK);
  });
});
