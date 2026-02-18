import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

const boot = () => {
  const container = document.getElementById('root');
  if (!container) return;

  try {
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log("AnatomyGuru System: Core engine started.");
  } catch (error) {
    console.error("AnatomyGuru System: Critical failure during boot.", error);
    container.innerHTML = `
      <div style="padding: 40px; text-align: center; color: #ef4444; font-family: sans-serif;">
        <h2 style="font-weight: 900;">Mounting Error</h2>
        <p>${error instanceof Error ? error.message : String(error)}</p>
      </div>
    `;
  }
};

// Check if DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}