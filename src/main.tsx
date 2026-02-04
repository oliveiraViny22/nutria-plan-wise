import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { prefetchSupplementCatalog } from "./hooks/useSupplementCatalog";

// Prefetch do catálogo de suplementos no boot para disponibilizar dados dinâmicos
prefetchSupplementCatalog().catch(console.warn);

createRoot(document.getElementById("root")!).render(<App />);
