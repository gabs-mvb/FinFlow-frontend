import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { afterEach, test } from "node:test";
import ts from "typescript";

// Load the actual TypeScript modules with the project's existing compiler.
// This keeps the contract tests independent from Next's route runtime.
async function moduleUrl(path, imports = {}) {
  let source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
  for (const [specifier, url] of Object.entries(imports)) {
    source = source
      .replaceAll(`'${specifier}'`, `'${url}'`)
      .replaceAll(`"${specifier}"`, `"${url}"`);
  }
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });
  return `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`;
}
const serverUrl = await moduleUrl("lib/finflow/server.ts");
const server = await import(serverUrl);
const proxy = await import(
  await moduleUrl("app/api/finflow/[...path]/route.ts", {
    "@/lib/finflow/server": serverUrl,
  })
);
const session = await import(
  await moduleUrl("app/api/finflow/session/route.ts", {
    "@/lib/finflow/server": serverUrl,
  })
);
const { api, ApiError } = await import(await moduleUrl("lib/finflow/api.ts"));
const auth = await import(
  await moduleUrl("app/api/finflow/auth/[action]/route.ts", {
    "@/lib/finflow/server": serverUrl,
  })
);
const user = { id: 1, name: "João Silva", email: "joao@example.com" };
const expiresAt = Math.floor(Date.now() / 1000) * 1000 + 3_600_000;
const token = `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: user.email, exp: expiresAt / 1000 })).toString("base64url")}.testsignature`;
const testSession = { token, user, expiresAt };
const originalFetch = globalThis.fetch;
const originalEnv = {
  FINFLOW_API_URL: process.env.FINFLOW_API_URL,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  FINFLOW_API_KEY: process.env.FINFLOW_API_KEY,
  NODE_ENV: process.env.NODE_ENV,
};

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [name, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

function request(path, method = "GET", body, extraHeaders = {}) {
  return new Request(`http://localhost:3000/api/finflow${path}`, {
    method,
    headers: {
      Origin: "http://localhost:3000",
      Cookie: server.sessionCookie(testSession),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...extraHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
function context(path) {
  return {
    params: Promise.resolve({
      path: path.split("?")[0].split("/").filter(Boolean),
    }),
  };
}

test("proxy forwards PUT to the configured origin, uses JWT session credentials, and strips browser headers", async () => {
  process.env.FINFLOW_API_URL = "http://backend.internal:8080/api/v1";
  process.env.FINFLOW_API_KEY = "server-test-key";
  let received;
  globalThis.fetch = async (url, init) => {
    received = { url: String(url), init };
    return Response.json({ payDay: 5 });
  };
  const response = await proxy.PUT(
    request(
      "/profile",
      "PUT",
      { payDay: 5 },
      {
        "X-API-Key": "browser-override",
        Authorization: "Bearer attacker",
        Cookie: server.sessionCookie(testSession),
      },
    ),
    context("/profile"),
  );
  assert.equal(response.status, 200);
  assert.equal(received.url, "http://backend.internal:8080/api/v1/profile");
  assert.equal(received.init.method, "PUT");
  assert.equal(received.init.headers.get("X-API-Key"), null);
  assert.equal(received.init.headers.get("Authorization"), `Bearer ${token}`);
  assert.equal(received.init.headers.get("Cookie"), null);
  assert.equal(received.init.redirect, "manual");
  assert.equal(received.init.body, '{"payDay":5}');
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("proxy rejects unknown endpoints, invalid methods, traversal, query injection, and CSRF before contacting upstream", async () => {
  process.env.FINFLOW_API_KEY = "server-test-key";
  globalThis.fetch = async () => {
    assert.fail("unexpected upstream request");
  };
  assert.equal(
    (await proxy.GET(request("/actuator/env"), context("/actuator/env")))
      .status,
    404,
  );
  assert.equal(
    (await proxy.POST(request("/profile", "POST", {}), context("/profile")))
      .status,
    405,
  );
  assert.equal(
    (
      await proxy.GET(request("/accounts"), {
        params: Promise.resolve({ path: ["..", "accounts"] }),
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await proxy.GET(
        request("/accounts?url=http://evil.example"),
        context("/accounts"),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await proxy.PUT(
        request("/profile", "PUT", {}, { Origin: "https://evil.example" }),
        context("/profile"),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await proxy.PUT(
        new Request("http://localhost:3000/api/finflow/profile", {
          method: "PUT",
        }),
        context("/profile"),
      )
    ).status,
    403,
  );
});

test("proxy requires credentials and accepts session cookie without exposing it to upstream", async () => {
  delete process.env.FINFLOW_API_KEY;
  globalThis.fetch = async (_url, init) => {
    assert.equal(init.headers.get("Authorization"), `Bearer ${token}`);
    assert.equal(init.headers.get("Cookie"), null);
    return Response.json([]);
  };
  assert.equal(
    (
      await proxy.GET(
        request("/accounts", "GET", undefined, { Cookie: "" }),
        context("/accounts"),
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await proxy.GET(
        request("/accounts", "GET", undefined, {
          Cookie: server.sessionCookie(testSession),
        }),
        context("/accounts"),
      )
    ).status,
    200,
  );
});

test("transaction imports preserve Idempotency-Key, while GET query dates are forwarded intact", async () => {
  process.env.FINFLOW_API_KEY = "test-key";
  process.env.FINFLOW_API_URL = "http://localhost:8080";
  globalThis.fetch = async (url, init) => {
    if (init.method === "POST")
      assert.equal(init.headers.get("Idempotency-Key"), "stable-import-key");
    else
      assert.equal(
        new URL(url).searchParams.get("from"),
        "2026-09-01T00:00:00-03:00",
      );
    return Response.json([]);
  };
  assert.equal(
    (
      await proxy.POST(
        request(
          "/transactions/imports",
          "POST",
          { transactions: [] },
          { "Idempotency-Key": "stable-import-key" },
        ),
        context("/transactions/imports"),
      )
    ).status,
    200,
  );
  const params = new URLSearchParams({
    from: "2026-09-01T00:00:00-03:00",
    to: "2026-09-30T23:59:59-03:00",
  });
  assert.equal(
    (
      await proxy.GET(
        request(`/transactions?${params}`),
        context("/transactions"),
      )
    ).status,
    200,
  );
});

test("proxy preserves 204 and validation ProblemDetail responses", async () => {
  process.env.FINFLOW_API_KEY = "test-key";
  globalThis.fetch = async () => new Response(null, { status: 204 });
  const empty = await proxy.GET(
    request("/plans/latest"),
    context("/plans/latest"),
  );
  assert.equal(empty.status, 204);
  assert.equal(await empty.text(), "");
  const problem = {
    status: 400,
    code: "VALIDATION_ERROR",
    detail: "Campos inválidos",
    errors: { payDay: "máximo 28" },
  };
  globalThis.fetch = async () =>
    Response.json(problem, {
      status: 400,
      headers: { "Content-Type": "application/problem+json" },
    });
  const response = await proxy.PUT(
    request("/profile", "PUT", { payDay: 40 }),
    context("/profile"),
  );
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), problem);
});

test("proxy bounds bodies before parsing and rejects malformed JSON", async () => {
  process.env.FINFLOW_API_KEY = "test-key";
  globalThis.fetch = async () => {
    assert.fail("unexpected upstream request");
  };
  const oversized = request("/transactions/imports", "POST", {
    text: "x".repeat(1_048_576),
  });
  assert.equal(
    (await proxy.POST(oversized, context("/transactions/imports"))).status,
    413,
  );
  const malformed = new Request("http://localhost:3000/api/finflow/profile", {
    method: "PUT",
    body: "{",
    headers: {
      Origin: "http://localhost:3000",
      Cookie: server.sessionCookie(testSession),
      "Content-Type": "application/json",
      Cookie: server.sessionCookie(testSession),
    },
  });
  assert.equal((await proxy.PUT(malformed, context("/profile"))).status, 400);
});

test("login uses /api/auth, keeps JWT in HttpOnly cookie, and returns only public session data", async () => {
  process.env.FINFLOW_API_URL = "https://backend.example/api/v1";
  process.env.NODE_ENV = "production";
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "https://backend.example/api/auth/login");
    assert.equal(init.headers.get("Authorization"), null);
    assert.equal(init.headers.get("X-API-Key"), null);
    assert.deepEqual(JSON.parse(init.body), {
      email: user.email,
      password: " senha123 ",
    });
    return Response.json({ ...user, token });
  };
  const response = await auth.POST(
    request("/auth/login", "POST", {
      email: ` ${user.email} `,
      password: " senha123 ",
    }),
    { params: Promise.resolve({ action: "login" }) },
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    authenticated: true,
    user,
    expiresAt,
  });
  const cookie = response.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Secure/);
  assert.ok(Number(/Max-Age=(\d+)/.exec(cookie)[1]) <= 3600);
  assert.equal(
    server.readSession(
      request("/session", "GET", undefined, { Cookie: cookie }),
    ).token,
    token,
  );
});

test("register sends only the registration contract and does not create a session", async () => {
  process.env.FINFLOW_API_URL = "http://localhost:8080";
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "http://localhost:8080/api/auth/register");
    assert.deepEqual(JSON.parse(init.body), {
      name: user.name,
      email: user.email,
      password: "senha123",
    });
    return Response.json(
      { ...user, token: "must-not-be-returned" },
      { status: 201 },
    );
  };
  const response = await auth.POST(
    request("/auth/register", "POST", {
      ...user,
      password: "senha123",
      confirmation: "senha123",
    }),
    { params: Promise.resolve({ action: "register" }) },
  );
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { user });
  assert.equal(response.headers.get("set-cookie"), null);
});

test("session validates JWT with the backend and clears rejected sessions and logout cookies", async () => {
  process.env.FINFLOW_API_URL = "http://localhost:8080";
  globalThis.fetch = async (url, init) => {
    assert.equal(
      String(url),
      "http://localhost:8080/api/v1/open-finance/status",
    );
    assert.equal(init.headers.get("Authorization"), `Bearer ${token}`);
    return Response.json({});
  };
  const valid = await session.GET(request("/session"));
  assert.deepEqual(await valid.json(), {
    authenticated: true,
    user,
    expiresAt,
  });
  globalThis.fetch = async () =>
    Response.json({ message: "Unauthorized" }, { status: 401 });
  const invalid = await session.GET(request("/session"));
  assert.deepEqual(await invalid.json(), { authenticated: false });
  assert.match(invalid.headers.get("set-cookie"), /Max-Age=0/);
  const logout = await session.DELETE(request("/session", "DELETE"));
  assert.equal(logout.status, 204);
  assert.match(logout.headers.get("set-cookie"), /Max-Age=0/);
});

test("legacy API key and malformed or expired cookies never authenticate, even with server key configured", async () => {
  process.env.FINFLOW_API_KEY = "legacy-server-key";
  globalThis.fetch = async () => assert.fail("must not contact backend");
  for (const cookie of [
    "",
    "finflow_session=legacy-api-key",
    "finflow_session=%not-json",
    server.sessionCookie({ ...testSession, expiresAt: Date.now() - 1000 }),
  ]) {
    const response = await session.GET(
      request("/session", "GET", undefined, { Cookie: cookie }),
    );
    assert.deepEqual(await response.json(), { authenticated: false });
    assert.equal(
      (
        await proxy.GET(
          request("/accounts", "GET", undefined, { Cookie: cookie }),
          context("/accounts"),
        )
      ).status,
      401,
    );
  }
});

test("authentication rejects CSRF, malformed bodies, oversized fields and non-BCrypt-compatible passwords", async () => {
  globalThis.fetch = async () => assert.fail("must not contact backend");
  const ctx = { params: Promise.resolve({ action: "register" }) };
  const valid = { name: user.name, email: user.email, password: "senha123" };
  assert.equal(
    (
      await auth.POST(
        request("/auth/register", "POST", valid, {
          Origin: "https://evil.example",
        }),
        ctx,
      )
    ).status,
    403,
  );
  for (const body of [
    null,
    [],
    { ...valid, name: " " },
    { ...valid, email: "invalid" },
    { ...valid, password: "á".repeat(37) },
    { ...valid, name: "x".repeat(101) },
  ]) {
    assert.equal(
      (
        await auth.POST(
          request("/auth/register", "POST", body, {
            "Content-Type": "application/json",
          }),
          ctx,
        )
      ).status,
      400,
    );
  }
});

test("auth errors are actionable and failed login never creates a cookie", async () => {
  const ctx = (action) => ({ params: Promise.resolve({ action }) });
  const body = { ...user, password: "senha123" };
  globalThis.fetch = async () =>
    Response.json({ message: "Bad credentials" }, { status: 401 });
  const login = await auth.POST(
    request("/auth/login", "POST", body),
    ctx("login"),
  );
  assert.equal(login.status, 401);
  assert.equal(login.headers.get("set-cookie"), null);
  assert.match((await login.json()).detail, /E-mail ou senha incorretos/);
  globalThis.fetch = async () =>
    Response.json(
      { message: "User already registered with this email" },
      { status: 400 },
    );
  const register = await auth.POST(
    request("/auth/register", "POST", body),
    ctx("register"),
  );
  assert.equal(register.status, 409);
  assert.match((await register.json()).detail, /Já existe uma conta/);
  globalThis.fetch = async () =>
    Response.json({ ...user, token: "malformed-token" });
  const malformed = await auth.POST(
    request("/auth/login", "POST", body),
    ctx("login"),
  );
  assert.equal(malformed.status, 502);
  assert.equal(malformed.headers.get("set-cookie"), null);
});

test("backend redirects are rejected without forwarding credentials to another destination", async () => {
  let calls = 0;
  globalThis.fetch = async (_url, init) => {
    calls++;
    assert.equal(init.redirect, "manual");
    return new Response(null, {
      status: 307,
      headers: { Location: "https://unexpected.example/login" },
    });
  };
  const response = await server.fetchUpstream("/accounts", token);
  assert.equal(response.status, 502);
  assert.equal(response.headers.get("location"), null);
  assert.equal(calls, 1);
});

test("backend URL prefers private configuration, supports public configuration, and defaults to Render", () => {
  delete process.env.FINFLOW_API_URL;
  delete process.env.NEXT_PUBLIC_API_URL;
  assert.equal(
    String(server.upstreamUrl("/accounts")),
    "https://finflow-backend-rxf3.onrender.com/api/v1/accounts",
  );
  process.env.NEXT_PUBLIC_API_URL = "https://public.example";
  assert.equal(
    String(server.upstreamUrl("/login", "", "auth")),
    "https://public.example/api/auth/login",
  );
  process.env.FINFLOW_API_URL = "http://localhost:8080";
  assert.equal(
    String(server.upstreamUrl("/accounts")),
    "http://localhost:8080/api/v1/accounts",
  );
});

test("failed backend connections return a useful 502", async () => {
  process.env.FINFLOW_API_URL = "http://localhost:8080";
  globalThis.fetch = async () => {
    throw new TypeError("ECONNREFUSED");
  };
  assert.equal((await server.fetchUpstream("/accounts", "key")).status, 502);
});

test("client handles 204, preserves validation fields, and sends same-origin credentials", async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "/api/finflow/plans/latest");
    assert.equal(init.credentials, "same-origin");
    assert.equal(init.cache, "no-store");
    return new Response(null, { status: 204 });
  };
  assert.equal(await api.get("/plans/latest"), undefined);
  globalThis.fetch = async () =>
    Response.json(
      {
        code: "VALIDATION_ERROR",
        detail: "Revise os campos.",
        errors: { payDay: "máximo 28" },
      },
      { status: 400 },
    );
  await assert.rejects(
    api.put("/profile", { payDay: 30 }),
    (error) =>
      error instanceof ApiError &&
      error.status === 400 &&
      error.fieldErrors.payDay === "máximo 28",
  );
});

test("client distinguishes timeout, caller cancellation, and malformed successful responses", async () => {
  globalThis.fetch = async (_url, init) =>
    new Promise((_resolve, reject) => {
      const fail = () => reject(new DOMException("Aborted", "AbortError"));
      if (init.signal.aborted) fail();
      else init.signal.addEventListener("abort", fail, { once: true });
    });
  await assert.rejects(
    api.get("/accounts", { timeoutMs: 5 }),
    (error) => error instanceof ApiError && error.status === 504,
  );
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(
    api.get("/accounts", { signal: abort.signal }),
    (error) => error.name === "AbortError",
  );
  globalThis.fetch = async () => new Response("<html>error</html>");
  await assert.rejects(
    api.get("/accounts"),
    (error) => error instanceof ApiError && error.status === 502,
  );
});
