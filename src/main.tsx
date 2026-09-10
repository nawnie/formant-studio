import { createRoot } from "react-dom/client";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import App from "./App";
import "./styles.css";
import "./export.css";
createRoot(document.getElementById("root")!).render(<App />);
