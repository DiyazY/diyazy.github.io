// Theme Toggle - Dark/Light Mode
(function() {
  'use strict';

  const STORAGE_KEY = 'theme-preference';

  // Get theme preference
  function getThemePreference() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;

    // Check system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  // Set theme
  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
    updateToggleButton(theme);
    updateGiscusTheme(theme);
  }

  // Update toggle button icon
  function updateToggleButton(theme) {
    const toggle = document.getElementById('theme-toggle');
    if (!toggle) return;

    const sunIcon = toggle.querySelector('.icon-sun');
    const moonIcon = toggle.querySelector('.icon-moon');

    if (theme === 'dark') {
      sunIcon?.classList.remove('hidden');
      moonIcon?.classList.add('hidden');
      toggle.setAttribute('aria-label', 'Switch to light mode');
    } else {
      sunIcon?.classList.add('hidden');
      moonIcon?.classList.remove('hidden');
      toggle.setAttribute('aria-label', 'Switch to dark mode');
    }
  }

  // Update Giscus theme if present
  function updateGiscusTheme(theme) {
    const giscusFrame = document.querySelector('iframe.giscus-frame');
    if (giscusFrame) {
      giscusFrame.contentWindow.postMessage(
        { giscus: { setConfig: { theme: theme === 'dark' ? 'dark' : 'light' } } },
        'https://giscus.app'
      );
    }
  }

  // Toggle theme
  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') ||
                    getThemePreference();
    const next = current === 'dark' ? 'light' : 'dark';
    setTheme(next);
  }

  // Initialize
  function init() {
    // Set initial theme immediately (before DOM ready to prevent flash)
    const theme = getThemePreference();
    document.documentElement.setAttribute('data-theme', theme);

    // Wait for DOM to set up toggle button
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        updateToggleButton(theme);
        setupToggle();
      });
    } else {
      updateToggleButton(theme);
      setupToggle();
    }

    // Listen for system preference changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    });
  }

  // Setup toggle button
  function setupToggle() {
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
      toggle.addEventListener('click', toggleTheme);
    }
  }

  // Run immediately
  init();
})();
