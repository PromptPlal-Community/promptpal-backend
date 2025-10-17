// Get data from URL parameters or server-side rendering
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('accessToken');
const user = urlParams.get('user');

if (token && user) {
  try {
    const userData = JSON.parse(decodeURIComponent(user));
    
    // Send success message to opener
    window.opener.postMessage({
      type: 'GOOGLE_AUTH_SUCCESS',
      token: token,
      user: userData
    }, window.location.origin);
    
    // Close the popup after a short delay
    setTimeout(() => {
      window.close();
    }, 1000);
  } catch (error) {
    window.opener.postMessage({
      type: 'GOOGLE_AUTH_ERROR',
      error: 'Failed to parse user data'
    }, window.location.origin);
    window.close();
  }
} else {
  window.opener.postMessage({
    type: 'GOOGLE_AUTH_ERROR',
    error: 'Missing token or user data'
  }, window.location.origin);
  window.close();
}