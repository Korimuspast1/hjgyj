/**
 * Neon Dash — API client.
 *
 * Thin wrapper around fetch() talking to the companion server (server/app.py).
 * Every call resolves to { ok, data, status } and NEVER throws for network
 * problems — offline handling is a first-class feature, not an error path.
 */
/* global GD */
GD.register('net', function (GD) {
  'use strict';

  var N = {};

  /** Resolved base URL of the API (see resolveBaseUrl). */
  var baseUrl = null;

  /** Injectable transport for unit tests: fn(url, opts) -> Promise<Response-ish). */
  var transport = null;

  N.setTransport = function (fn) { transport = fn; };
  N.getBaseUrl = function () { return baseUrl; };

  /**
   * Decide which server to talk to:
   *  1. an explicit URL saved in Settings (user editable),
   *  2. when running on the website itself (http/https) -> same origin,
   *  3. inside the Android app with no setting -> the built-in default.
   */
  N.resolveBaseUrl = function (custom) {
    if (custom) {
      baseUrl = String(custom).replace(/\/+$/, '');
      return baseUrl;
    }
    try {
      if (typeof location !== 'undefined' && location.protocol &&
          (location.protocol === 'http:' || location.protocol === 'https:') &&
          location.host && location.host.indexOf('-') > 0) {
        // Served by the companion server (website / web player).
        baseUrl = location.origin;
        return baseUrl;
      }
    } catch (e) { /* file:// or test env */ }
    baseUrl = GD.DEFAULT_SERVER_URL || '';
    return baseUrl;
  };

  function doFetch(url, opts) {
    if (transport) return transport(url, opts);
    if (typeof fetch === 'function') return fetch(url, opts);
    return Promise.reject(new Error('no transport'));
  }

  function request(method, path, body, timeoutMs) {
    var url = (baseUrl || N.resolveBaseUrl()) + path;
    var opts = {
      method: method,
      headers: { 'Accept': 'application/json' },
      timeout: 0
    };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    var timer = null;
    var p = doFetch(url, opts);
    if (timeoutMs) {
      p = Promise.race([
        p,
        new Promise(function (_, reject) {
          timer = setTimeout(function () { reject(new Error('timeout')); }, timeoutMs);
        })
      ]);
    }
    return p.then(function (res) {
      if (timer) clearTimeout(timer);
      return res.json().then(function (data) {
        return { ok: res.ok, status: res.status, data: data };
      }, function () {
        return { ok: false, status: res.status, data: { error: 'Bad JSON response' } };
      });
    }).catch(function (err) {
      if (timer) clearTimeout(timer);
      return { ok: false, status: 0, data: { error: err && err.message ? err.message : 'offline' } };
    });
  }

  // ------------------------------------------------------------------ API
  N.health = function () { return request('GET', '/api/health', undefined, 5000); };

  /** List levels.  query = { q, sort, page, limit } */
  N.listLevels = function (query) {
    query = query || {};
    var qs = [];
    if (query.q) qs.push('q=' + encodeURIComponent(query.q));
    if (query.sort) qs.push('sort=' + encodeURIComponent(query.sort));
    if (query.page) qs.push('page=' + query.page);
    if (query.limit) qs.push('limit=' + query.limit);
    return request('GET', '/api/levels' + (qs.length ? '?' + qs.join('&') : ''), undefined, 8000);
  };

  /** Level metadata (increments views). */
  N.getLevel = function (id) { return request('GET', '/api/levels/' + encodeURIComponent(id), undefined, 8000); };

  /** Full level code (increments downloads). */
  N.downloadLevel = function (id) { return request('GET', '/api/levels/' + encodeURIComponent(id) + '/download', undefined, 8000); };

  /** Upload a level code. */
  N.uploadLevel = function (payload) {
    return request('POST', '/api/levels', payload, 15000);
  };

  /** Like / unlike. value = 1 or -1. */
  N.likeLevel = function (id, value) {
    return request('POST', '/api/levels/' + encodeURIComponent(id) + '/like', { value: value }, 8000);
  };

  /** Report an attempt or a completion (online stats). */
  N.reportEvent = function (id, type) {
    return request('POST', '/api/levels/' + encodeURIComponent(id) + '/events', { type: type }, 6000);
  };

  /** Global stats for the website / about screen. */
  N.getStats = function () { return request('GET', '/api/stats', undefined, 8000); };

  return N;
});
