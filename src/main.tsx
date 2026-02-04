import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { prefetchSupplementCatalog } from "./hooks/useSupplementCatalog";
import { fetchAndCacheLimits } from "./lib/category-limits-cache";

// Prefetch do catálogo de suplementos e limites de categoria no boot
// Garante que dados dinâmicos do backend estejam disponíveis para cálculos síncronos
Promise.all([
  prefetchSupplementCatalog(),
  fetchAndCacheLimits(),
]).catch(console.warn);

createRoot(document.getElementById("root")!).render(<App />);
