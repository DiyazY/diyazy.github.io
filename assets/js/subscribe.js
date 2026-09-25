// Email subscribe form (see _includes/subscribe.html and workers/subscribe/).
//
// Turnstile is loaded lazily, on the reader's first touch of the form (or on
// submit), and its check runs only on submit (execution: 'execute'). Readers
// who never use the form never load it, which is what /privacy/ promises.
// Tokens are single-use, so the widget is reset after every attempt.
//
// Analytics stay decoupled: this dispatches `site:subscribe` events and
// analytics.js turns them into PostHog captures, like `site:search`.
// Tested in workers/subscribe/test/site-subscribe.test.ts.
(function () {
  'use strict';

  // No integrity= on purpose: Cloudflare updates api.js in place and requires
  // loading it from this exact URL, so a pinned SRI hash would break the form
  // on their next release (same as the PostHog loader).
  var TURNSTILE_API = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onSubscribeTurnstileLoad';
  var TOKEN_TIMEOUT_MS = 20000;
  var REQUEST_TIMEOUT_MS = 20000;
  var LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  var MESSAGES = {
    ok: 'Almost done: check your inbox and click the link to confirm.',
    checking: "Checking you're not a bot…",
    sending: 'Sending…',
    validation: "That email address doesn't look right.",
    turnstile: "Couldn't verify you're human. Please try again.",
    rate_limit: 'Too many attempts. Please wait a minute and try again.',
    server: 'Something went wrong on my side. Please try again later.',
    network: "Couldn't reach the server. Check your connection and try again.",
    pending: 'The bot check is taking too long. Please try again.',
    blocked: "The bot check didn't load (an ad blocker?). Allow challenges.cloudflare.com, or follow the",
    widget: "The bot check couldn't start. Reload the page, or follow the"
  };
  // These messages end with a link to the RSS feed.
  var RSS_LINKED = { blocked: true, widget: true };
  // Must match SubscribeError in workers/subscribe/src/handlers/subscribe.ts.
  var SERVER_REASONS = ['validation', 'turnstile', 'rate_limit', 'server'];

  var forms = Array.prototype.slice.call(document.querySelectorAll('[data-subscribe-form]'));
  if (!forms.length) return;

  var turnstileState = 'idle'; // idle | loading | ready | failed

  function loadTurnstile() {
    if (turnstileState !== 'idle') return;
    turnstileState = 'loading';
    var script = document.createElement('script');
    script.src = TURNSTILE_API;
    script.async = true;
    script.onerror = function () {
      turnstileState = 'failed';
      forms.forEach(function (form) {
        if (form._pending) fail(form, 'blocked');
      });
    };
    document.head.appendChild(script);
  }

  // Called by api.js via ?onload=.
  window.onSubscribeTurnstileLoad = function () {
    turnstileState = 'ready';
    forms.forEach(function (form) {
      form._widgetId = window.turnstile.render(form.querySelector('.subscribe-turnstile'), {
        sitekey: form.getAttribute('data-sitekey'),
        action: 'subscribe',
        appearance: 'interaction-only',
        execution: 'execute',
        callback: function (token) {
          if (form._pending) send(form, token);
        },
        'error-callback': function (code) {
          // Without this, a misconfigured widget (e.g. hostname not allowed)
          // would leave the reader on "checking" until the timeout.
          if (form._pending) fail(form, 'widget', { code: String(code) });
          return true; // handled; Turnstile needn't log it
        }
      });
      if (form._pending) window.turnstile.execute(form._widgetId);
    });
  };

  forms.forEach(function (form) {
    // First sign of intent loads Turnstile, so it's usually ready by submit.
    form.addEventListener('focusin', loadTurnstile);
    form.addEventListener('pointerdown', loadTurnstile);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      submit(form);
    });
  });

  function setStatus(form, kind, text, withRssLink) {
    var el = form.querySelector('.subscribe-status');
    el.textContent = text;
    if (withRssLink) {
      var link = document.createElement('a');
      link.href = form.getAttribute('data-rss') || '/feed.xml';
      link.textContent = 'RSS feed';
      el.appendChild(document.createTextNode(' '));
      el.appendChild(link);
      el.appendChild(document.createTextNode(' instead.'));
    }
    el.setAttribute('data-kind', kind);
  }

  function emit(form, detail) {
    detail.location = form.getAttribute('data-location') || 'post';
    try {
      document.dispatchEvent(new CustomEvent('site:subscribe', { detail: detail }));
    } catch (err) {
      /* analytics only */
    }
  }

  function begin(form) {
    form._pending = true;
    form.querySelector('button[type="submit"]').disabled = true;
  }

  function end(form) {
    form._pending = false;
    clearTimeout(form._tokenTimer);
    form.querySelector('button[type="submit"]').disabled = false;
    if (turnstileState === 'ready' && form._widgetId != null) window.turnstile.reset(form._widgetId);
  }

  function fail(form, reason, extra) {
    end(form);
    setStatus(form, 'error', MESSAGES[reason], RSS_LINKED[reason]);
    var detail = { status: 'failed', reason: reason };
    if (extra) for (var key in extra) detail[key] = extra[key];
    emit(form, detail);
  }

  function succeed(form, programmes) {
    end(form);
    setStatus(form, 'ok', MESSAGES.ok);
    form.elements.email.value = '';
    emit(form, { status: 'submitted', programmes: programmes });
  }

  function submit(form) {
    if (form._pending) return; // one attempt at a time
    var email = form.elements.email;
    var value = email.value.trim();
    // Check locally first so a typo doesn't spend a single-use bot-check token.
    if (!LOOKS_LIKE_EMAIL.test(value) || !email.checkValidity()) return fail(form, 'validation');
    if (turnstileState === 'failed') return fail(form, 'blocked');

    begin(form);
    setStatus(form, 'busy', MESSAGES.checking);
    form._tokenTimer = setTimeout(function () {
      if (form._pending) fail(form, 'pending');
    }, TOKEN_TIMEOUT_MS);
    loadTurnstile();
    // Not ready yet: onSubscribeTurnstileLoad executes pending forms.
    if (turnstileState === 'ready') window.turnstile.execute(form._widgetId);
  }

  function send(form, token) {
    clearTimeout(form._tokenTimer);
    setStatus(form, 'busy', MESSAGES.sending);
    var programmes = form.elements.programmes.checked;
    var body = new URLSearchParams();
    body.set('email', form.elements.email.value);
    body.set('programmes', programmes ? '1' : '');
    body.set('hp', form.elements.hp.value);
    body.set('cf-turnstile-response', token);

    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () {
      if (controller) controller.abort();
    }, REQUEST_TIMEOUT_MS);

    // URLSearchParams body = form-encoded "simple" request: no CORS preflight.
    // Network failures (offline, blocked, timed out, CORS) are told apart from
    // answers the server gave, and from answers that aren't JSON at all.
    fetch(form.getAttribute('data-endpoint'), { method: 'POST', body: body, signal: controller ? controller.signal : undefined })
      .then(
        function (res) {
          return res.json().then(
            function (data) {
              return { status: res.status, data: data || {} };
            },
            function () {
              return { status: res.status, data: {} };
            }
          );
        },
        function () {
          return { status: 0, data: { error: 'network' } };
        }
      )
      .then(function (r) {
        clearTimeout(timer);
        if (r.status === 200 && r.data.ok === true) return succeed(form, programmes);
        var known = r.data.error === 'network' || SERVER_REASONS.indexOf(r.data.error) >= 0;
        fail(form, known ? r.data.error : 'server', r.status ? { http_status: r.status } : undefined);
      });
  }
})();
