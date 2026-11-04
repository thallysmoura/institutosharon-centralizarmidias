import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const cache = new Map<string, { ok: boolean; ate: number }>();

/** Diz se o endereço do site já está autorizado como destino de login do Google (evita mandar o usuário para uma tela de erro). */
export async function GET(req: Request) {
  const host = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '').split(',')[0].trim();
  if (!host || /^(localhost|127\.)/.test(host)) return NextResponse.json({ ok: false });
  const c = cache.get(host);
  if (c && c.ate > Date.now()) return NextResponse.json({ ok: c.ok });
  let ok = false;
  try {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(8000),
      body: JSON.stringify({ providerId: 'google.com', continueUri: `https://${host}/__/auth/handler`, authFlowType: 'CODE_FLOW' }),
    });
    const uri = ((await r.json()) as { authUri?: string }).authUri;
    if (uri) {
      const g = await fetch(uri, { signal: AbortSignal.timeout(8000) });
      ok = g.ok && !/redirect_uri_mismatch/i.test(await g.text());
    }
  } catch { ok = false; }
  cache.set(host, { ok, ate: Date.now() + (ok ? 600_000 : 30_000) });
  return NextResponse.json({ ok });
}
