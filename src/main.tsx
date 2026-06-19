import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './i18n';
import './styles/globals.css';
import { initNativeShell } from './lib/nativeBootstrap';

void initNativeShell();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
