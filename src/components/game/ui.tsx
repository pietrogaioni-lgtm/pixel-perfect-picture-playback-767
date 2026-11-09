import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export const gameButton = cva(
  "relative inline-flex select-none items-center justify-center gap-2 rounded-2xl border-[3px] border-ink font-display font-semibold tracking-wide transition-transform duration-100 active:translate-y-[3px] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/50",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground shadow-[0_5px_0_0_var(--primary-deep)] hover:brightness-105 active:shadow-[0_2px_0_0_var(--primary-deep)]",
        secondary: "bg-secondary text-secondary-foreground shadow-[0_5px_0_0_var(--secondary-deep)] hover:brightness-105 active:shadow-[0_2px_0_0_var(--secondary-deep)]",
        gold: "bg-accent text-accent-foreground shadow-[0_5px_0_0_var(--accent-deep)] hover:brightness-105 active:shadow-[0_2px_0_0_var(--accent-deep)]",
        danger: "bg-destructive text-destructive-foreground shadow-[0_5px_0_0_var(--destructive-deep)] hover:brightness-105 active:shadow-[0_2px_0_0_var(--destructive-deep)]",
        ghost: "bg-card text-card-foreground shadow-[0_5px_0_0_var(--border)] hover:bg-muted active:shadow-[0_2px_0_0_var(--border)]",
        hud: "border-cream/80 bg-ink/50 text-cream backdrop-blur-sm shadow-none hover:bg-ink/70",
      },
      size: {
        sm: "h-10 px-4 text-sm",
        md: "h-12 px-6 text-base",
        lg: "h-14 px-8 text-xl",
        icon: "h-12 w-12 text-lg",
        hud: "h-14 w-14 text-xl",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface GameButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof gameButton> {}

export const GameButton = forwardRef<HTMLButtonElement, GameButtonProps>(({ className, variant, size, ...props }, ref) => (
  <button ref={ref} className={cn(gameButton({ variant, size }), className)} {...props} />
));
GameButton.displayName = "GameButton";

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("panel animate-pop-in", className)}>{children}</div>;
}

export function FishIcon({ className, gold = false }: { className?: string; gold?: boolean }) {
  return (
    <svg viewBox="0 0 32 20" className={cn("inline-block h-5 w-8", className)} aria-hidden>
      <path d="M6 10 L0 3 L1 10 L0 17 Z" fill={gold ? "#e09b12" : "#3f8fd0"} />
      <ellipse cx="17" cy="10" rx="12" ry="7.5" fill={gold ? "#ffcf3f" : "#7fc8f8"} />
      <ellipse cx="16" cy="7" rx="6" ry="2" fill="#ffffff" opacity="0.55" />
      <circle cx="23" cy="8.5" r="1.8" fill="#15202b" />
    </svg>
  );
}

export function StarIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("inline-block h-6 w-6", className)} aria-hidden>
      <path
        d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"
        className={filled ? "fill-accent stroke-ink" : "fill-ink/20 stroke-ink/40"}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FishBadge({ amount, className }: { amount: number; className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-2 rounded-full border-[3px] border-ink bg-card px-3 py-1 font-display text-lg font-semibold text-ink shadow-pop", className)}>
      <FishIcon />
      <span className="tabular-nums">{amount.toLocaleString("en-US")}</span>
    </div>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("relative select-none text-center leading-[0.9]", className)}>
      <svg viewBox="0 0 120 70" className="absolute -top-[0.62em] left-[0.1em] h-[0.95em] w-auto animate-float" aria-hidden>
        <path d="M20 60 Q18 30 30 22 L36 4 L46 20 Q60 16 74 20 L84 4 L90 22 Q102 30 100 60 Z" className="fill-ink" />
        <path d="M24 58 Q22 32 33 25 L37 11 L45 23 Q60 19 75 23 L83 11 L87 25 Q98 32 96 58 Z" className="fill-primary" />
        <ellipse cx="48" cy="40" rx="5" ry="7" className="fill-cream" />
        <ellipse cx="72" cy="40" rx="5" ry="7" className="fill-cream" />
        <circle cx="49" cy="41" r="3" className="fill-ink" />
        <circle cx="73" cy="41" r="3" className="fill-ink" />
        <path d="M57 49 L63 49 L60 53 Z" className="fill-destructive" />
      </svg>
      <div className="logo-text">Whisker</div>
      <div className="logo-text logo-text-alt -mt-[0.1em]">Rooftops</div>
    </div>
  );
}
