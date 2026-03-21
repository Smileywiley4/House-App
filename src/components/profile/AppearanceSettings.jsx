import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, RotateCcw } from "lucide-react";
import { useAppearance } from "@/lib/AppearanceProvider";

const THEME_OPTIONS = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
];

export default function AppearanceSettings() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { brightness, setBrightness, resetBrightness } = useAppearance();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="max-w-lg py-8 text-sm text-muted-foreground">Loading display settings…</div>
    );
  }

  return (
    <div className="max-w-lg space-y-10">
      <div>
        <h2 className="text-lg font-bold text-foreground mb-1">Theme</h2>
        <p className="text-sm text-muted-foreground">
          Choose a light or dark look, or follow your device setting (System).
        </p>
        <div className="flex flex-wrap gap-3 mt-5">
          {THEME_OPTIONS.map(({ id, label, icon: Icon }) => {
            const active = theme === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTheme(id)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${
                  active
                    ? "border-[#10b981] bg-[#10b981]/10 text-[#10b981] ring-2 ring-[#10b981]/20"
                    : "border-border bg-card text-foreground hover:border-[#10b981]/40"
                }`}
              >
                <Icon size={18} />
                {label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Active appearance: <span className="font-medium text-foreground capitalize">{resolvedTheme || theme}</span>
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-bold text-foreground mb-1">Display brightness</h2>
        <p className="text-sm text-muted-foreground mb-5">
          Dims or brightens the whole app in your browser. This does not change your monitor or phone hardware
          brightness — only how Property Pulse is drawn.
        </p>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Softer</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Brighter</span>
          </div>
          <input
            type="range"
            min={0.55}
            max={1.08}
            step={0.01}
            value={brightness}
            onChange={(e) => setBrightness(parseFloat(e.target.value))}
            className="w-full"
            aria-label="App brightness"
          />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {Math.round(brightness * 100)}% <span className="text-xs">(100% = default)</span>
            </span>
            <button
              type="button"
              onClick={resetBrightness}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#10b981] hover:underline"
            >
              <RotateCcw size={14} />
              Reset to 100%
            </button>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Settings are saved in this browser only. Clearing site data will reset them.
      </p>
    </div>
  );
}
