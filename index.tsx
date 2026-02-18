import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

const boot = () => {
  console.log("AnatomyGuru: Starting Engine...");
  
  const container = document.getElementById('root');
  if (!container) {
    console.error("AnatomyGuru: Root container not found.");
    return;
  }

  try {
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log("AnatomyGuru: UI Mounted Successfully.");
  } catch (error) {
    console.error("AnatomyGuru: Mount Failure", error);
    container.innerHTML = `<div style="padding: 20px; color: red;">Mount Error: ${error instanceof Error ? error.message : String(error)}</div>`;
  }
};

// Ensure DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}