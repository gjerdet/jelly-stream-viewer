import { createRoot } from "react-dom/client";
// Initialize Cast SDK loader early to catch the callback
import "./lib/castSdkLoader";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
