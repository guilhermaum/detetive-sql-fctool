import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializeFctool } from "./services/fctool";

const root = createRoot(
  document.getElementById("root")!
);

async function mount() {
  try {
    await initializeFctool();

    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  } catch (error) {
    console.error(
      "Falha na inicialização do FCTool:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Falha na inicialização.";

    root.render(
      <main
        role="alert"
        style={{
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <h1>Não foi possível iniciar o jogo</h1>
        <p>{message}</p>
      </main>
    );
  }
}

void mount();