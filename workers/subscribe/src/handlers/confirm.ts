// GET shows a button; only the POST it submits saves anything. Email link
// scanners (Safe Links, Mimecast, ...) open every GET in a message, so a
// subscribe-on-GET would confirm people who never clicked.
import { SITE_URL } from '../config.ts';
import type { Deps, Env } from '../env.ts';
import { configProblems } from '../env.ts';
import { html } from '../http.ts';
import { confirmPage, errorPage, expiredPage, retryPage } from '../pages.ts';
import { ResendError, createResendClient } from '../resend.ts';
import type { TopicSubscription } from '../resend.ts';
import { decryptToken } from '../token.ts';
import type { TokenPayload } from '../token.ts';

export function handleConfirmGet(request: Request): Response {
  const token = new URL(request.url).searchParams.get('t') ?? '';
  if (!token) return html(expiredPage(), 400);
  return html(confirmPage(token), 200);
}

export async function handleConfirmPost(request: Request, env: Env, deps: Deps): Promise<Response> {
  if (configProblems(env).length > 0) {
    deps.log({ step: 'confirm.config', status: 500 });
    return html(errorPage(), 500);
  }

  let token = '';
  try {
    token = String((await request.formData()).get('t') ?? '');
  } catch {
    // No form body: treated as a missing token below.
  }

  let payload: TokenPayload | null = null;
  try {
    payload = token ? await decryptToken(token, env.TOKEN_KEY) : null;
  } catch {
    deps.log({ step: 'confirm.key', status: 500 });
    return html(errorPage(), 500);
  }
  if (!payload || payload.exp < deps.now()) {
    deps.log({ step: 'confirm.token', status: 400 });
    return html(expiredPage(), 400);
  }

  // The form only ever adds opt-ins. An unticked box never revokes Programmes:
  // new contacts fall back to its opt_out default, and an existing opt-in is
  // carried over. Opting out happens on Resend's preferences page.
  const topicsFor = (programmes: boolean): TopicSubscription[] => [
    { id: env.TOPIC_NEW_POSTS_ID, subscription: 'opt_in' },
    ...(programmes ? [{ id: env.TOPIC_PROGRAMMES_ID, subscription: 'opt_in' as const }] : []),
  ];

  const resend = createResendClient({ apiKey: env.RESEND_API_KEY, fetch: deps.fetch, sleep: deps.sleep });
  try {
    const existing = await resend.getContact(payload.email);
    if (!existing) {
      await resend.createContact({
        email: payload.email,
        unsubscribed: false,
        segments: [{ id: env.RESEND_SEGMENT_ID }],
        topics: topicsFor(payload.programmes),
      });
    } else {
      // The global flag only spans this team (diyaz.dev), so clearing it
      // can't re-subscribe anyone to another product's emails.
      await resend.updateContact(payload.email, { unsubscribed: false });
      // Read before writing: Resend documents neither its answer to a
      // duplicate segment add nor whether a topics PATCH replaces the list.
      const segmentIds = await resend.listContactSegmentIds(payload.email);
      if (!segmentIds.includes(env.RESEND_SEGMENT_ID)) {
        await resend.addContactToSegment(payload.email, env.RESEND_SEGMENT_ID);
      }
      const current = await resend.getContactTopics(payload.email);
      const hadProgrammes = current.some((t) => t.id === env.TOPIC_PROGRAMMES_ID && t.subscription === 'opt_in');
      await resend.updateContactTopics(payload.email, topicsFor(payload.programmes || hadProgrammes));
    }
  } catch (err) {
    deps.log({ step: 'confirm.save', status: err instanceof ResendError ? err.status : 0 });
    return html(retryPage(token), 502);
  }

  deps.log({ step: 'confirm.saved', status: 303 });
  return new Response(null, {
    status: 303,
    headers: { Location: `${SITE_URL}/subscribed/`, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  });
}
