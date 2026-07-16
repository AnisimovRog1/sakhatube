/*
 * Public runtime configuration. This file deliberately contains no secrets.
 *
 * To turn on Firebase, inject/replace `window.__SAKHATUBE_RUNTIME_CONFIG__`
 * during deployment with:
 * {
 *   auth: { provider: 'firebase' },
 *   firebase: { enabled: true, config: { apiKey, authDomain, projectId, appId } }
 * }
 * Firebase web configuration values identify the client project; they are not
 * private keys. Keep service-account credentials only on the server.
 */
window.__SAKHATUBE_RUNTIME_CONFIG__ = Object.freeze(window.__SAKHATUBE_RUNTIME_CONFIG__ || {
  auth: Object.freeze({ provider: 'server' }),
  firebase: Object.freeze({ enabled: false, config: null })
});
