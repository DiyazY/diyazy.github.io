// Custom product-analytics events for diyaz.dev.
//
// PostHog autocapture (configured in _includes/analytics.html) already records
// pageviews and generic clicks. This module adds the *named* events with
// structured properties that make a personal blog measurable: what people
// search for, which theme they prefer, what they share, where they click out
// to, and whether they actually finish reading a post.
//
// Loaded (deferred) only when analytics is enabled, so window.posthog — at
// least its queueing stub — is always present by the time this runs.
(function () {
  'use strict';

  var ph = window.posthog;
  if (!ph) return;

  // Safe wrapper: never let an analytics call break the page.
  function capture(event, props) {
    try {
      ph.capture(event, props || {});
    } catch (e) {
      /* swallow — analytics must never affect UX */
    }
  }

  function text(el) {
    return el && el.textContent ? el.textContent.trim() : '';
  }

  // --- Delegated click tracking ------------------------------------------
  // One document-level listener handles shares, homepage tiles, search-result
  // clicks, and outbound links, so we never touch the existing feature JS.
  document.addEventListener(
    'click',
    function (e) {
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
    },
    true // capture phase: run before any handler that navigates away
  );

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
  // The search index lives client-side, so we can capture what people look for.
  // Debounced well past search.js's 200ms render so results are on the page,
  // and only for meaningful queries (>= 2 chars, same threshold as search.js).
  var searchInput = document.getElementById('search-input');
  if (searchInput) {
    var searchTimer;
    searchInput.addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        var query = searchInput.value.trim();
        if (query.length < 2) return;
        var count = document.querySelectorAll('#search-results .search-result-item').length;
        capture('search_performed', {
          query: query,
          results_count: count,
          has_results: count > 0
        });
      }, 800);
    });
  }

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
          if (entry.isIntersecting) {
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
