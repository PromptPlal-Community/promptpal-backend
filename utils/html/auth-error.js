const urlParams = new URLSearchParams(window.location.search);
const error = urlParams.get('error');

window.opener.postMessage({
  type: 'GOOGLE_AUTH_ERROR',
  error: error || 'Authentication failed'
}, window.location.origin);

setTimeout(() => {
  window.close();
}, 1000);