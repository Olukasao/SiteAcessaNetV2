import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { applySiteTheme } from "./theme/siteTheme.js";
import { unregisterStaleServiceWorker } from "./unregisterStaleServiceWorker.js";
import "./styles/theme.css";

applySiteTheme();
unregisterStaleServiceWorker();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <HelmetProvider>
        <App />
      </HelmetProvider>
    </BrowserRouter>
  </React.StrictMode>
);
