import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App.tsx'
import { worker } from './mocks/browser'
import './store/useTheme' // Initialize theme store

// Start MSW for prototype demo (both development and production)
async function enableMocking() {
  console.log('[MSW] Initializing Mock Service Worker...');
  try {
    await worker.start({
      serviceWorker: {
        url: '/mockServiceWorker.js',
      },
      onUnhandledRequest: 'bypass',
      quiet: false,
    });
    console.log('[MSW] Mock Service Worker started successfully');
  } catch (error) {
    console.error('[MSW] Failed to start:', error);
    throw error;
  }
}

console.log('[App] Starting application initialization...');

enableMocking()
  .then(() => {
    console.log('[App] Rendering React application...');
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
  .catch((error) => {
    console.error('[App] Failed to initialize:', error);
    document.body.innerHTML = `<div style="padding: 20px; font-family: sans-serif;">
      <h1>Initialization Error</h1>
      <p>The application failed to start. Please check the console for details.</p>
      <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; overflow: auto;">${error.message}\n\n${error.stack}</pre>
    </div>`;
  });
