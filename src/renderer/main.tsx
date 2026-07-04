import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { webDbAPI } from './utils/webDb';

// If running in standard Web browser (Vercel deployment) instead of Electron, inject LocalStorage API
if (!window.electronAPI) {
  window.electronAPI = webDbAPI as any;
  console.log('Running in Web Mode. LocalStorage DB fallback loaded!');

  // Register Service Worker for PWA
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('ServiceWorker registered successfully:', reg.scope))
        .catch(err => console.log('ServiceWorker registration failed:', err));
    });
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
