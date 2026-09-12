const TOKEN_KEY = 'questfam_token';

// In dev this stays '/api' and Vite proxies to the local server. In a deployed
// build it is the API's own origin, because the SPA is served from GitHub Pages
// while the API runs elsewhere. Set VITE_API_BASE_URL at build time.
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

// A relative base only resolves behind the dev proxy. Served from anywhere else
// it points at the static host, which answers every POST with 405 — so detect
// the misconfiguration here rather than letting it surface as a stray status.
export const apiIsConfigured =
  API_BASE.startsWith('http') ||
  ['localhost', '127.0.0.1'].includes(globalThis.location?.hostname);

const NOT_CONFIGURED =
  'This site has no API connected yet, so accounts and XP cannot be saved. ' +
  'Whoever deployed it needs to set VITE_API_BASE_URL to a running API.';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = 'GET', body } = {}) {
  if (!apiIsConfigured) throw new Error(NOT_CONFIGURED);

  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    // Network-level failure: server asleep, down, or blocked by CORS.
    throw new Error(
      "Can't reach the server. If it's hosted on a free tier it may be waking up — try again in a moment."
    );
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    const message = data?.error || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  del: (path) => request(path, { method: 'DELETE' }),
};
