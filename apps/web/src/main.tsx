import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("LFAA Web root not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
