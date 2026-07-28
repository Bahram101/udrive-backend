import { ZodError } from "zod";

export class AppError extends Error {
  status: number;
  extra?: Record<string, unknown>;

  constructor(status: number, message: string, extra?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export function handleApiError(error: unknown): Response {
  if (error instanceof AppError) {
    return Response.json({ error: error.message, ...error.extra }, { status: error.status });
  }

  if (error instanceof ZodError) {
    return Response.json(
      { error: error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  console.error(error);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
