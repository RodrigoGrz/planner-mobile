import { AppError, FieldErrors } from "@/utils/app-error";
import { ERROR_MESSAGES, FIELD_LABELS } from "@/utils/error-messages";

const API_VALIDATION_MESSAGE = "Validation error";
const AXIOS_DEFAULT_MESSAGE = /^Request failed with status code \d+$/;

function describeInvalidFields(fieldErrors?: FieldErrors) {
  const labels = Object.keys(fieldErrors ?? {})
    .map((field) => FIELD_LABELS[field])
    .filter((label): label is string => Boolean(label));

  if (labels.length === 0) {
    return ERROR_MESSAGES.invalidData;
  }

  return ERROR_MESSAGES.invalidFields(labels);
}

function isValidationError(error: AppError) {
  if (error.status !== 400) {
    return false;
  }

  return Boolean(error.fieldErrors) || error.message === API_VALIDATION_MESSAGE;
}

export function getFriendlyErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof AppError)) {
    return fallback;
  }

  if (error.code === "NETWORK") {
    return ERROR_MESSAGES.network;
  }

  if (error.code === "ROUTE_NOT_FOUND") {
    return ERROR_MESSAGES.outdatedApp;
  }

  if (error.status === undefined) {
    return fallback;
  }

  if (error.status >= 500) {
    return ERROR_MESSAGES.server;
  }

  if (isValidationError(error)) {
    return describeInvalidFields(error.fieldErrors);
  }

  if (!error.message || AXIOS_DEFAULT_MESSAGE.test(error.message)) {
    return fallback;
  }

  return error.message;
}
