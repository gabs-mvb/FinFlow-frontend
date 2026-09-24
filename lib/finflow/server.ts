// Server-only helpers. Never import this module from a client component.
import type { AuthUser } from "@/lib/auth/types";

const COOKIE_NAME = "finflow_session";
const SESSION_SECONDS = 24 * 60 * 60;
const UPSTREAM_TIMEOUT_MS = 50_000;
const DEFAULT_API_URL = "https://finflow-backend-rxf3.onrender.com";

export interface StoredSession {
  token: string;
  user: AuthUser;
  expiresAt: number;
}

export function problem(
  status: number,
  code: string,
  detail: string,
): Response {
  return Response.json(
    { type: "about:blank", title: code, code, status, detail },
    {
      status,
      headers: {
        "Content-Type": "application/problem+json",
        "Cache-Control": "no-store",
      },
    },
  );
}

export function upstreamUrl(
  path: string,
  search = "",
  namespace: "finance" | "auth" = "finance",
): URL {
  const configured =
    process.env.FINFLOW_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    DEFAULT_API_URL;
  const base = new URL(configured);
  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  ) {
    throw new Error("Invalid FINFLOW_API_URL.");
  }
  const basePath = base.pathname.replace(/\/+$/, "").replace(/\/api\/v1$/, "");
  base.pathname = `${basePath}${namespace === "auth" ? "/api/auth" : "/api/v1"}${path}`;
  base.search = search;
  return base;
}

export function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== "object") return false;
  const user = value as AuthUser;
  return (
    Number.isSafeInteger(user.id) &&
    user.id > 0 &&
    typeof user.name === "string" &&
    user.name.trim().length > 0 &&
    user.name.length <= 100 &&
    typeof user.email === "string" &&
    user.email.length <= 150 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)
  );
}

/** Decode expiry for cookie lifetime only. The backend verifies the signature. */
export function tokenExpiry(token: unknown): number | undefined {
  if (
    typeof token !== "string" ||
    token.length > 3000 ||
    !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token)
  )
    return;
  try {
    const encoded = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(
      atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=")),
    ) as { exp?: number };
    if (
      typeof claims.exp === "number" &&
      Number.isFinite(claims.exp) &&
      claims.exp * 1000 > Date.now()
    )
      return claims.exp * 1000;
  } catch {
    /* Malformed or expired tokens cannot create a session. */
  }
}

export function readSession(request: Request): StoredSession | undefined {
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`));
  if (!cookie) return undefined;
  try {
    const value = JSON.parse(
      decodeURIComponent(cookie.slice(COOKIE_NAME.length + 1)),
    ) as StoredSession;
    const expiresAt = tokenExpiry(value.token);
    if (
      !expiresAt ||
      !isAuthUser(value.user) ||
      !Number.isFinite(value.expiresAt) ||
      value.expiresAt <= Date.now()
    )
      return;
    return {
      token: value.token,
      user: value.user,
      expiresAt: Math.min(value.expiresAt, expiresAt),
    };
  } catch {
    return undefined;
  }
}

export function sessionCookie(session?: StoredSession): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const value = session ? encodeURIComponent(JSON.stringify(session)) : "";
  if (value.length > 3800) throw new Error("Session exceeds cookie size.");
  const maxAge = session
    ? Math.max(
        0,
        Math.min(
          SESSION_SECONDS,
          Math.floor((session.expiresAt - Date.now()) / 1000),
        ),
      )
    : 0;
  return `${COOKIE_NAME}=${value}; Path=/api/finflow; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

/** Reject CSRF for all mutations, including login and registration. */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin || origin === "null") return false;
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none")
    return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function readRequestBody(
  request: Request,
  limit: number,
): Promise<string | Response> {
  if (Number(request.headers.get("content-length")) > limit)
    return problem(
      413,
      "BODY_TOO_LARGE",
      "Os dados excedem o tamanho permitido.",
    );
  const reader = request.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > limit) {
        await reader.cancel();
        return problem(
          413,
          "BODY_TOO_LARGE",
          "Os dados excedem o tamanho permitido.",
        );
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  } catch {
    return problem(
      400,
      "INVALID_REQUEST_BODY",
      "Não foi possível ler os dados enviados.",
    );
  } finally {
    reader.releaseLock();
  }
}

export async function fetchUpstream(
  path: string,
  token: string | undefined,
  init: RequestInit = {},
  search = "",
  namespace: "finance" | "auth" = "finance",
): Promise<Response> {
  let url: URL;
  try {
    url = upstreamUrl(path, search, namespace);
  } catch {
    return problem(
      503,
      "BACKEND_NOT_CONFIGURED",
      "A conexão com o servidor precisa ser configurada.",
    );
  }
  const controller = new AbortController();
  const abort = () => controller.abort(init.signal?.reason);
  if (init.signal?.aborted) abort();
  init.signal?.addEventListener("abort", abort, { once: true });
  const generatingPlan =
    namespace === "finance" &&
    init.method === "POST" &&
    (path === "/plans" || path === "/plans/personalized");
  const timeout = setTimeout(
    () => controller.abort(),
    generatingPlan ? 195_000 : UPSTREAM_TIMEOUT_MS,
  );
  try {
    const headers = new Headers(init.headers);
    headers.delete("X-API-Key");
    headers.delete("Authorization");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    headers.set("Accept", "application/json");
    const response = await fetch(url, {
      ...init,
      headers,
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
    });
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      throw new Error("Unexpected backend redirect.");
    }
    const responseHeaders = new Headers({ "Cache-Control": "no-store" });
    const contentType = response.headers.get("content-type");
    if (contentType) responseHeaders.set("Content-Type", contentType);
    const retryAfter = response.headers.get("retry-after");
    if (retryAfter) responseHeaders.set("Retry-After", retryAfter);
    const body = response.status === 204 ? null : await response.arrayBuffer();
    return new Response(body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch {
    return controller.signal.aborted
      ? problem(
          504,
          "BACKEND_TIMEOUT",
          "O servidor demorou para responder. Tente novamente.",
        )
      : problem(
          502,
          "BACKEND_UNAVAILABLE",
          "Não foi possível conectar ao servidor FinFlow. Tente novamente em instantes.",
        );
  } finally {
    clearTimeout(timeout);
    init.signal?.removeEventListener("abort", abort);
  }
}
