import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { supabase } from './lib/supabase.ts';

function logError(message: string, details?: string, context?: string) {
  if (!supabase) return;
  supabase.from('super_admin_logs').insert({ type: 'error', message, details: details?.slice(0, 2000), context }).then(() => {});
}

window.addEventListener('unhandledrejection', e => {
  const msg = e.reason instanceof Error ? e.reason.message : String(e.reason);
  const stack = e.reason instanceof Error ? e.reason.stack : undefined;
  logError(`Unhandled Promise Rejection: ${msg}`, stack, window.location.pathname);
});

window.addEventListener('error', e => {
  logError(`Uncaught Error: ${e.message}`, e.error?.stack, `${e.filename}:${e.lineno}`);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
