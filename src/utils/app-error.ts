export type AppErrorCode = "NETWORK";

export type FieldErrors = Record<string, string[]>;

type AppErrorOptions = {
    status?: number;
    code?: AppErrorCode;
    cause?: unknown;
    fieldErrors?: FieldErrors;
};

export class AppError extends Error {
    status?: number;
    code?: AppErrorCode;
    cause?: unknown;
    fieldErrors?: FieldErrors;

    constructor(message: string, options: AppErrorOptions = {}) {
        super(message);
        this.name = "AppError";
        this.status = options.status;
        this.code = options.code;
        this.cause = options.cause;
        this.fieldErrors = options.fieldErrors;
    }
}

export function getErrorStatus(error: unknown): number | undefined {
    if (error instanceof AppError) {
        return error.status;
    }

    if (typeof error !== "object" || error === null || !("response" in error)) {
        return undefined;
    }

    const { response } = error as { response?: { status?: unknown } };

    return typeof response?.status === "number" ? response.status : undefined;
}
