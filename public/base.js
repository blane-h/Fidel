// base.js
// Base-path helper for GitHub Pages.
// The site is served from https://blane-h.github.io/Fidel/, so absolute
// paths like "/styles.css" or "/api/..." will not resolve. This computes the
// correct base path automatically and exposes helpers for building URLs.
(function (global) {
  'use strict';

  // Determine the base path. On GitHub Pages the repo is served under "/Fidel/".
  // We derive it from the current page pathname, which is reliable whether
  // base.js is loaded as "/base.js" or "/Fidel/base.js".
  // Overrides: <base href> tag, or an explicit subpath in base.js's own src.
  function detectBasePath() {
    // Prefer an explicit <base href> if present.
    const baseTag = document.querySelector('base[href]');
    if (baseTag && baseTag.getAttribute('href')) {
      return baseTag.getAttribute('href');
    }

    // Derive from this script's src attribute when it reveals a subpath.
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i += 1) {
      const src = scripts[i].getAttribute('src') || '';
      const idx = src.lastIndexOf('base.js');
      if (idx !== -1) {
        let base = src.slice(0, idx);
        // Ensure it ends with a slash.
        if (base && !base.endsWith('/')) base += '/';
        // Only trust script-derived base when it is a real subpath.
        // A root-relative "/base.js" yields an empty base here, so we fall
        // back to location.pathname instead.
        // Also ignore numeric routes like /1/, /2/, /3/, /4/ which are
        // app pages, not deployment subpaths.
        if (base && base !== '/' && !/^\/[1-4]\/$/.test(base)) {
          return base;
        }
      }
    }

    // Fallback: use the current page path up to the last slash.
    const path = global.location.pathname;
    const lastSlash = path.lastIndexOf('/');
    let base = lastSlash === -1 ? '/' : path.slice(0, lastSlash + 1);

    // Treat simple numeric routes like /1, /2, /3, /4 as root-level pages,
    // not as deployment subpaths.
    if (/^\/[1-4]$/.test(path)) {
      base = '/';
    }

    return base;
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
