// Email subscribe form (see _includes/subscribe.html and workers/subscribe/).
//
// Turnstile is rendered explicitly so each form keeps its widget id: tokens
// are single-use, so the widget is reset after every attempt. This file loads
// (synchronously, after the form markup) before Turnstile's async api.js, so
// the onload callback below always exists when api.js calls it.
//
// Analytics stay decoupled: this dispatches `site:subscribe` events and
// analytics.js turns them into PostHog captures, like `site:search`.
(function () {
  'use strict';

  var MESSAGES = {
    ok: 'Almost done: check your inbox and click the link to confirm.',
    validation: "That email address doesn't look right.",
    turnstile: "Couldn't verify you're human. Please try again.",
    rate_limit: 'Too many attempts. Please wait a minute and try again.',
    server: 'Something went wrong on my side. Please try again later.',
    pending: 'One moment: still checking you are not a bot. Try again in a second.',
    blocked: "The bot check didn't load (an ad blocker?). Allow challenges.cloudflare.com, or follow the RSS feed instead."
  };
  var SERVER_REASONS = ['validation', 'turnstile', 'rate_limit', 'server'];

  var forms = Array.prototype.slice.call(document.querySelectorAll('[data-subscribe-form]'));
  if (!forms.length) return;

  // Called by api.js via ?onload=.
  window.onSubscribeTurnstileLoad = function () {
    forms.forEach(function (form) {
      form._widgetId = window.turnstile.render(form.querySelector('.subscribe-turnstile'), {
        sitekey: form.getAttribute('data-sitekey'),
        action: 'subscribe',
        appearance: 'interaction-only'
      });
    });
  };

  forms.forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      submit(form);
    });
  });

  function setStatus(form, kind, text) {
    var el = form.querySelector('.subscribe-status');
    el.textContent = text;
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

  function fail(form, reason) {
    setStatus(form, 'error', MESSAGES[reason]);
    emit(form, { status: 'failed', reason: reason });
  }

  function submit(form) {
    // No Turnstile at all (script blocked) vs. not finished yet: both must
    // tell the reader what to do, and neither sends a request.
    if (!window.turnstile || form._widgetId == null) return fail(form, 'blocked');
    var token = window.turnstile.getResponse(form._widgetId);
    if (!token) return fail(form, 'pending');

    var button = form.querySelector('button[type="submit"]');
    var programmes = form.elements.programmes.checked;
    var body = new URLSearchParams();
    body.set('email', form.elements.email.value);
    body.set('programmes', programmes ? '1' : '');
    body.set('hp', form.elements.hp.value);
    body.set('cf-turnstile-response', token);

    button.disabled = true;
    setStatus(form, 'busy', 'Sending…');

    // URLSearchParams body = form-encoded "simple" request: no CORS preflight.
    fetch(form.getAttribute('data-endpoint'), { method: 'POST', body: body })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          return { status: res.status, data: data };
        });
      })
      .then(function (r) {
        if (r.status === 200 && r.data.ok) {
          setStatus(form, 'ok', MESSAGES.ok);
          form.elements.email.value = '';
          emit(form, { status: 'submitted', programmes: programmes });
        } else {
          fail(form, SERVER_REASONS.indexOf(r.data.error) >= 0 ? r.data.error : 'server');
        }
      })
      .catch(function () {
        fail(form, 'server');
      })
      .then(function () {
        button.disabled = false;
        window.turnstile.reset(form._widgetId);
      });
  }
})();
