// @vitest-environment happy-dom
// Browser tests for the site's form script (assets/js/subscribe.js), run
// against markup shaped like _includes/subscribe.html. Turnstile and fetch are
// stubbed; appending the api.js <script> is intercepted so nothing loads.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Vitest runs from workers/subscribe (npm test, and the CI worker job).
const SCRIPT = readFileSync(resolve(process.cwd(), '../../assets/js/subscribe.js'), 'utf8');

const MARKUP = `
<form class="subscribe-form" data-subscribe-form data-location="post"
      data-endpoint="https://subscribe.diyaz.dev/subscribe" data-sitekey="1x00000000000000000000AA"
      data-rss="/feed.xml" novalidate>
  <input type="email" name="email" required>
  <button type="submit">Subscribe</button>
  <label><input type="checkbox" name="programmes" value="1"></label>
  <div class="subscribe-hp"><input type="text" name="hp"></div>
  <div class="subscribe-turnstile"></div>
  <p class="subscribe-status" role="status"></p>
  <p class="subscribe-note">You'll get an email to confirm. <a href="/privacy/">Privacy</a></p>
</form>`;

interface WidgetOptions {
  sitekey: string;
  action: string;
  execution: string;
  appearance: string;
  callback: (token: string) => void;
  'error-callback': (code: string) => boolean;
}

type Win = Window & {
  turnstile?: unknown;
  onSubscribeTurnstileLoad?: () => void;
};

let appended: HTMLScriptElement[];
let events: Record<string, unknown>[] = [];
// Registered once: a listener per test would keep feeding earlier tests' handlers.
document.addEventListener('site:subscribe', (e) => events.push((e as CustomEvent).detail));
let fetchMock: ReturnType<typeof vi.fn>;

const win = () => window as unknown as Win;
const form = () => document.querySelector('form') as HTMLFormElement;
const status = () => document.querySelector('.subscribe-status') as HTMLElement;
const button = () => document.querySelector('button') as HTMLButtonElement;

function fakeTurnstile() {
  const widgets = new Map<string, WidgetOptions>();
  return {
    widgets,
    render: vi.fn((_el: Element, options: WidgetOptions) => {
      widgets.set('w1', options);
      return 'w1';
    }),
    execute: vi.fn(),
    reset: vi.fn(),
    getResponse: vi.fn(() => ''),
  };
}

function typeEmail(value: string) {
  (form().elements.namedItem('email') as HTMLInputElement).value = value;
}

function submit() {
  form().dispatchEvent(new Event('submit', { cancelable: true }));
}

function loadTurnstile() {
  const ts = fakeTurnstile();
  win().turnstile = ts;
  win().onSubscribeTurnstileLoad!();
  return ts;
}

