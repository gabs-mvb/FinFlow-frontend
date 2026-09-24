import {
  fetchUpstream,
  isSameOrigin,
  problem,
  readRequestBody,
  readSession,
  sessionCookie,
} from "@/lib/finflow/server";

type RouteContext = { params: Promise<{ path: string[] }> };
const uuid =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const routes: { pattern: RegExp; methods: string[]; query?: string[] }[] = [
  { pattern: /^\/onboarding$/, methods: ["GET"] },
  { pattern: /^\/onboarding\/complete$/, methods: ["POST"] },
  { pattern: /^\/profile$/, methods: ["GET", "PUT"] },
  { pattern: /^\/accounts$/, methods: ["GET", "POST"] },
  { pattern: new RegExp(`^/accounts/${uuid}/balance$`), methods: ["PATCH"] },
  {
    pattern: /^\/transactions$/,
    methods: ["GET"],
    query: ["from", "to", "category"],
  },
  { pattern: /^\/transactions\/imports$/, methods: ["POST"] },
  { pattern: /^\/(obligations|debts|goals)$/, methods: ["GET", "POST"] },
  {
    pattern: new RegExp(`^/(obligations|debts)/${uuid}/paid$`),
    methods: ["PATCH"],
  },
  { pattern: new RegExp(`^/goals/${uuid}/progress$`), methods: ["PATCH"] },
  { pattern: /^\/portfolio$/, methods: ["GET", "PUT"] },
  { pattern: /^\/open-finance\/status$/, methods: ["GET"] },
  { pattern: /^\/open-finance\/consents$/, methods: ["GET", "PUT"] },
  { pattern: /^\/plans$/, methods: ["POST"], query: ["asOf"] },
  { pattern: /^\/plans\/latest$/, methods: ["GET"] },
  {
    pattern: new RegExp(`^/plans/actions/${uuid}/(approve|reject)$`),
    methods: ["PATCH"],
  },
  {
    pattern: /^\/reports\/monthly$/,
    methods: ["GET"],
    query: ["year", "month"],
  },
];

async function proxy(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { path: segments } = await context.params;
  if (
    !segments?.length ||
    segments.some((segment) => !/^[a-zA-Z0-9-]+$/.test(segment))
  ) {
    return problem(
      404,
      "ENDPOINT_NOT_FOUND",
      "Este recurso não está disponível.",
    );
  }
  const path = `/${segments.join("/")}`;
  const route = routes.find(({ pattern }) => pattern.test(path));
  if (!route)
    return problem(
      404,
      "ENDPOINT_NOT_FOUND",
      "Este recurso não está disponível.",
    );
  if (!route.methods.includes(request.method))
    return problem(
      405,
      "METHOD_NOT_ALLOWED",
      "Esta operação não está disponível para o recurso.",
    );
  if (request.method !== "GET" && !isSameOrigin(request))
    return problem(
      403,
      "INVALID_ORIGIN",
      "A origem da solicitação não é permitida.",
    );
  const session = readSession(request);
  if (!session)
    return problem(401, "UNAUTHORIZED", "Entre na sua conta para continuar.");
  const query = new URL(request.url).searchParams;
  for (const name of query.keys()) {
    if (!route.query?.includes(name) || query.getAll(name).length !== 1)
      return problem(
        400,
        "INVALID_QUERY",
        "A consulta contém um parâmetro inválido.",
      );
  }

  const headers = new Headers();
  const idempotency = request.headers.get("Idempotency-Key");
  if (idempotency) headers.set("Idempotency-Key", idempotency);
  let body: string | undefined;
  if (request.method !== "GET") {
    const content = await readRequestBody(request, 1_048_576);
    if (content instanceof Response) return content;
    body = content;
    if (body) {
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
      try {
        JSON.parse(body);
      } catch {
        return problem(
          400,
          "MALFORMED_REQUEST_BODY",
          "O corpo da solicitação não contém um JSON válido.",
        );
      }
      headers.set("Content-Type", "application/json");
    }
  }
  const response = await fetchUpstream(
    path,
    session.token,
    {
      method: request.method,
      headers,
      body: body || undefined,
      signal: request.signal,
    },
    query.toString(),
  );
  if (response.status === 401)
    response.headers.set("Set-Cookie", sessionCookie());
  return response;
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
