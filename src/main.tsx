import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App.tsx'
import { worker } from './mocks/browser'

// Start MSW in development
async function enableMocking() {
  if (import.meta.env.DEV) {
    await worker.start({
      onUnhandledRequest: 'bypass',
    });
  }
}

enableMocking()
  .then(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
  .catch((error) => {
    console.error('Failed to initialize app:', error);
    document.body.innerHTML = `<div style="padding: 20px; font-family: sans-serif;">
      <h1>Initialization Error</h1>
      <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px;">${error.message}\n\n${error.stack}</pre>
    </div>`;
  });
