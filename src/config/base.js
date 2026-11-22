// The sub-folder the website is served from: '' on Render, '/moes2' on
// GitHub Pages. Set at build time with EXPO_PUBLIC_BASE_URL.
export const BASE_PATH = (process.env.EXPO_PUBLIC_BASE_URL || '').replace(/\/$/, '');

/** Full address of a page on this site, e.g. siteUrl('/updates/1'). */
export const siteUrl = (path = '/') =>
  `${typeof window !== 'undefined' ? window.location.origin : ''}${BASE_PATH}${path}`;

/** Remove the sub-folder from a browser path before route matching. */
export const stripBase = (path) =>
  BASE_PATH && path.startsWith(BASE_PATH) ? path.slice(BASE_PATH.length) || '/' : path;
