import {
  fetchUpstream,
  isSameOrigin,
  problem,
  readSession,
  sessionCookie,
} from "@/lib/finflow/server";

export async function GET(request: Request): Promise<Response> {
  const session = readSession(request);
  const headers = new Headers({ "Cache-Control": "no-store" });
  if (!session) {
    headers.set("Set-Cookie", sessionCookie());
    return Response.json({ authenticated: false }, { headers });
  }
  const upstream = await fetchUpstream("/open-finance/status", session.token, {
    signal: request.signal,
  });
  if (upstream.status === 401) {
    headers.set("Set-Cookie", sessionCookie());
    return Response.json({ authenticated: false }, { headers });
  }
  if (!upstream.ok) return upstream;
  return Response.json(
    { authenticated: true, user: session.user, expiresAt: session.expiresAt },
    { headers },
  );
}

export async function DELETE(request: Request): Promise<Response> {
  if (!isSameOrigin(request))
    return problem(
      403,
      "INVALID_ORIGIN",
      "A origem da solicitação não é permitida.",
    );
  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store", "Set-Cookie": sessionCookie() },
  });
}
