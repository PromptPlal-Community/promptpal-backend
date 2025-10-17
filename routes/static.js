import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve auth.js as a static file with proper headers
router.get('/auth.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  const jsContent = `
// Secure Google Auth Handler
(function() {
  'use strict';
  
  function getAuthData() {
    try {
      const tokenEl = document.getElementById('authToken');
      const userEl = document.getElementById('authUser');
      const errorEl = document.getElementById('authError');
      
      if (errorEl) {
        return { error: errorEl.textContent };
      }
      
      if (tokenEl && userEl) {
        const token = tokenEl.textContent;
        const user = JSON.parse(userEl.textContent);
        return { token, user };
      }
      
      return { error: 'No authentication data found' };
    } catch (err) {
      return { error: 'Failed to process authentication data' };
    }
  }
  
  function sendMessageToOpener(type, data) {
    if (window.opener && !window.opener.closed && window.opener !== window) {
      window.opener.postMessage({
        type: type,
        ...data,
        timestamp: Date.now()
      }, window.location.origin);
    }
  }
  
  function showMessage(message, isError = false) {
    const container = document.createElement('div');
    container.style.cssText = \`
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: #f9fafb;
    \`;
    
    const content = document.createElement('div');
    content.style.cssText = \`
      text-align: center;
      padding: 2rem;
      color: \${isError ? '#dc2626' : '#059669'};
      max-width: 400px;
    \`;
    
    const heading = document.createElement('h2');
    heading.textContent = isError ? '❌ Authentication Failed' : '✅ Authentication Complete';
    
    const text = document.createElement('p');
    text.textContent = message;
    
    const button = document.createElement('button');
    button.textContent = 'Close Window';
    button.style.cssText = \`
      background: \${isError ? '#dc2626' : '#8b5cf6'};
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      cursor: pointer;
      margin: 1rem 0;
      font-size: 14px;
    \`;
    button.onclick = () => window.close();
    
    content.appendChild(heading);
    content.appendChild(text);
    content.appendChild(button);
    container.appendChild(content);
    
    document.body.innerHTML = '';
    document.body.appendChild(container);
  }
  
  function handleAuth() {
    const authData = getAuthData();
    
    if (authData.error) {
      sendMessageToOpener('GOOGLE_AUTH_ERROR', { error: authData.error });
      showMessage(authData.error, true);
      return;
    }
    
    // Success case
    sendMessageToOpener('GOOGLE_AUTH_SUCCESS', {
      token: authData.token,
      user: authData.user
    });
    
    // Show loading state briefly before closing
    showMessage('Authentication successful! Closing window...', false);
    
    setTimeout(() => {
      if (!window.closed) {
        window.close();
      }
    }, 1000);
  }
  
  // Initialize when DOM is loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', handleAuth);
  } else {
    handleAuth();
  }
})();
  `;
  
  res.send(jsContent);
});

// Serve styles.css as a static file
router.get('/auth-styles.css', (req, res) => {
  res.setHeader('Content-Type', 'text/css');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  
  const cssContent = `
.auth-container {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  margin: 0;
  background: #f9fafb;
}

.auth-content {
  text-align: center;
  padding: 2rem;
  max-width: 400px;
}

.auth-spinner {
  border: 3px solid #f3f4f6;
  border-top: 3px solid #8b5cf6;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: auth-spin 1s linear infinite;
  margin: 0 auto 1rem;
}

.auth-success {
  color: #059669;
}

.auth-error {
  color: #dc2626;
}

.auth-button {
  background: #8b5cf6;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  margin: 1rem 0;
  font-size: 14px;
}

.auth-button:hover {
  background: #7c3aed;
}

.auth-button-error {
  background: #dc2626;
}

.auth-button-error:hover {
  background: #b91c1c;
}

.auth-info {
  background: #dbeafe;
  padding: 1rem;
  border-radius: 8px;
  margin: 1rem 0;
  font-size: 14px;
}

.auth-hidden {
  display: none;
}

@keyframes auth-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
  `;
  
  res.send(cssContent);
});

export default router;