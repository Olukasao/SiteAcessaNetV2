import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@fontsource-variable/sora";
import "@fontsource-variable/manrope";
import "./styles/tokens.css";
import "./styles/base.css";
import App from "./App.jsx";
import RouteErrorBoundary from "./components/RouteErrorBoundary.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <RouteErrorBoundary>
        <App />
      </RouteErrorBoundary>
    </BrowserRouter>
  </StrictMode>
);
