// Simple Jekyll Search
(function() {
  'use strict';

  let searchIndex = [];
  let searchInput, searchResults, searchWrapper;

  // Initialize search
  function init() {
    searchInput = document.getElementById('search-input');
    searchResults = document.getElementById('search-results');
    searchWrapper = document.querySelector('.search-wrapper');

    if (!searchInput || !searchResults) return;

    // Load search index
    fetch('/search.json')
      .then(response => response.json())
      .then(data => {
        searchIndex = data;
      })
      .catch(err => console.error('Error loading search index:', err));

    // Event listeners
    searchInput.addEventListener('input', debounce(performSearch, 200));
    searchInput.addEventListener('focus', () => searchWrapper?.classList.add('focused'));
    searchInput.addEventListener('blur', () => {
      setTimeout(() => searchWrapper?.classList.remove('focused'), 200);
    });

    // Keyboard shortcut: / to focus search
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== searchInput) {
        e.preventDefault();
        searchInput.focus();
      }
      // Escape to clear and blur
      if (e.key === 'Escape' && document.activeElement === searchInput) {
        searchInput.value = '';
        searchResults.innerHTML = '';
        searchResults.classList.remove('visible');
        searchInput.blur();
      }
    });

    // Close results when clicking outside
    document.addEventListener('click', (e) => {
      if (!searchWrapper?.contains(e.target)) {
        searchResults.classList.remove('visible');
      }
    });
  }

  // Perform search
  function performSearch() {
    const query = searchInput.value.toLowerCase().trim();

    if (query.length < 2) {
      searchResults.innerHTML = '';
      searchResults.classList.remove('visible');
      return;
    }

    const results = searchIndex.filter(item => {
      const titleMatch = item.title.toLowerCase().includes(query);
      const contentMatch = item.content.toLowerCase().includes(query);
      const tagsMatch = item.tags && item.tags.toLowerCase().includes(query);
      return titleMatch || contentMatch || tagsMatch;
    }).slice(0, 8); // Limit to 8 results

    displayResults(results, query);
  }

  // Display search results
  function displayResults(results, query) {
    if (results.length === 0) {
      searchResults.innerHTML = '<div class="search-no-results">No results found</div>';
      searchResults.classList.add('visible');
      return;
    }

    const html = results.map(item => {
      const excerpt = getExcerpt(item.content, query);
      return `
        <a href="${item.url}" class="search-result-item">
          <div class="search-result-title">${highlightMatch(item.title, query)}</div>
          <div class="search-result-excerpt">${highlightMatch(excerpt, query)}</div>
          ${item.date ? `<div class="search-result-date">${item.date}</div>` : ''}
        </a>
      `;
    }).join('');

    searchResults.innerHTML = html;
    searchResults.classList.add('visible');
  }

  // Get excerpt around the query match
  function getExcerpt(content, query) {
    const index = content.toLowerCase().indexOf(query);
    if (index === -1) return content.substring(0, 120) + '...';

    const start = Math.max(0, index - 40);
    const end = Math.min(content.length, index + query.length + 80);
    let excerpt = content.substring(start, end);

    if (start > 0) excerpt = '...' + excerpt;
    if (end < content.length) excerpt = excerpt + '...';

    return excerpt;
  }

  // Highlight matching text
  function highlightMatch(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  // Escape regex special characters
  function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Debounce function
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
