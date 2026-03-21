import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

const BRIGHTNESS_KEY = "propertypulse-ui-brightness";

const AppearanceContext = createContext(null);

/**
 * UI brightness (CSS filter) — browsers cannot change hardware screen brightness; this dims/boosts the app view.
 */
export function AppearanceProvider({ children }) {
  const [brightness, setBrightnessState] = useState(1);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(BRIGHTNESS_KEY);
      const v = raw == null ? 1 : parseFloat(raw);
      if (Number.isFinite(v)) {
        setBrightnessState(Math.min(1.08, Math.max(0.55, v)));
      }
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const setBrightness = useCallback((value) => {
    const n = typeof value === "number" ? value : parseFloat(value);
    if (!Number.isFinite(n)) return;
    const clamped = Math.min(1.08, Math.max(0.55, n));
    setBrightnessState(clamped);
    try {
      localStorage.setItem(BRIGHTNESS_KEY, String(clamped));
    } catch {
      /* ignore */
    }
  }, []);

  const resetBrightness = useCallback(() => setBrightness(1), [setBrightness]);

  const ctx = useMemo(
    () => ({ brightness, setBrightness, resetBrightness }),
    [brightness, setBrightness, resetBrightness]
  );

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="propertypulse-theme"
      disableTransitionOnChange
    >
      <AppearanceContext.Provider value={ctx}>
        <div
          className="min-h-screen"
          style={{
            filter: ready ? `brightness(${brightness})` : undefined,
          }}
        >
          {children}
        </div>
      </AppearanceContext.Provider>
    </NextThemesProvider>
  );
}

export function useAppearance() {
  const v = useContext(AppearanceContext);
  if (!v) {
    throw new Error("useAppearance must be used within AppearanceProvider");
  }
  return v;
}
