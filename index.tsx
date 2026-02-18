import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

console.log("AnatomyGuru: Script execution started.");

const container = document.getElementById('root');

if (container) {
  try {
    console.log("AnatomyGuru: Attempting to create root...");
    const root = createRoot(container);
    console.log("AnatomyGuru: Root created. Calling render...");
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log("AnatomyGuru: React root.render called successfully.");
  } catch (error) {
    console.error("AnatomyGuru: Critical failure during React mount.", error);
    container.innerHTML = `
      <div style="padding: 40px; text-align: center; color: #ef4444; font-family: sans-serif;">
        <h2 style="font-weight: 900;">Mount Error</h2>
        <p>${error instanceof Error ? error.message : String(error)}</p>
      </div>
    `;
  }
} else {
  console.error("AnatomyGuru: Root element not found in DOM.");
}