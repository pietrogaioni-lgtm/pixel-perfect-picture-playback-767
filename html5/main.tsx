/**
 * Standalone HTML5 entry (CrazyGames / any static host).
 * Mounts the same WhiskerGame component the TanStack route renders, with no router or server.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WhiskerGame } from "@/components/game/WhiskerGame";
import { initPlatform, platform } from "@/game/platform";
import "@/styles.css";
import "./fonts.css";

const fill = document.getElementById("splash-fill");
const progress = (p: number) => {
  if (fill) fill.style.width = `${Math.round(p * 100)}%`;
};

async function boot() {
  const el = document.getElementById("root");
  if (!el) return;
  progress(0.2);
  // SDK first (it provides the save storage on CrazyGames); never waits more than 4 s.
  await initPlatform();
  platform.loadingStart();
  progress(0.5);
  // Load the font before the canvas draws HUD text; never block start for more than 1.5 s.
  await Promise.race([
    Promise.all([document.fonts.load("700 24px Fredoka"), document.fonts.load("400 16px Fredoka")]),
    new Promise((r) => setTimeout(r, 1500)),
  ]).catch(() => undefined);
  progress(0.85);
  createRoot(el).render(
    <StrictMode>
      <WhiskerGame />
    </StrictMode>,
  );
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      progress(1);
      platform.loadingStop();
      const splash = document.getElementById("splash");
      if (splash) {
        splash.classList.add("hide");
        setTimeout(() => splash.remove(), 500);
      }
    }),
  );
}

void boot();
