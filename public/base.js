// base.js
// Base-path helper for GitHub Pages.
// The site is served from https://blane-h.github.io/Fidel/, so absolute
// paths like "/styles.css" or "/api/..." will not resolve. This computes the
// correct base path automatically and exposes helpers for building URLs.
(function (global) {
  'use strict';

  // Determine the base path. On GitHub Pages the repo is served under "/Fidel/".
  // We derive it from the current script src, which is reliable.
  // Fallbacks: <base href> tag, or a trailing slash path.
  function detectBasePath() {
    // Prefer an explicit <base href> if present.
    const baseTag = document.querySelector('base[href]');
    if (baseTag && baseTag.getAttribute('href')) {
      return baseTag.getAttribute('href');
    }

    // Derive from this script's src attribute.
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i += 1) {
      const src = scripts[i].getAttribute('src') || '';
      const idx = src.lastIndexOf('base.js');
      if (idx !== -1) {
        let base = src.slice(0, idx);
        // Ensure it ends with a slash.
        if (base && !base.endsWith('/')) base += '/';
        return base;
      }
    }

    // Fallback: use the current path up to the last slash.
    const path = global.location.pathname;
    const lastSlash = path.lastIndexOf('/');
    return lastSlash === -1 ? '/' : path.slice(0, lastSlash + 1);
  }

  const BASE = detectBasePath();

  // Resolve a project-relative path (e.g. "styles.css" or "data.js").
  function url(relPath) {
    const clean = String(relPath || '').replace(/^\/+/, '');
    return BASE + clean;
  }

  // Resolve for a fetch() call. data.js is a script, so we fetch the file as text.
  // For JSON we could point to static files, but here we just return the url.
  function fileUrl(relPath) {
    return url(relPath);
  }

  global.FidelBase = {
    base: BASE,
    url,
    fileUrl
  };
})(typeof window !== 'undefined' ? window : globalThis);
