import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PATCH']);

function upstreamBase(request: NextRequest) {
  const configured = process.env.FINFLOW_API_URL?.trim();
  const requested = request.headers.get('x-finflow-upstream')?.trim();
  const raw = configured || requested;

  if (!raw) throw new Error('A URL da API FinFlow não foi informada.');

  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('A URL da API FinFlow é inválida.');
  }

  // A base deve representar somente a origem. Isso impede que o proxy seja
  // redirecionado para rotas arbitrárias fora da API FinFlow.
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Informe somente a origem da API, sem caminho ou parâmetros.');
  }

  return url;
}

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  if (!ALLOWED_METHODS.has(request.method)) {
    return NextResponse.json({ detail: 'Método não permitido.' }, { status: 405 });
  }

  try {
    const { path } = await context.params;
    const normalizedPath = path.join('/');

    if (!normalizedPath.startsWith('api/v1/')) {
      return NextResponse.json({ detail: 'Rota da API não permitida.' }, { status: 403 });
    }

    const target = upstreamBase(request);
    target.pathname = `/${normalizedPath}`;
    target.search = request.nextUrl.search;

    const apiKey = request.headers.get('x-api-key');
    const body = request.method === 'GET' ? undefined : await request.arrayBuffer();
    const response = await fetch(target, {
      method: request.method,
      headers: {
        Accept: 'application/json',
        ...(apiKey ? { 'X-API-Key': apiKey } : {}),
        ...(body?.byteLength ? { 'Content-Type': request.headers.get('content-type') || 'application/json' } : {}),
      },
      body: body?.byteLength ? body : undefined,
      redirect: 'manual',
      cache: 'no-store',
    });

    const responseBody = await response.arrayBuffer();
    return new NextResponse(responseBody, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao acessar a API FinFlow.';
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;

