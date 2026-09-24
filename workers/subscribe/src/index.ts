import { SITE_URL } from './config.ts';
import type { Deps, Env } from './env.ts';
import { allowedOrigins } from './env.ts';
import { handleConfirmGet, handleConfirmPost } from './handlers/confirm.ts';
import { handleSubscribe } from './handlers/subscribe.ts';
import { corsHeaders } from './http.ts';

export async function route(request: Request, env: Env, deps: Deps): Promise<Response> {
  const { pathname } = new URL(request.url);

  if (pathname === '/subscribe') {
    if (request.method === 'OPTIONS') {
      const origin = request.headers.get('Origin') ?? '';
      if (!allowedOrigins(env).includes(origin)) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method === 'POST') return handleSubscribe(request, env, deps);
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST, OPTIONS' } });
  }

  if (pathname === '/confirm') {
    if (request.method === 'GET') return handleConfirmGet(request);
    if (request.method === 'POST') return handleConfirmPost(request, env, deps);
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
