import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import App from './app/App';
import { optionalHostRequire } from './host/install/runtime-modules';
import { initializePowerEagleState } from './host/install/state-reset';
import './index.css';

const rootElement = document.getElementById('root')!;
const hostRequire = optionalHostRequire();
try {
  if (hostRequire) initializePowerEagleState({ hostRequire, browserStorage: window.localStorage });
  createRoot(rootElement).render(<StrictMode><App /></StrictMode>);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  rootElement.replaceChildren(Object.assign(document.createElement('pre'), {
    textContent: `Power Eagle initialization failed\n\n${message}`,
    role: 'alert',
  }));
}
