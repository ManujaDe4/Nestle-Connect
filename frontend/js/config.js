/**
 * Shared front-end config. Include BEFORE any other inline scripts:
 *   <script src="./js/config.js"></script>
 * Defines window.API_BASE so every page hits the right backend whether
 * we're on localhost (dev), 127.0.0.1, opening from disk (file://),
 * or running on the deployed Render URL.
 */
(function () {
  var host = window.location.hostname;
  var protocol = window.location.protocol;

  var isLocal =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    protocol === 'file:';

  // When served from the same origin in production (Express also serves
  // the static frontend), prefer same-origin so it works behind any domain.
  var sameOriginApi = !isLocal;

  window.API_BASE = isLocal
    ? 'http://localhost:5000'
    : (sameOriginApi ? window.location.origin : 'https://nestle-connect.onrender.com');
})();
