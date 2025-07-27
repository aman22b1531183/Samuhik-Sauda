// src/main.jsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx'; // Import your main App component
import './index.css'; // Import your global CSS file

// Get the root DOM element where your React app will be mounted
const rootElement = document.getElementById('root');

// Create a React root and render your App component
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    {/*
      React.StrictMode is a tool for highlighting potential problems in an application.
      It does not render any visible UI. It activates additional checks and warnings for its descendants.
    */}
    <App />
  </React.StrictMode>,
);
