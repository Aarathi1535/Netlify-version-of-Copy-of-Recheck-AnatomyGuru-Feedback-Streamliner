import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

try {
  const container = document.getElementById('root');
  if (container) {
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } else {
    console.error("Critical: #root container missing.");
  }
} catch (error) {
  console.error("React Mounting Failed:", error);
  const rootEl = document.getElementById('root');
  if (rootEl) {
    rootEl.innerHTML = `
      <div style="padding: 40px; text-align: center; color: #dc2626; font-family: sans-serif;">
        <h2 style="font-weight: 900;">Initialization Error</h2>
        <p>The application failed to start. This might be a browser compatibility issue.</p>
        <button onclick="window.location.reload()" style="background: #1e293b; color: white; padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; margin-top: 10px;">Retry Loading</button>
      </div>
    `;
  }
}