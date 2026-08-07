import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './app/App';
import { AuthProvider } from './auth/AuthProvider';
import { AudioProvider } from './music/AudioProvider';
import './index.css';
import './App.css';
import './music-showcase.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><BrowserRouter><AuthProvider><AudioProvider><App /></AudioProvider></AuthProvider></BrowserRouter></React.StrictMode>,
);
