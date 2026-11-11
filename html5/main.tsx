/**
 * Standalone HTML5 entry (CrazyGames / any static host).
 * Mounts the same WhiskerGame component the TanStack route renders, with no router or server.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WhiskerGame } from "@/components/game/WhiskerGame";
import "@/styles.css";
import "./fonts.css";

const el = document.getElementById("root");
if (el) {
  // Load the font before the canvas draws HUD text; never block start for more than 1.5 s.
  const fontsReady = Promise.race([
    Promise.all([document.fonts.load("700 24px Fredoka"), document.fonts.load("400 16px Fredoka")]),
    new Promise((r) => setTimeout(r, 1500)),
  ]).catch(() => undefined);
  void fontsReady.then(() => {
    createRoot(el).render(
      <StrictMode>
        <WhiskerGame />
      </StrictMode>,
    );
  });
}
