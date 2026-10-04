import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ProviderExperiment } from './provider-experiment';

createRoot(document.getElementById('fixture')!).render(
  <StrictMode><ProviderExperiment mode="standalone" autoRun /></StrictMode>,
);
