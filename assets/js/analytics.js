// Custom product-analytics events for diyaz.dev.
//
// PostHog already records pageviews (via capture_pageview) and generic clicks
// (via autocapture), both configured in _includes/analytics.html. This module
// adds the *named* events with structured properties that make a personal blog
// measurable: what people search for, which theme they prefer, what they share,
// where they click out to, whether they actually finish reading a post, and
// whether they subscribe by email.
//
// Loaded (deferred) only when analytics is enabled, so window.posthog — at
// least its queueing stub — is always present by the time this runs. The stub
// queues capture() calls in memory and never throws, even if array.js fails to
// load, so a missing SDK degrades to lost events, never a broken page.
(function () {
  'use strict';

  if (!window.posthog) return;

  // Safe wrapper: never let an analytics call break the page. Reads
  // window.posthog at call time rather than caching it — the snippet installs a
  // stub synchronously, then array.js replaces window.posthog with the real SDK
  // once it loads, so a cached reference can go stale and silently drop events.
  function capture(event, props) {
    try {
      if (window.posthog) window.posthog.capture(event, props || {});
    } catch (e) {
      /* swallow — analytics must never affect UX */
    }
  }

  function text(el) {
    return el && el.textContent ? el.textContent.trim() : '';
  }

  // --- Delegated click tracking ------------------------------------------
  // One document-level listener handles shares, homepage tiles, search-result
  // clicks, and outbound links, so we never touch the existing feature JS. The
  // whole handler is wrapped in try/catch: it runs in capture phase on every
  // click, so a stray error here must not leak into the page's own handlers.
  document.addEventListener(
    'click',
    function (e) {
      try {
        handleClick(e);
      } catch (err) {
        /* analytics must never break a click */
      }
    },
    true // capture phase: run before any handler that navigates away
  );

  function handleClick(e) {
    var target = e.target;
    if (!target || !target.closest) return;

    // 1. Social share buttons on posts (.share-twitter / -linkedin / -copy).
    var shareBtn = target.closest('.share-btn');
    if (shareBtn) {
      var method = shareBtn.classList.contains('share-twitter')
        ? 'twitter'
        : shareBtn.classList.contains('share-linkedin')
        ? 'linkedin'
        : shareBtn.classList.contains('share-copy')
        ? 'copy_link'
        : 'other';
      capture('post_shared', {
        method: method,
        post_title: text(document.querySelector('.post-title')) || document.title,
        post_url: window.location.pathname
      });
      return; // share links are also outbound; don't double-count below
    }

    // 2. Search result selected — a *successful* search, the strongest signal.
    var result = target.closest('.search-result-item');
    if (result) {
      var input = document.getElementById('search-input');
      capture('search_result_clicked', {
        query: input ? input.value.trim() : '',
        result_title: text(result.querySelector('.search-result-title')),
        result_url: result.getAttribute('href')
      });
      return;
    }

    // 3. Homepage category tiles (DIY / HomeLab / Art) and the About tile.
    var tile = target.closest('.item-diy, .item-homelab, .item-art, .item-about');
    if (tile) {
      var name = tile.classList.contains('item-diy')
        ? 'diy'
        : tile.classList.contains('item-homelab')
        ? 'homelab'
        : tile.classList.contains('item-art')
        ? 'art'
        : 'about';
      capture('homepage_tile_clicked', { tile: name });
      // fall through: not an outbound link, so nothing else fires
    }

    // 4. Outbound links (GitHub, LinkedIn, Medium, busypipe, RSS elsewhere).
    var link = target.closest('a[href]');
    if (link) {
      var href = link.href || '';
      var isHttp = /^https?:\/\//i.test(href);
      if (isHttp && link.host && link.host !== window.location.host) {
        var context = link.closest('footer')
          ? 'footer'
          : link.closest('.medium-badge')
          ? 'medium_original'
          : link.closest('.post-content')
          ? 'post_content'
          : 'other';
        capture('outbound_link_clicked', {
          target_url: href,
          target_domain: link.hostname,
          link_text: text(link),
          location: context
        });
      }
    }
  }

  // --- Theme toggle ------------------------------------------------------
  // Listen alongside the existing toggle handler; read the resulting theme on
  // the next tick so we record what the user switched *to*.
  var themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      setTimeout(function () {
        capture('theme_changed', {
          theme: document.documentElement.getAttribute('data-theme') || 'unknown'
        });
      }, 0);
    });
  }

  // --- Search performed --------------------------------------------------
  // search.js dispatches `site:search` after each query with the true match
  // count (before it caps the displayed list at 8), so we get accurate numbers
  // without scraping the DOM or coupling to its render timing. Debounced here
  // so we log the settled query, not every keystroke.
  var searchTimer;
  document.addEventListener('site:search', function (e) {
    var detail = e.detail || {};
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      var query = (detail.query || '').trim();
      if (query.length < 2) return;
      capture('search_performed', {
        query: query,
        results_count: detail.resultsCount,
        has_results: detail.resultsCount > 0
      });
    }, 800);
  });

  // --- Email subscribe form ---------------------------------------------
  // subscribe.js dispatches `site:subscribe` after each attempt. A confirmed
  // subscription shows up as a pageview of /subscribed/ (the Worker's
  // redirect target), so no event is needed for that step.
  document.addEventListener('site:subscribe', function (e) {
    var detail = e.detail || {};
    if (detail.status === 'submitted') {
      capture('subscribe_submitted', { programmes: !!detail.programmes, location: detail.location });
    } else if (detail.status === 'failed') {
      capture('subscribe_failed', { reason: detail.reason, location: detail.location });
    }
  });

  // --- Post read completion ---------------------------------------------
  // On post pages only, fire once when the share section scrolls into view —
  // a reliable "reader reached the end" signal, better than raw scroll depth.
  var article = document.querySelector('.article-post');
  var endMarker = document.querySelector('.share-section');
  if (article && endMarker && 'IntersectionObserver' in window) {
    var readTimeEl = document.querySelector('.read-time');
    var readMinutes = readTimeEl ? parseInt(text(readTimeEl), 10) || null : null;
    var tags = Array.prototype.map.call(
      document.querySelectorAll('.post-tags .tag'),
      function (t) {
        return text(t);
      }
    );

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          // Require an actual scroll: on a short post whose end is already on
          // screen at load, the observer would otherwise fire immediately and
          // count a "read" the reader never scrolled through.
          if (entry.isIntersecting && window.scrollY > 0) {
            capture('post_read_completed', {
              post_title: text(document.querySelector('.post-title')) || document.title,
              post_url: window.location.pathname,
              read_time_minutes: readMinutes,
              tags: tags
            });
            observer.disconnect(); // once per pageview
          }
        });
      },
      { threshold: 0.5 }
    );
    observer.observe(endMarker);
  }
})();
