// GET shows a button; only the POST it submits saves anything. Email link
// scanners (Safe Links, Mimecast, ...) open every GET in a message, so a
// subscribe-on-GET would confirm people who never clicked.
import { SITE_URL } from '../config.ts';
import type { Deps, Env } from '../env.ts';
import { configProblems } from '../env.ts';
import { html } from '../http.ts';
import { confirmPage, errorPage, expiredPage, heldPage, retryPage } from '../pages.ts';
import { ResendError, createResendClient, errorLogFields } from '../resend.ts';
import type { ResendClient, TopicSubscription } from '../resend.ts';
import { readToken } from '../token.ts';

export function handleConfirmGet(request: Request): Response {
  const token = new URL(request.url).searchParams.get('t') ?? '';
  if (!token) return html(expiredPage(), 400);
  return html(confirmPage(token), 200);
}

export async function handleConfirmPost(request: Request, env: Env, deps: Deps): Promise<Response> {
  const problems = configProblems(env);
  if (problems.length > 0) {
    deps.log({ step: 'confirm.config', status: 500, reason: problems.join('+') });
    return html(errorPage(), 500);
  }

  let token = '';
  try {
    token = String((await request.formData()).get('t') ?? '');
  } catch {
    // No form body: treated as a missing token below.
  }

  const check = await readToken(token, env.TOKEN_KEY, deps.now());
  if (!check.ok) {
    deps.log({ step: 'confirm.token', status: 400, reason: check.reason });
    return html(expiredPage(), 400);
  }
  const { email, programmes } = check.payload;

  const resend = createResendClient({ apiKey: env.RESEND_API_KEY, fetch: deps.fetch, sleep: deps.sleep });
  const step = { call: 'getContact' }; // which Resend call is in flight, for the log
  let outcome: SaveOutcome;
  try {
    outcome = await saveSubscriber(resend, env, email, programmes, step);
  } catch (err) {
    const { status, reason } = errorLogFields(err);
    deps.log({ step: 'confirm.save', status, call: step.call, reason });
    return html(retryPage(token), 502);
  }

  if (outcome === 'held') {
    deps.log({ step: 'confirm.held', status: 200, reason: 'unsubscribed' });
    return html(heldPage(), 200);
  }
  deps.log({ step: 'confirm.saved', status: 303 });
  return new Response(null, {
    status: 303,
    headers: { Location: `${SITE_URL}/subscribed/`, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  });
}

// 'held': the contact had used "unsubscribe from all". Their choices are
// recorded, but the flag stays: the Resend team is shared with Diyaz's other
// products, so lifting it would restart those emails too. Diyaz lifts it by
// hand after the reader replies (spec §6.4).
type SaveOutcome = 'subscribed' | 'held';

// The form only ever adds opt-ins. New contacts get New posts, plus Programmes
// only when ticked (otherwise the topic's opt_out default applies; the
// Programmes topic must be created as opt_out in Resend, spec §5).
async function saveSubscriber(
  resend: ResendClient,
  env: Env,
  email: string,
  programmes: boolean,
  step: { call: string },
): Promise<SaveOutcome> {
  const optIns = (withProgrammes: boolean): TopicSubscription[] => [
    { id: env.TOPIC_NEW_POSTS_ID, subscription: 'opt_in' },
    ...(withProgrammes ? [{ id: env.TOPIC_PROGRAMMES_ID, subscription: 'opt_in' as const }] : []),
  ];

  step.call = 'getContact';
  let existing = await resend.getContact(email);
  if (!existing) {
    step.call = 'createContact';
    try {
      await resend.createContact({
        email,
        unsubscribed: false,
        segments: [{ id: env.RESEND_SEGMENT_ID }],
        topics: optIns(programmes),
      });
      return 'subscribed';
    } catch (err) {
      // Two confirms of the same link racing (a double click): both saw 404
      // and the other one created the contact first. Carry on as an update.
      if (!(err instanceof ResendError) || err.status < 400 || err.status >= 500) throw err;
      step.call = 'getContact';
      existing = await resend.getContact(email);
      if (!existing) {
        step.call = 'createContact'; // not a race after all: report the create's failure
        throw err;
      }
    }
  }

  // Read before writing: Resend documents neither its answer to a duplicate
  // segment add nor whether a topics PATCH replaces the whole list.
  step.call = 'listContactSegmentIds';
  if (!(await resend.listContactSegmentIds(email)).includes(env.RESEND_SEGMENT_ID)) {
    step.call = 'addContactToSegment';
    await resend.addContactToSegment(email, env.RESEND_SEGMENT_ID);
  }

  step.call = 'getContactTopics';
  const current = await resend.getContactTopics(email);
  // Carry over a Programmes opt-in only from a reader who is still subscribed:
  // after "unsubscribe from all", a leftover topic opt-in is not consent.
  const keepProgrammes =
    !existing.unsubscribed &&
    current.some((t) => t.id === env.TOPIC_PROGRAMMES_ID && t.subscription === 'opt_in');
  const topics = optIns(programmes || keepProgrammes);
  if (existing.unsubscribed && !programmes) {
    // The one opt_out this form writes: it restores the reader's own last choice,
    // so the stale opt-in can't come back when Diyaz lifts the global flag.
    topics.push({ id: env.TOPIC_PROGRAMMES_ID, subscription: 'opt_out' });
  }
  step.call = 'updateContactTopics';
  await resend.updateContactTopics(email, topics);

  return existing.unsubscribed ? 'held' : 'subscribed';
}
