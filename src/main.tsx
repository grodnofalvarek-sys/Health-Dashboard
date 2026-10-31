import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* HashRouter: корректная работа ссылок на GitHub Pages без серверной маршрутизации */}
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
