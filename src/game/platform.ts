/**
 * CrazyGames SDK v3 bridge. Every call is a safe no-op when the SDK is absent
 * (Lovable preview, other hosts, offline), so the game never depends on it.
 */
interface CGData {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
interface CGSdk {
  init(): Promise<void>;
  environment: "local" | "crazygames" | "disabled";
  game: {
    loadingStart(): void;
    loadingStop(): void;
    gameplayStart(): void;
    gameplayStop(): void;
    happytime(): void;
    settings?: { muteAudio?: boolean };
    addSettingsChangeListener?(cb: (s: { muteAudio?: boolean }) => void): void;
  };
  ad: {
    requestAd(type: "midgame" | "rewarded", cb: { adStarted?: () => void; adFinished?: () => void; adError?: (e: unknown) => void }): void;
  };
  data?: CGData;
}

let sdk: CGSdk | null = null;
let gameplay = false;
let adPlaying = false;
let muteListeners: ((muted: boolean) => void)[] = [];
let sdkMuted = false;

function rawSdk(): CGSdk | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { CrazyGames?: { SDK?: CGSdk } };
  return w.CrazyGames?.SDK ?? null;
}

/** Initialise the SDK if its script is on the page. Resolves within `timeoutMs` no matter what. */
export async function initPlatform(timeoutMs = 4000): Promise<void> {
  const s = rawSdk();
  if (!s) return;
  try {
    await Promise.race([s.init(), new Promise<void>((_, rej) => setTimeout(() => rej(new Error("sdk timeout")), timeoutMs))]);
    if (s.environment === "disabled") return;
    sdk = s;
    sdkMuted = !!s.game.settings?.muteAudio;
    s.game.addSettingsChangeListener?.((st) => {
      sdkMuted = !!st.muteAudio;
      notifyMute();
    });
  } catch (e) {
    console.warn("CrazyGames SDK unavailable", e);
    sdk = null;
  }
}

export function onCrazyGames(): boolean {
  return !!sdk && sdk.environment === "crazygames";
}

export function platformStorage(): CGData | null {
  return sdk?.data ?? null;
}

function call(fn: () => void) {
  try {
    if (sdk) fn();
  } catch (e) {
    console.warn("CrazyGames SDK call failed", e);
  }
}

export const platform = {
  loadingStart: () => call(() => sdk?.game.loadingStart()),
  loadingStop: () => call(() => sdk?.game.loadingStop()),
  /** Tell the platform whether the player is actively playing (drives ad timing). */
  setGameplay(on: boolean) {
    if (on === gameplay) return;
    gameplay = on;
    call(() => (on ? sdk?.game.gameplayStart() : sdk?.game.gameplayStop()));
  },
  happytime: () => call(() => sdk?.game.happytime()),
  /** Midgame break between levels. Resolves when it's over (or immediately without SDK). */
  midgameAd(): Promise<void> {
    if (!sdk || adPlaying) return Promise.resolve();
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        adPlaying = false;
        notifyMute();
        resolve();
      };
      try {
        sdk?.ad.requestAd("midgame", {
          adStarted: () => {
            adPlaying = true;
            notifyMute();
          },
          adFinished: finish,
          adError: finish,
        });
        // never hang the game if the SDK forgets to call back
        setTimeout(finish, 60000);
      } catch {
        finish();
      }
    });
  },
  onMuteChange(cb: (muted: boolean) => void) {
    muteListeners.push(cb);
    cb(sdkMuted || adPlaying);
    return () => {
      muteListeners = muteListeners.filter((x) => x !== cb);
    };
  },
};

function notifyMute() {
  const m = sdkMuted || adPlaying;
  for (const cb of muteListeners) cb(m);
}
