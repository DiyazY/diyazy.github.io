import { SITE_URL } from './config.ts';
import type { Deps, Env } from './env.ts';
import { allowedOrigins } from './env.ts';
import { handleConfirmGet, handleConfirmPost } from './handlers/confirm.ts';
import { handleSubscribe, subscribeReply } from './handlers/subscribe.ts';
import { corsHeaders, html } from './http.ts';
import { errorPage } from './pages.ts';

const errorName = (err: unknown) => (err instanceof Error ? err.name : 'unknown');

export async function route(request: Request, env: Env, deps: Deps): Promise<Response> {
  const { pathname } = new URL(request.url);

  if (pathname === '/subscribe') {
    const origin = request.headers.get('Origin') ?? '';
    if (request.method === 'OPTIONS') {
      if (!allowedOrigins(env).includes(origin)) {
        deps.log({ step: 'preflight.origin', status: 403, reason: origin.slice(0, 100) || '(none)' });
        return new Response(null, { status: 403 });
      }
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method === 'POST') {
      try {
        return await handleSubscribe(request, env, deps);
      } catch (err) {
        // Anything unexpected still gets a JSON answer the browser can read.
        deps.log({ step: 'subscribe.unhandled', status: 500, reason: errorName(err) });
        return allowedOrigins(env).includes(origin)
          ? subscribeReply({ ok: false, error: 'server' }, 500, origin)
          : new Response('Server Error', { status: 500 });
      }
    }
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST, OPTIONS' } });
  }

  if (pathname === '/confirm') {
    if (request.method === 'GET') return handleConfirmGet(request);
    if (request.method === 'POST') {
      try {
        return await handleConfirmPost(request, env, deps);
      } catch (err) {
        deps.log({ step: 'confirm.unhandled', status: 500, reason: errorName(err) });
        return html(errorPage(), 500);
      }
    }
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, POST' } });
  }

  if (pathname === '/') return Response.redirect(`${SITE_URL}/subscribe/`, 302);
  return new Response('Not Found', { status: 404 });
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return route(request, env, {
      fetch: (input, init) => fetch(input, init),
      now: () => Date.now(),
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      log: (entry) => console.log(JSON.stringify(entry)),
    });
  },
};
