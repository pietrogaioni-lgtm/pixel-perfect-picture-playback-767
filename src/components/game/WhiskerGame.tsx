import { useCallback, useEffect, useRef, useState } from "react";
import { GameApp, fullscreenSupported, requestFullscreen, type CompleteResult, type OverResult, type RunScreen } from "@/game/app";
import { emitGameEvent } from "@/game/hooks";
import { LEVEL_COUNT } from "@/game/levels";
import { claimDaily, dailyStatus, getSaveStore, type Settings } from "@/game/save";
import { ACCESSORIES, SKINS, newlyEarnedSkins, type AccSlot } from "@/game/skins";
import { useSave } from "@/game/useSave";
import { devValidateLevels } from "@/game/validate";
import { CompleteScreen, DailyToast, GameOverScreen, LevelSelect, MainMenu, PauseButton, PauseMenu, SettingsScreen, Shop } from "./screens";

type MenuScreen = "menu" | "levels" | "shop" | "settings";

export function WhiskerGame() {
  const rootRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<GameApp | null>(null);
  const save = useSave();
  const [menu, setMenu] = useState<MenuScreen>("menu");
  const [run, setRun] = useState<RunScreen>("menu");
  const [complete, setComplete] = useState<CompleteResult | null>(null);
  const [over, setOver] = useState<OverResult | null>(null);
  const [daily, setDaily] = useState<{ amount: number; streak: number } | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [fs, setFs] = useState(false);
  const [portrait, setPortrait] = useState(false);

  // Create exactly one game app; cleanup destroys loop + listeners (StrictMode safe).
  useEffect(() => {
    const root = rootRef.current;
    const frame = frameRef.current;
    const canvas = canvasRef.current;
    if (!root || !frame || !canvas) return;
    const app = new GameApp(canvas, frame, root, {
      onScreen: (s) => setRun(s),
      onComplete: (r) => setComplete(r),
      onGameOver: (r) => setOver(r),
    });
    appRef.current = app;
    const s = getSaveStore().get();
    app.setSettings(s.settings);
    app.setLook({ skin: s.skin, hat: s.hat, scarf: s.scarf, glasses: s.glasses });
    app.setMenuWorld(Math.floor((Math.min(30, s.unlocked) - 1) / 5));
    app.start();
    if (import.meta.env.DEV) devValidateLevels();
    return () => {
      app.destroy();
      if (appRef.current === app) appRef.current = null;
    };
  }, []);

  // Keep the app in sync with saved look + settings.
  useEffect(() => {
    appRef.current?.setLook({ skin: save.skin, hat: save.hat, scarf: save.scarf, glasses: save.glasses });
  }, [save.skin, save.hat, save.scarf, save.glasses]);
  useEffect(() => {
    appRef.current?.setSettings(save.settings);
  }, [save.settings]);

  // Block page gestures: pinch zoom, scroll bounce, context menu, selection.
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    const onTouchMove = (e: TouchEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest(".scroll-y")) return;
      e.preventDefault();
    };
    document.addEventListener("gesturestart", prevent);
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("contextmenu", prevent);
    document.addEventListener("selectstart", prevent);
    document.addEventListener("dblclick", prevent);
    const onFs = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    const onOrient = () => setPortrait(window.innerHeight > window.innerWidth * 1.1 && window.matchMedia("(pointer: coarse)").matches);
    onOrient();
    window.addEventListener("resize", onOrient);
    setFs(fullscreenSupported());
    setNow(new Date());
    return () => {
      document.removeEventListener("gesturestart", prevent);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("contextmenu", prevent);
      document.removeEventListener("selectstart", prevent);
      document.removeEventListener("dblclick", prevent);
      document.removeEventListener("fullscreenchange", onFs);
      window.removeEventListener("resize", onOrient);
    };
  }, []);

  // Repair clock-error daily data and award earned achievement skins on load.
  useEffect(() => {
    const store = getSaveStore();
    const st = dailyStatus(store.get().daily, new Date());
    if (st.repaired) {
      const rep = st.repaired;
      store.update((s) => ({ ...s, daily: rep }));
    }
    const earned = newlyEarnedSkins(store.get());
    if (earned.length) store.update((s) => ({ ...s, ownedSkins: [...s.ownedSkins, ...earned.map((k) => k.id)] }));
  }, []);

  const click = useCallback(() => appRef.current?.uiSfx("click"), []);
  const store = getSaveStore();

  const startLevel = (id: number) => {
    click();
    setComplete(null);
    setOver(null);
    appRef.current?.startLevel(id);
  };

  const toMenu = () => {
    click();
    setComplete(null);
    setOver(null);
    appRef.current?.quitToMenu();
    appRef.current?.setMenuWorld(Math.floor((Math.min(30, store.get().unlocked) - 1) / 5));
    setMenu("menu");
  };

  const changeSettings = (s: Settings) => {
    click();
    store.update((d) => ({ ...d, settings: s }));
  };

  const dailyReady = now ? dailyStatus(save.daily, now).canClaim : false;

  const inRun = run !== "menu";

  return (
    <div ref={rootRef} className="game-root">
      <div ref={frameRef} className="game-frame">
        <canvas ref={canvasRef} className="block" />
        {(run === "playing" || run === "countdown") && <PauseButton onClick={() => appRef.current?.pause()} />}
      </div>

      {inRun && run === "paused" && (
        <PauseMenu
          settings={save.settings}
          onChange={changeSettings}
          onResume={() => {
            click();
            appRef.current?.resume();
          }}
          onRestart={() => {
            click();
            appRef.current?.restart();
          }}
          onMenu={toMenu}
        />
      )}
      {inRun && run === "gameover" && over && (
        <GameOverScreen
          r={over}
          onRevive={() => {
            if (appRef.current?.revive()) {
              appRef.current.uiSfx("reward");
              setOver(null);
            } else appRef.current?.uiSfx("deny");
          }}
          onRetry={() => startLevel(over.levelId)}
          onMenu={toMenu}
        />
      )}
      {inRun && run === "complete" && complete && (
        <CompleteScreen
          r={complete}
          onNext={complete.levelId < LEVEL_COUNT ? () => startLevel(complete.levelId + 1) : null}
          onRetry={() => startLevel(complete.levelId)}
          onMenu={toMenu}
        />
      )}

      {!inRun && (
        <div className="absolute inset-0">
          {menu === "menu" && (
            <MainMenu
              save={save}
              dailyReady={dailyReady}
              fsSupported={fs}
              onPlay={() => {
                let id = Math.min(LEVEL_COUNT, save.unlocked);
                if (save.levels[String(id)]?.completed && id < LEVEL_COUNT) id++;
                startLevel(id);
              }}
              onLevels={() => {
                click();
                setMenu("levels");
              }}
              onShop={() => {
                click();
                setMenu("shop");
              }}
              onSettings={() => {
                click();
                setMenu("settings");
              }}
              onDaily={() => {
                const res = claimDaily(store.get(), new Date());
                store.update(() => res.save);
                if (res.amount > 0) {
                  appRef.current?.uiSfx("reward");
                  emitGameEvent({ type: "reward", kind: "daily", amount: res.amount });
                  setDaily({ amount: res.amount, streak: res.save.daily.streak });
                }
                setNow(new Date());
              }}
              onFullscreen={() => {
                click();
                requestFullscreen();
              }}
            />
          )}
          {menu === "levels" && <LevelSelect save={save} onPick={startLevel} onBack={() => (click(), setMenu("menu"))} />}
          {menu === "shop" && (
            <Shop
              save={save}
              onBack={() => (click(), setMenu("menu"))}
              onBuySkin={(id) => {
                const k = SKINS.find((s) => s.id === id);
                const cur = store.get();
                if (!k || k.price === null || cur.ownedSkins.includes(id)) return false;
                if (cur.fish < k.price) {
                  appRef.current?.uiSfx("deny");
                  return false;
                }
                store.update((s) => ({ ...s, fish: s.fish - (k.price ?? 0), ownedSkins: [...s.ownedSkins, id], skin: id }));
                appRef.current?.uiSfx("buy");
                return true;
              }}
              onEquipSkin={(id) => {
                click();
                store.update((s) => (s.ownedSkins.includes(id) ? { ...s, skin: id } : s));
              }}
              onBuyAcc={(id) => {
                const a = ACCESSORIES.find((x) => x.id === id);
                const cur = store.get();
                if (!a || cur.ownedAcc.includes(id)) return false;
                if (cur.fish < a.price) {
                  appRef.current?.uiSfx("deny");
                  return false;
                }
                store.update((s) => ({ ...s, fish: s.fish - a.price, ownedAcc: [...s.ownedAcc, id], [a.slot]: id }));
                appRef.current?.uiSfx("buy");
                return true;
              }}
              onEquipAcc={(id, slot: AccSlot) => {
                click();
                store.update((s) => (s.ownedAcc.includes(id) ? { ...s, [slot]: s[slot] === id ? null : id } : s));
              }}
            />
          )}
          {menu === "settings" && (
            <SettingsScreen
              settings={save.settings}
              onChange={changeSettings}
              onBack={() => (click(), setMenu("menu"))}
              onReset={() => {
                store.reset();
                appRef.current?.setMenuWorld(0);
              }}
              fsSupported={fs}
              onFullscreen={() => requestFullscreen()}
            />
          )}
        </div>
      )}

      {daily && <DailyToast amount={daily.amount} streak={daily.streak} onClose={() => (click(), setDaily(null))} />}

      {portrait && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
          <div className="rounded-full border-[3px] border-ink bg-card px-4 py-2 text-sm font-semibold text-ink shadow-pop">Rotate your phone for a bigger view</div>
        </div>
      )}
    </div>
  );
}
