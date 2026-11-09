import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Expand, Gift, Lock, Music, Pause, Play, RotateCcw, Settings as SettingsIcon, ShoppingBag, Sparkles, Volume2, Map as MapIcon, Home, ChevronRight } from "lucide-react";
import type { CompleteResult, OverResult } from "@/game/app";
import { LEVELS } from "@/game/levels";
import { ACCESSORIES, SKINS, getSkin, type AccSlot } from "@/game/skins";
import type { SaveData, Settings } from "@/game/save";
import { WORLDS } from "@/game/worlds";
import { cn } from "@/lib/utils";
import { CatPreview } from "./CatPreview";
import { FishBadge, FishIcon, GameButton, Logo, Panel, StarIcon } from "./ui";

// ---------------------------------------------------------------- main menu

export function MainMenu(props: {
  save: SaveData;
  dailyReady: boolean;
  fsSupported: boolean;
  onPlay: () => void;
  onLevels: () => void;
  onShop: () => void;
  onSettings: () => void;
  onDaily: () => void;
  onFullscreen: () => void;
}) {
  const { save } = props;
  const next = Math.min(30, save.unlocked);
  const nextDef = LEVELS[next - 1];
  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="flex items-start justify-between p-[clamp(10px,2.5vmin,28px)]">
        <FishBadge amount={save.fish} />
        <div className="flex gap-2">
          {props.dailyReady && (
            <GameButton variant="gold" size="sm" onClick={props.onDaily} className="animate-float">
              <Gift className="h-5 w-5" /> Daily gift
            </GameButton>
          )}
          {props.fsSupported && (
            <GameButton variant="ghost" size="icon" onClick={props.onFullscreen} aria-label="Toggle fullscreen">
              <Expand className="h-5 w-5" />
            </GameButton>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-[clamp(10px,3vmin,32px)] px-4 pb-6">
        <Logo className="animate-pop-in text-[clamp(44px,11vmin,112px)]" />
        <div className="flex animate-slide-up flex-col items-center gap-3">
          <GameButton size="lg" onClick={props.onPlay} className="min-w-[240px]">
            <Play className="h-6 w-6 fill-current" /> Play
          </GameButton>
          {nextDef && (
            <p className="outline-text text-sm font-medium text-cream">
              Level {next}: {nextDef.name}
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-3">
            <GameButton variant="secondary" onClick={props.onLevels}>
              <MapIcon className="h-5 w-5" /> Levels
            </GameButton>
            <GameButton variant="gold" onClick={props.onShop}>
              <ShoppingBag className="h-5 w-5" /> Shop
            </GameButton>
            <GameButton variant="ghost" onClick={props.onSettings}>
              <SettingsIcon className="h-5 w-5" /> Settings
            </GameButton>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- level select

function totalStars(save: SaveData, from: number, to: number) {
  let n = 0;
  for (let i = from; i <= to; i++) n += (save.levels[String(i)]?.stars ?? []).filter(Boolean).length;
  return n;
}

export function LevelSelect({ save, onPick, onBack }: { save: SaveData; onPick: (id: number) => void; onBack: () => void }) {
  const all = totalStars(save, 1, 30);
  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="flex items-center justify-between gap-3 p-[clamp(10px,2.5vmin,24px)]">
        <GameButton variant="ghost" size="icon" onClick={onBack} aria-label="Back">
          <ArrowLeft className="h-6 w-6" />
        </GameButton>
        <h2 className="logo-text text-[clamp(26px,5vmin,44px)]">Rooftop Map</h2>
        <div className="flex items-center gap-1 rounded-full border-[3px] border-ink bg-card px-3 py-1 font-semibold text-ink shadow-pop">
          <StarIcon filled className="h-5 w-5" /> {all}/90
        </div>
      </div>
      <div className="scroll-y flex-1 px-[clamp(10px,3vmin,32px)] pb-8">
        <div className="mx-auto flex max-w-4xl flex-col gap-5">
          {WORLDS.map((w) => {
            const first = w.id * 5 + 1;
            const stars = totalStars(save, first, first + 4);
            const dark = w.id === 1 || w.id === 2 || w.id === 3;
            return (
              <section key={w.id} className={cn("animate-slide-up overflow-hidden rounded-3xl border-[3px] border-ink shadow-pop", `world-band-${w.id}`)} style={{ animationDelay: `${w.id * 60}ms` }}>
                <header className="flex items-center justify-between gap-2 border-b-[3px] border-ink bg-ink/25 px-4 py-2">
                  <div>
                    <div className="outline-text text-lg font-semibold text-cream">
                      World {w.id + 1} · {w.name}
                    </div>
                    <div className={cn("text-xs font-medium", dark ? "text-cream/85" : "text-ink/80")}>{w.tagline}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 font-semibold text-cream outline-text">
                    <StarIcon filled className="h-5 w-5" /> {stars}/15
                  </div>
                </header>
                <div className="relative grid grid-cols-5 gap-2 px-3 py-5 sm:gap-4 sm:px-6">
                  <svg className="pointer-events-none absolute inset-x-6 top-1/2 h-8 -translate-y-1/2" preserveAspectRatio="none" viewBox="0 0 100 10" aria-hidden>
                    <path d="M0 5 Q12 0 25 5 T50 5 T75 5 T100 5" className="fill-none stroke-cream/70" strokeWidth="1.2" strokeDasharray="2 2" />
                  </svg>
                  {[0, 1, 2, 3, 4].map((k) => {
                    const id = first + k;
                    const def = LEVELS[id - 1];
                    const prog = save.levels[String(id)];
                    const locked = id > save.unlocked;
                    return (
                      <button
                        key={id}
                        disabled={locked}
                        onClick={() => onPick(id)}
                        className={cn(
                          "group relative z-10 flex flex-col items-center gap-1 transition-transform",
                          !locked && "hover:-translate-y-1 active:translate-y-0",
                          k % 2 === 1 && "translate-y-3",
                        )}
                        aria-label={locked ? `Level ${id} locked` : `Play level ${id}: ${def?.name ?? ""}`}
                      >
                        <span
                          className={cn(
                            "flex h-[clamp(48px,9vmin,72px)] w-[clamp(48px,9vmin,72px)] items-center justify-center rounded-full border-[3px] border-ink font-display text-[clamp(18px,3.5vmin,28px)] font-bold shadow-pop",
                            locked ? "bg-locked text-cream" : prog?.completed ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground",
                            id === save.unlocked && !prog?.completed && "ring-4 ring-cream/80",
                          )}
                        >
                          {locked ? <Lock className="h-5 w-5" /> : id}
                        </span>
                        <span className="flex">
                          {[0, 1, 2].map((s) => (
                            <StarIcon key={s} filled={!!prog?.stars[s]} className="h-4 w-4" />
                          ))}
                        </span>
                        <span className={cn("hidden max-w-[110px] truncate text-xs font-semibold sm:block", dark ? "text-cream" : "text-ink")}>{def?.name}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- shop

export function Shop({
  save,
  onBuySkin,
  onEquipSkin,
  onBuyAcc,
  onEquipAcc,
  onBack,
}: {
  save: SaveData;
  onBuySkin: (id: string) => boolean;
  onEquipSkin: (id: string) => void;
  onBuyAcc: (id: string) => boolean;
  onEquipAcc: (id: string, slot: AccSlot) => void;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<"cats" | "acc">("cats");
  const [sel, setSel] = useState<string>(save.skin);
  const [selAcc, setSelAcc] = useState<string>(ACCESSORIES[0]?.id ?? "");
  const [deny, setDeny] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 1800);
    return () => clearTimeout(t);
  }, [msg]);

  const skin = getSkin(sel);
  const acc = ACCESSORIES.find((a) => a.id === selAcc) ?? null;
  const preview = useMemo(() => {
    const p = { hat: save.hat, scarf: save.scarf, glasses: save.glasses };
    if (tab === "acc" && acc) p[acc.slot] = acc.id;
    return p;
  }, [tab, acc, save.hat, save.scarf, save.glasses]);

  const notEnough = () => {
    setDeny((d) => d + 1);
    setMsg("Not enough fish! Keep running.");
  };

  let action: React.ReactNode = null;
  if (tab === "cats") {
    const owned = save.ownedSkins.includes(skin.id);
    if (owned) {
      action =
        save.skin === skin.id ? (
          <GameButton variant="ghost" disabled className="w-full">
            Equipped
          </GameButton>
        ) : (
          <GameButton variant="secondary" className="w-full" onClick={() => onEquipSkin(skin.id)}>
            Equip
          </GameButton>
        );
    } else if (skin.price !== null) {
      action = (
        <GameButton variant="gold" className="w-full" onClick={() => (onBuySkin(skin.id) ? setMsg(`${skin.name} unlocked!`) : notEnough())}>
          Buy · <FishIcon /> {skin.price}
        </GameButton>
      );
    } else if (skin.achievement) {
      const [a, b] = skin.achievement.progress(save);
      action = (
        <div className="w-full rounded-2xl border-[3px] border-dashed border-ink/40 bg-muted px-3 py-2 text-center text-sm font-semibold text-muted-foreground">
          <Lock className="mr-1 inline h-4 w-4" /> {skin.achievement.label} ({a}/{b})
        </div>
      );
    }
  } else if (acc) {
    const owned = save.ownedAcc.includes(acc.id);
    const equipped = save[acc.slot] === acc.id;
    action = owned ? (
      <GameButton variant={equipped ? "ghost" : "secondary"} className="w-full" onClick={() => onEquipAcc(acc.id, acc.slot)}>
        {equipped ? "Take off" : "Wear"}
      </GameButton>
    ) : (
      <GameButton variant="gold" className="w-full" onClick={() => (onBuyAcc(acc.id) ? setMsg(`${acc.name} bought!`) : notEnough())}>
        Buy · <FishIcon /> {acc.price}
      </GameButton>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="flex items-center justify-between gap-3 p-[clamp(10px,2.5vmin,24px)]">
        <GameButton variant="ghost" size="icon" onClick={onBack} aria-label="Back">
          <ArrowLeft className="h-6 w-6" />
        </GameButton>
        <h2 className="logo-text text-[clamp(26px,5vmin,44px)]">Cat Shop</h2>
        <FishBadge amount={save.fish} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 px-[clamp(10px,3vmin,32px)] pb-4 md:flex-row">
        <Panel className="flex shrink-0 flex-col items-center gap-2 p-4 md:w-[min(36%,340px)]">
          <CatPreview skin={sel} hat={preview.hat} scarf={preview.scarf} glasses={preview.glasses} className="h-[clamp(110px,26vmin,220px)] w-full" />
          <div className="text-center">
            <div className="font-display text-xl font-semibold text-ink">{tab === "cats" ? skin.name : acc?.name}</div>
            {tab === "cats" && skin.rare && <div className="text-xs font-bold uppercase tracking-widest text-primary">Rare</div>}
          </div>
          <div key={deny} className={cn("w-full", deny > 0 && "animate-wiggle")}>
            {action}
          </div>
          <div className="h-5 text-center text-sm font-semibold text-primary-deep" role="status">
            {msg}
          </div>
        </Panel>
        <Panel className="flex min-h-0 flex-1 flex-col p-3">
          <div className="mb-3 flex gap-2">
            <GameButton size="sm" variant={tab === "cats" ? "primary" : "ghost"} onClick={() => setTab("cats")}>
              Cats
            </GameButton>
            <GameButton size="sm" variant={tab === "acc" ? "primary" : "ghost"} onClick={() => setTab("acc")}>
              Accessories
            </GameButton>
          </div>
          <div className="scroll-y grid min-h-0 flex-1 grid-cols-3 content-start gap-2 sm:grid-cols-4">
            {tab === "cats"
              ? SKINS.map((k) => {
                  const owned = save.ownedSkins.includes(k.id);
                  return (
                    <button
                      key={k.id}
                      onClick={() => setSel(k.id)}
                      className={cn(
                        "relative flex flex-col items-center rounded-2xl border-[3px] p-1 text-center transition-transform hover:-translate-y-0.5",
                        sel === k.id ? "border-primary bg-accent/30" : "border-ink/20 bg-muted",
                      )}
                    >
                      <CatPreview skin={k.id} hat={null} scarf={null} glasses={null} pose="idle" className="h-16 w-full" scale={1.2} />
                      <span className="line-clamp-2 text-[11px] font-semibold leading-tight text-ink">{k.name}</span>
                      <span className="mt-0.5 text-[11px] font-bold text-muted-foreground">
                        {save.skin === k.id ? "Equipped" : owned ? "Owned" : k.price !== null ? `${k.price} fish` : "Achievement"}
                      </span>
                      {!owned && <Lock className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-ink/50" />}
                    </button>
                  );
                })
              : ACCESSORIES.map((a) => {
                  const owned = save.ownedAcc.includes(a.id);
                  const on = save[a.slot] === a.id;
                  return (
                    <button
                      key={a.id}
                      onClick={() => setSelAcc(a.id)}
                      className={cn(
                        "relative flex flex-col items-center rounded-2xl border-[3px] p-1 text-center transition-transform hover:-translate-y-0.5",
                        selAcc === a.id ? "border-primary bg-accent/30" : "border-ink/20 bg-muted",
                      )}
                    >
                      <CatPreview skin={save.skin} hat={a.slot === "hat" ? a.id : null} scarf={a.slot === "scarf" ? a.id : null} glasses={a.slot === "glasses" ? a.id : null} pose="idle" className="h-16 w-full" scale={1.2} />
                      <span className="text-[11px] font-semibold leading-tight text-ink">{a.name}</span>
                      <span className="mt-0.5 text-[11px] font-bold capitalize text-muted-foreground">{on ? "Wearing" : owned ? a.slot : `${a.price} fish`}</span>
                    </button>
                  );
                })}
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- settings

function Toggle({ label, on, onChange, icon }: { label: string; on: boolean; onChange: (v: boolean) => void; icon?: React.ReactNode }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between gap-4 rounded-2xl border-[3px] border-ink/15 bg-muted px-4 py-3 text-left font-semibold text-ink"
    >
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span className={cn("relative h-8 w-14 rounded-full border-[3px] border-ink transition-colors", on ? "bg-secondary" : "bg-locked")}>
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-cream transition-all", on ? "left-7" : "left-0.5")} />
      </span>
    </button>
  );
}

export function SettingsScreen({
  settings,
  onChange,
  onBack,
  onReset,
  fsSupported,
  onFullscreen,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
  onBack: () => void;
  onReset: () => void;
  fsSupported: boolean;
  onFullscreen: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="overlay">
      <Panel className="scroll-y flex max-h-full w-[min(560px,100%)] flex-col gap-3 p-5">
        <div className="flex items-center gap-3">
          <GameButton variant="ghost" size="icon" onClick={onBack} aria-label="Back">
            <ArrowLeft className="h-6 w-6" />
          </GameButton>
          <h2 className="font-display text-3xl font-bold text-ink">Settings</h2>
        </div>
        <Toggle label="Music" icon={<Music className="h-5 w-5" />} on={settings.music} onChange={(v) => onChange({ ...settings, music: v })} />
        <Toggle label="Sound effects" icon={<Volume2 className="h-5 w-5" />} on={settings.sfx} onChange={(v) => onChange({ ...settings, sfx: v })} />
        <Toggle label="Screen shake" on={settings.shake} onChange={(v) => onChange({ ...settings, shake: v })} />
        <div className="flex items-center justify-between rounded-2xl border-[3px] border-ink/15 bg-muted px-4 py-3 font-semibold text-ink">
          <span>Graphics quality</span>
          <div className="flex gap-2">
            {(["low", "high"] as const).map((q) => (
              <GameButton key={q} size="sm" variant={settings.quality === q ? "primary" : "ghost"} onClick={() => onChange({ ...settings, quality: q })}>
                {q === "low" ? "Low" : "High"}
              </GameButton>
            ))}
          </div>
        </div>
        {fsSupported && (
          <GameButton variant="secondary" onClick={onFullscreen}>
            <Expand className="h-5 w-5" /> Toggle fullscreen
          </GameButton>
        )}
        <div className="rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          <div className="mb-1 font-semibold text-ink">Controls</div>
          <p>Keyboard: Space / W / Up to jump (hold for higher, press again in the air to double jump), S / Down to slide, P or Esc to pause.</p>
          <p className="mt-1">Touch: tap the right side to jump, tap the left side or swipe down to slide.</p>
        </div>
        <GameButton
          variant={confirm ? "danger" : "ghost"}
          size="sm"
          onClick={() => {
            if (confirm) {
              onReset();
              setConfirm(false);
            } else setConfirm(true);
          }}
        >
          {confirm ? "Tap again to erase all progress" : "Reset progress"}
        </GameButton>
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------- in-run screens

export function PauseButton({ onClick }: { onClick: () => void }) {
  return (
    <GameButton
      variant="hud"
      size="hud"
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label="Pause"
      className="absolute right-[1.4%] top-[2.2%] z-20"
    >
      <Pause className="h-7 w-7 fill-current" />
    </GameButton>
  );
}

export function PauseMenu({
  settings,
  onChange,
  onResume,
  onRestart,
  onMenu,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
  onResume: () => void;
  onRestart: () => void;
  onMenu: () => void;
}) {
  return (
    <div className="overlay bg-scrim">
      <Panel className="flex w-[min(420px,100%)] flex-col items-stretch gap-3 p-6 text-center">
        <h2 className="font-display text-4xl font-bold text-ink">Paused</h2>
        <GameButton size="lg" onClick={onResume}>
          <Play className="h-6 w-6 fill-current" /> Resume
        </GameButton>
        <GameButton variant="secondary" onClick={onRestart}>
          <RotateCcw className="h-5 w-5" /> Restart
        </GameButton>
        <GameButton variant="ghost" onClick={onMenu}>
          <Home className="h-5 w-5" /> Menu
        </GameButton>
        <div className="mt-1 flex justify-center gap-2">
          <GameButton size="sm" variant={settings.music ? "secondary" : "ghost"} onClick={() => onChange({ ...settings, music: !settings.music })}>
            <Music className="h-4 w-4" /> {settings.music ? "On" : "Off"}
          </GameButton>
          <GameButton size="sm" variant={settings.sfx ? "secondary" : "ghost"} onClick={() => onChange({ ...settings, sfx: !settings.sfx })}>
            <Volume2 className="h-4 w-4" /> {settings.sfx ? "On" : "Off"}
          </GameButton>
        </div>
      </Panel>
    </div>
  );
}

const CAUSE_TEXT: Record<string, string> = {
  fall: "Missed the rooftop!",
  hit: "Bonk! Watch out for obstacles.",
  caught: "The vacuum caught you!",
};

export function GameOverScreen({ r, onRevive, onRetry, onMenu }: { r: OverResult; onRevive: () => void; onRetry: () => void; onMenu: () => void }) {
  const canAfford = r.wallet >= r.reviveCost;
  return (
    <div className="overlay bg-scrim">
      <Panel className="flex w-[min(460px,100%)] flex-col items-stretch gap-3 p-6 text-center">
        <h2 className="font-display text-4xl font-bold text-destructive">Oh no!</h2>
        <p className="font-semibold text-muted-foreground">{CAUSE_TEXT[r.cause] ?? "Try again!"}</p>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Distance" value={`${r.distance} m`} />
          <Stat label="Best" value={`${r.best} m`} />
          <Stat label="Fish" value={`+${r.coins}`} />
        </div>
        {r.canRevive && (
          <GameButton variant="gold" size="lg" onClick={onRevive} disabled={!canAfford}>
            <Sparkles className="h-5 w-5" /> Revive · <FishIcon /> {r.reviveCost}
          </GameButton>
        )}
        {r.canRevive && !canAfford && <p className="text-sm font-semibold text-muted-foreground">Need {r.reviveCost} fish to revive.</p>}
        <div className="flex gap-3">
          <GameButton className="flex-1" onClick={onRetry}>
            <RotateCcw className="h-5 w-5" /> Retry
          </GameButton>
          <GameButton className="flex-1" variant="ghost" onClick={onMenu}>
            <Home className="h-5 w-5" /> Menu
          </GameButton>
        </div>
      </Panel>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-muted px-2 py-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-display text-xl font-bold tabular-nums text-ink">{value}</div>
    </div>
  );
}

const STAR_LABELS = ["Finish the level", "Collect 80% of fish", "Find the hidden star"];

export function CompleteScreen({
  r,
  onNext,
  onRetry,
  onMenu,
}: {
  r: CompleteResult;
  onNext: (() => void) | null;
  onRetry: () => void;
  onMenu: () => void;
}) {
  const def = LEVELS[r.levelId - 1];
  return (
    <div className="overlay bg-scrim">
      <Panel className="scroll-y flex max-h-full w-[min(520px,100%)] flex-col items-stretch gap-3 p-6 text-center">
        <div className="text-sm font-bold uppercase tracking-widest text-secondary-deep">Level {r.levelId} complete</div>
        <h2 className="font-display text-3xl font-bold text-ink">{def?.name}</h2>
        <div className="flex justify-center gap-3">
          {r.stars.map((s, i) => (
            <div key={i} className="animate-star-pop" style={{ animationDelay: `${200 + i * 220}ms` }}>
              <StarIcon filled={s} className={cn("h-16 w-16", i === 1 && "-translate-y-3")} />
            </div>
          ))}
        </div>
        <ul className="mx-auto flex flex-col gap-1 text-left text-sm font-semibold">
          {STAR_LABELS.map((l, i) => (
            <li key={l} className={cn("flex items-center gap-2", r.stars[i] ? "text-ink" : "text-muted-foreground")}>
              <StarIcon filled={!!r.stars[i]} className="h-4 w-4" /> {l}
              {r.newStars[i] && <span className="rounded-full bg-accent px-2 text-[10px] font-bold text-accent-foreground">NEW</span>}
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Fish" value={`${r.fish}/${r.totalFish}`} />
          <Stat label="Distance" value={`${r.distance} m`} />
          <Stat label="Best" value={`${r.best} m`} />
        </div>
        <div className="flex items-center justify-center gap-3 font-semibold text-ink">
          <span>
            Score {r.score.toLocaleString("en-US")} {r.newBest && <span className="text-primary">· New best!</span>}
          </span>
          <span className="flex items-center gap-1">
            +<FishIcon /> {r.coins}
          </span>
        </div>
        {r.unlockedSkins.length > 0 && (
          <div className="rounded-2xl bg-accent/40 px-3 py-2 text-sm font-bold text-ink">
            New cat unlocked: {r.unlockedSkins.map((s) => getSkin(s).name).join(", ")}!
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          {onNext && (
            <GameButton size="lg" className="w-full" onClick={onNext}>
              Next level <ChevronRight className="h-6 w-6" />
            </GameButton>
          )}
          <GameButton className="flex-1" variant="secondary" onClick={onRetry}>
            <RotateCcw className="h-5 w-5" /> Retry
          </GameButton>
          <GameButton className="flex-1" variant="ghost" onClick={onMenu}>
            <Home className="h-5 w-5" /> Menu
          </GameButton>
        </div>
      </Panel>
    </div>
  );
}

export function DailyToast({ amount, streak, onClose }: { amount: number; streak: number; onClose: () => void }) {
  return (
    <div className="overlay bg-scrim" onClick={onClose}>
      <Panel className="flex w-[min(380px,100%)] flex-col items-center gap-3 p-6 text-center">
        <Gift className="h-14 w-14 animate-float text-primary" />
        <h2 className="font-display text-3xl font-bold text-ink">Daily gift!</h2>
        <div className="flex items-center gap-2 font-display text-3xl font-bold text-ink">
          +<FishIcon className="h-7 w-11" /> {amount}
        </div>
        <p className="text-sm font-semibold text-muted-foreground">Day {streak} streak. Come back tomorrow for more.</p>
        <GameButton onClick={onClose}>Yay!</GameButton>
      </Panel>
    </div>
  );
}
