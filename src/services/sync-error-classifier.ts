import { AppError, getErrorStatus } from "@/utils/app-error";
import { ERROR_MESSAGES } from "@/utils/error-messages";
import { getFriendlyErrorMessage } from "@/utils/get-friendly-error-message";

export type SyncErrorKind =
  | "auth"
  | "permanent"
  | "not_found"
  | "rate_limited"
  | "retryable";

export type SyncErrorClassification = {
  kind: SyncErrorKind;
  status?: number;
  message: string;
  retryAfterMs?: number;
};

const RETRYABLE_CLIENT_STATUSES = [408, 409];

function apiMessage(error: unknown) {
  return getFriendlyErrorMessage(error, ERROR_MESSAGES.syncFailed);
}

export function classifySyncError(error: unknown): SyncErrorClassification {
  if (error instanceof AppError && error.code === "NETWORK") {
    return { kind: "retryable", message: ERROR_MESSAGES.network };
  }

  if (error instanceof AppError && error.code === "ROUTE_NOT_FOUND") {
    return {
      kind: "permanent",
      status: error.status,
      message: ERROR_MESSAGES.outdatedApp,
    };
  }

  const status = getErrorStatus(error);

  if (status === undefined || status < 400) {
    return { kind: "retryable", message: ERROR_MESSAGES.syncFailed };
  }

  if (status === 401) {
    return { kind: "auth", status, message: ERROR_MESSAGES.sessionExpired };
  }

  if (status === 429) {
    return {
      kind: "rate_limited",
      status,
      message: ERROR_MESSAGES.rateLimited,
      retryAfterMs: error instanceof AppError ? error.retryAfterMs : undefined,
    };
  }

  if (status >= 500) {
    return { kind: "retryable", status, message: ERROR_MESSAGES.server };
  }

  if (RETRYABLE_CLIENT_STATUSES.includes(status)) {
    return { kind: "retryable", status, message: apiMessage(error) };
  }

  if (status === 404) {
    return { kind: "not_found", status, message: apiMessage(error) };
  }

  if (status === 403) {
    return { kind: "permanent", status, message: ERROR_MESSAGES.forbidden };
  }

  if (status === 413) {
    return { kind: "permanent", status, message: ERROR_MESSAGES.fileTooLarge };
  }

  return { kind: "permanent", status, message: apiMessage(error) };
}
