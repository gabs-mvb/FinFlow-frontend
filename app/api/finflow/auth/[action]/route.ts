import {
  fetchUpstream,
  isSameOrigin,
  isAuthUser,
  problem,
  readRequestBody,
  sessionCookie,
  tokenExpiry,
} from "@/lib/finflow/server";
import type { LoginResponse } from "@/lib/auth/types";

export async function POST(
  request: Request,
  context: { params: Promise<{ action: string }> },
): Promise<Response> {
  const { action } = await context.params;
  if (action !== "login" && action !== "register")
    return problem(404, "NOT_FOUND", "Operação não encontrada.");
  if (!isSameOrigin(request))
    return problem(
      403,
      "INVALID_ORIGIN",
      "A origem da solicitação não é permitida.",
    );
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    return problem(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Envie os dados no formato JSON.",
    );
  const raw = await readRequestBody(request, 4096);
  if (raw instanceof Response) return raw;
  let input: { name?: unknown; email?: unknown; password?: unknown };
  try {
    input = JSON.parse(raw);
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new Error();
  } catch {
    return problem(400, "INVALID_INPUT", "Revise os dados do formulário.");
  }

  const email = typeof input.email === "string" ? input.email.trim() : "";
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 150)
    return problem(
      400,
      "INVALID_EMAIL",
      "Informe um e-mail válido, com até 150 caracteres.",
    );
  if (
    typeof input.password !== "string" ||
    !input.password.trim() ||
    new TextEncoder().encode(input.password).length > 72
  )
    return problem(
      400,
      "INVALID_PASSWORD",
      "Informe uma senha de até 72 bytes. Acentos e símbolos podem ocupar mais de um byte.",
    );
  if (action === "register" && (!name || name.length > 100))
    return problem(
      400,
      "INVALID_NAME",
      "Informe seu nome, com até 100 caracteres.",
    );

  const upstream = await fetchUpstream(
    `/${action}`,
    undefined,
    {
      method: "POST",
      signal: request.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(action === "register" ? { name } : {}),
        email,
        password: input.password,
      }),
    },
    "",
    "auth",
  );
  let payload: unknown;
  try {
    payload = await upstream.json();
  } catch {
    /* Some authentication failures have empty bodies. */
  }
  if (!upstream.ok) {
    const failure =
      payload && typeof payload === "object"
        ? (payload as Record<string, unknown>)
        : {};
    const detail = String(
      failure.detail ?? failure.message ?? failure.error ?? "",
    );
    if (action === "login" && upstream.status === 401)
      return problem(
        401,
        "INVALID_CREDENTIALS",
        "E-mail ou senha incorretos. Confira os dados e tente novamente.",
      );
    if (action === "login" && upstream.status === 403)
      return problem(
        403,
        "ACCOUNT_UNAVAILABLE",
        "O acesso a esta conta está indisponível.",
      );
    if (
      action === "register" &&
      (upstream.status === 409 ||
        /already registered|already exists|já cadastrado/i.test(detail))
    )
      return problem(
        409,
        "EMAIL_IN_USE",
        "Já existe uma conta com este e-mail. Entre na sua conta.",
      );
    if (upstream.status === 429)
      return problem(
        429,
        "TOO_MANY_ATTEMPTS",
        "Muitas tentativas. Aguarde um pouco antes de tentar novamente.",
      );
    if (upstream.status >= 500)
      return problem(
        upstream.status,
        "AUTH_UNAVAILABLE",
        "Não foi possível acessar o serviço de autenticação. Tente novamente em instantes.",
      );
    return problem(
      upstream.status,
      "AUTH_FAILED",
      action === "register"
        ? "Não foi possível criar sua conta. Confira os dados e tente novamente."
        : "Não foi possível entrar. Confira os dados e tente novamente.",
    );
  }
  if (!isAuthUser(payload))
    return problem(
      502,
      "INVALID_AUTH_RESPONSE",
      "O servidor retornou dados de usuário inválidos.",
    );
  const user = { id: payload.id, name: payload.name, email: payload.email };
  if (action === "register")
    return Response.json(
      { user },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  const token = (payload as LoginResponse).token;
  const tokenExpiresAt = tokenExpiry(token);
  if (!tokenExpiresAt)
    return problem(
      502,
      "INVALID_AUTH_RESPONSE",
      "O servidor não retornou uma sessão válida. Tente entrar novamente.",
    );
  const expiresAt = Math.min(tokenExpiresAt, Date.now() + 24 * 60 * 60 * 1000);
  try {
    return Response.json(
      { authenticated: true, user, expiresAt },
      {
        headers: {
          "Cache-Control": "no-store",
          "Set-Cookie": sessionCookie({ token, user, expiresAt }),
        },
      },
    );
  } catch {
    return problem(
      502,
      "INVALID_AUTH_RESPONSE",
      "Não foi possível criar a sessão. Tente entrar novamente.",
    );
  }
}
