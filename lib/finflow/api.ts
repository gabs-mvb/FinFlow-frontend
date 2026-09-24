import type { ProblemDetail } from "./types";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail: string;
  readonly fieldErrors: Record<string, string>;

  constructor(status: number, problem: ProblemDetail) {
    super(problem.detail || "Não foi possível concluir a solicitação.");
    this.name = "ApiError";
    this.status = status;
    this.code = problem.code || problem.title || "REQUEST_FAILED";
    this.detail = this.message;
    this.fieldErrors = problem.errors ?? {};
  }
}

export interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

function localPath(path: string): string {
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    /[\\#]/.test(path) ||
    path
      .split("?")[0]
      .split("/")
      .some((part) => part === ".." || part === ".")
  ) {
    throw new Error("O caminho da API deve ser relativo ao FinFlow.");
  }
  return `/api/finflow${path}`;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  headers?: HeadersInit,
  options: RequestOptions = {},
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(
    () => {
      timedOut = true;
      controller.abort();
    },
    options.timeoutMs ??
      (method === "POST" && /^\/plans(?:\?|\/personalized$|$)/.test(path)
        ? 200_000
        : 55_000),
  );
  const requestHeaders = new Headers(headers);
  requestHeaders.set("Accept", "application/json");
  if (body !== undefined)
    requestHeaders.set("Content-Type", "application/json");

  try {
    const response = await fetch(localPath(path), {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    });
    if (
      response.status === 401 &&
      !path.startsWith("/auth/") &&
      typeof window !== "undefined"
    )
      window.dispatchEvent(new Event("finflow:unauthorized"));
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    let payload: unknown;
    try {
      payload = text ? JSON.parse(text) : undefined;
    } catch {
      throw new ApiError(response.status >= 400 ? response.status : 502, {
        detail: "O servidor retornou uma resposta inválida. Tente novamente.",
      });
    }
    if (!response.ok) {
      const problem =
        payload && typeof payload === "object"
          ? (payload as ProblemDetail)
          : {};
      throw new ApiError(response.status, problem);
    }
    return payload as T;
  } catch (error) {
    if (timedOut)
      throw new ApiError(504, {
        code: "REQUEST_TIMEOUT",
        detail: "A solicitação demorou mais que o esperado. Tente novamente.",
      });
    if (
      error instanceof ApiError ||
      (error instanceof Error && error.name === "AbortError")
    )
      throw error;
    if (options.signal?.aborted)
      throw new DOMException("Solicitação cancelada.", "AbortError");
    throw new ApiError(0, {
      code: "NETWORK_ERROR",
      detail:
        "Não foi possível conectar ao FinFlow. Verifique sua conexão e tente novamente.",
    });
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>("GET", path, undefined, undefined, options),
  post: <T>(
    path: string,
    body?: unknown,
    headers?: HeadersInit,
    options?: RequestOptions,
  ) => request<T>("POST", path, body, headers, options),
  put: <T>(
    path: string,
    body?: unknown,
    headers?: HeadersInit,
    options?: RequestOptions,
  ) => request<T>("PUT", path, body, headers, options),
  patch: <T>(
    path: string,
    body?: unknown,
    headers?: HeadersInit,
    options?: RequestOptions,
  ) => request<T>("PATCH", path, body, headers, options),
  delete: <T = void>(path: string, options?: RequestOptions) =>
    request<T>("DELETE", path, undefined, undefined, options),
};
