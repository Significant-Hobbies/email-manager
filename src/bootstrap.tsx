import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import { router } from '@/router';
import '@/styles/globals.css';
import { initVitals } from './lib/vitals';
import { initApiTiming } from './lib/api-timing';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);

initVitals();
initApiTiming();
