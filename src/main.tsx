import { createRoot } from "react-dom/client";
import { initSentry } from "./lib/sentry";
import { validatePricingConfig } from "./config/pricing";
import App from "./App.tsx";
import "./index.css";

// Initialize Sentry before rendering
initSentry();

// Validate pricing config on app load
validatePricingConfig();

createRoot(document.getElementById("root")!).render(<App />);