function answer(status: number, body: unknown) {
  fetchMock.mockResolvedValueOnce(
    new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = MARKUP;
  delete win().turnstile;
  delete win().onSubscribeTurnstileLoad;
  appended = [];
  vi.spyOn(document.head, 'appendChild').mockImplementation(<T extends Node>(node: T): T => {
    appended.push(node as unknown as HTMLScriptElement);
    return node;
  });
  events = [];
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  new Function(SCRIPT)();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('subscribe form script', () => {
  it('does not load Turnstile until the reader touches the form, and loads it once', () => {
    expect(appended).toHaveLength(0);
    const input = form().elements.namedItem('email') as HTMLInputElement;
    input.dispatchEvent(new Event('focusin', { bubbles: true }));
    input.dispatchEvent(new Event('focusin', { bubbles: true }));
    expect(appended).toHaveLength(1);
    expect(appended[0].src).toContain('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');
  });

  it('does not load Turnstile when the reader only clicks or tabs to the Privacy link', () => {
    const link = document.querySelector('.subscribe-note a') as HTMLAnchorElement;
    link.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    link.dispatchEvent(new Event('focusin', { bubbles: true }));
    expect(appended).toHaveLength(0);
  });

  it('checks the address locally before spending a bot check', () => {
    typeEmail('nope');
    submit();
    expect(status().textContent).toBe("That email address doesn't look right.");
    expect(appended).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(events).toEqual([{ status: 'failed', reason: 'validation', location: 'post' }]);
  });

  it('shows the ad-blocker message with an RSS link when api.js fails to load, and sends nothing', () => {
    form().dispatchEvent(new Event('focusin', { bubbles: true }));
    appended[0].onerror!(new Event('error'));
    typeEmail('reader@example.com');
    submit();
    expect(status().textContent).toContain("The bot check didn't load");
    expect(status().querySelector('a')!.getAttribute('href')).toBe('/feed.xml');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('runs the check on submit once Turnstile loads, then sends the form', async () => {
    typeEmail(' reader@example.com ');
    (form().elements.namedItem('programmes') as HTMLInputElement).checked = true;
    submit();
    expect(appended).toHaveLength(1); // a submit also triggers the lazy load
    expect(button().disabled).toBe(true);

    const ts = loadTurnstile();
    expect(ts.render).toHaveBeenCalledTimes(1);
    expect(ts.widgets.get('w1')).toMatchObject({ action: 'subscribe', execution: 'execute', appearance: 'interaction-only' });
    expect(ts.execute).toHaveBeenCalledWith('w1');

    answer(200, { ok: true });
    ts.widgets.get('w1')!.callback('tok');
    await vi.waitFor(() => expect(status().textContent).toBe('Almost done: check your inbox and click the link to confirm.'));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://subscribe.diyaz.dev/subscribe');
    const body = new URLSearchParams(String(init.body));
    expect(Object.fromEntries(body)).toEqual({
      email: 'reader@example.com', // type=email inputs strip surrounding spaces (HTML value sanitization)
      programmes: '1',
      hp: '',
      'cf-turnstile-response': 'tok',
    });
    expect(ts.reset).toHaveBeenCalledWith('w1');
    expect(button().disabled).toBe(false);
    expect(events).toEqual([{ status: 'submitted', programmes: true, location: 'post' }]);
    expect(JSON.stringify(events)).not.toContain('@');
  });

  it('shows a way out when the widget errors, instead of "still checking" forever', () => {
    const ts = loadTurnstile();
    typeEmail('reader@example.com');
    submit();
    ts.widgets.get('w1')!['error-callback']('110200');
    expect(status().textContent).toContain("The bot check couldn't start");
    expect(status().querySelector('a')).not.toBeNull();
    expect(button().disabled).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(events).toEqual([{ status: 'failed', reason: 'widget', code: '110200', location: 'post' }]);
  });

  it('turns each kind of server answer into its own message', async () => {
    const cases: [() => void, string, string][] = [
      [() => answer(429, { ok: false, error: 'rate_limit' }), 'rate_limit', 'Too many attempts'],
      [() => answer(400, { ok: false, error: 'validation' }), 'validation', "doesn't look right"],
      [() => answer(403, { ok: false, error: 'turnstile' }), 'turnstile', "Couldn't verify you're human"],
      [() => answer(500, '<html>Error 1101</html>'), 'server', 'Something went wrong on my side'],
      [() => fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch')), 'network', "Couldn't reach the server"],
    ];
    const ts = loadTurnstile();
    for (const [arrange, reason, text] of cases) {
      events.length = 0;
      arrange();
      typeEmail('reader@example.com');
      submit();
      ts.widgets.get('w1')!.callback('tok');
      await vi.waitFor(() => expect(status().textContent).toContain(text));
      expect(events[0]).toMatchObject({ status: 'failed', reason });
      expect(button().disabled).toBe(false);
    }
  });

  it('gives up on a bot check that never answers', () => {
    vi.useFakeTimers();
    loadTurnstile();
    typeEmail('reader@example.com');
    submit();
    vi.advanceTimersByTime(20_000);
    expect(status().textContent).toBe('The bot check is taking too long. Please try again.');
    expect(button().disabled).toBe(false);
    expect(events).toEqual([{ status: 'failed', reason: 'pending', location: 'post' }]);
  });
});
