import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Info, Moon, Settings2, Sun, Type, Volume2 } from "lucide-react";
import { AirCursorControl } from "@/components/air-cursor-control";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { VoiceCommandButton } from "@/components/voice-command-button";
import type { VoiceAction } from "@/lib/voice-commands";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/ar-labs", label: "AR Labs" },
  { to: "/crime-report", label: "Crime Report" },
  { to: "/ai-news", label: "AI News" },
  { to: "/ai-intelligence", label: "AI Intelligence" },
  { to: "/world-explorer", label: "World Explorer" },
  { to: "/room-reader", label: "Room Reader" },
] as const;

type Appearance = {
  theme: "light" | "dark";
  font: "editorial" | "sans" | "serif";
  reduceMotion: boolean;
  textSize: "small" | "normal" | "large";
  voiceLanguage: "en-IN" | "en-US";
  voiceFeedback: boolean;
  cursorFeel: "steady" | "balanced" | "quick";
};
const APPEARANCE_KEY = "aevia-appearance";
const DEFAULT_APPEARANCE: Appearance = {
  theme: "light",
  font: "editorial",
  reduceMotion: false,
  textSize: "normal",
  voiceLanguage: "en-IN",
  voiceFeedback: false,
  cursorFeel: "balanced",
};

function applyAppearance(preferences: Appearance) {
  const root = document.documentElement;
  root.classList.toggle("dark", preferences.theme === "dark");
  root.classList.toggle("reduce-motion", preferences.reduceMotion);
  root.dataset.font = preferences.font;
  root.dataset.textSize = preferences.textSize;
  root.dataset.cursorFeel = preferences.cursorFeel;
  root.style.colorScheme = preferences.theme;
}

function readAppearance(): Appearance {
  try {
    const saved = JSON.parse(
      localStorage.getItem(APPEARANCE_KEY) ?? "null",
    ) as Partial<Appearance> | null;
    return {
      theme: saved?.theme === "dark" ? "dark" : "light",
      font: saved?.font === "sans" || saved?.font === "serif" ? saved.font : "editorial",
      reduceMotion: saved?.reduceMotion === true,
      textSize:
        saved?.textSize === "small" || saved?.textSize === "large" ? saved.textSize : "normal",
      voiceLanguage: saved?.voiceLanguage === "en-US" ? "en-US" : "en-IN",
      voiceFeedback: saved?.voiceFeedback === true,
      cursorFeel:
        saved?.cursorFeel === "steady" || saved?.cursorFeel === "quick"
          ? saved.cursorFeel
          : "balanced",
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

function useAppearance() {
  const [appearance, setAppearance] = useState(DEFAULT_APPEARANCE);
  useEffect(() => {
    const saved = readAppearance();
    setAppearance(saved);
    applyAppearance(saved);
  }, []);

  const update = useCallback((patch: Partial<Appearance>) => {
    setAppearance((current) => {
      const next = { ...current, ...patch };
      applyAppearance(next);
      try {
        localStorage.setItem(APPEARANCE_KEY, JSON.stringify(next));
      } catch {
        // Preferences still apply for this visit if browser storage is unavailable.
      }
      return next;
    });
  }, []);
  const setTheme = useCallback((theme: Appearance["theme"]) => update({ theme }), [update]);
  return { appearance, update, setTheme };
}

export function SiteHeader() {
  const { appearance, update, setTheme } = useAppearance();
  const navigate = useNavigate();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleVoiceCommand = useCallback(
    (action: VoiceAction) => {
      switch (action.kind) {
        case "navigate":
          void navigate({ to: action.to });
          return `Opening ${action.label}`;
        case "theme":
          setTheme(action.value);
          return `${action.value === "dark" ? "Dark" : "Light"} mode on`;
        case "settings":
          setSettingsOpen(action.open);
          return action.open ? "Opening Settings" : "Closing Settings";
        case "about":
          setAboutOpen(true);
          return "Opening About AEVIA";
        case "font":
          update({ font: action.value });
          return `Typeface set to ${action.value}`;
        case "text-size":
          update({ textSize: action.value });
          return `Text size set to ${action.value}`;
        case "reduce-motion":
          update({ reduceMotion: action.value });
          return action.value ? "Reduced motion on" : "Animations restored";
        case "air-cursor":
          window.dispatchEvent(
            new CustomEvent("aevia:air-cursor", { detail: { enabled: action.enabled } }),
          );
          return action.enabled ? "Starting Air Cursor" : "Air Cursor off";
        case "scroll":
          window.scrollTo({
            top:
              action.direction === "top"
                ? 0
                : action.direction === "bottom"
                  ? document.documentElement.scrollHeight
                  : window.scrollY + (action.direction === "down" ? 520 : -520),
            behavior: "smooth",
          });
          return `Scrolling ${action.direction}`;
        case "help":
          return "Try “open World Explorer”, “open Room Reader”, “open Settings”, “dark mode”, or “scroll down”.";
      }
    },
    [navigate, setTheme, update],
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-3 sm:px-5 md:gap-4">
        <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="AEVIA home">
          <img src="/logo-mark.png" alt="" className="size-8 shrink-0 object-contain" />
          <span className="font-display text-2xl tracking-tight">AEVIA</span>
        </Link>
        <nav className="-mx-1 flex min-w-0 flex-1 gap-1 overflow-x-auto px-1 md:justify-center">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              className="relative whitespace-nowrap rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "!text-foreground bg-card shadow-soft" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          <VoiceCommandButton
            language={appearance.voiceLanguage}
            voiceFeedback={appearance.voiceFeedback}
            onCommand={handleVoiceCommand}
          />
          <AirCursorControl />
          <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 rounded-full"
                aria-label="About AEVIA"
                title="About AEVIA"
              >
                <Info className="size-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="about-dialog rounded-3xl border-primary/20 bg-card sm:max-w-xl">
              <div className="about-dialog-brand">
                <img src="/logo-mark.png" alt="" className="size-10 object-contain" />
                <span className="eyebrow">AEVIA · FIELD GUIDE</span>
              </div>
              <DialogHeader>
                <DialogTitle className="font-display text-4xl">
                  A small lab for seeing what’s possible.
                </DialogTitle>
                <DialogDescription className="text-base leading-relaxed">
                  AEVIA brings spatial interaction, public-data exploration and machine intelligence
                  into one student-built research playground.
                </DialogDescription>
              </DialogHeader>
              <div className="about-notes">
                <div>
                  <span className="eyebrow">01 · MAKE</span>
                  <p>Try gesture, drawing and face-tracking experiments in AR Labs.</p>
                </div>
                <div>
                  <span className="eyebrow">02 · NOTICE</span>
                  <p>Follow AI-read stories and ask questions in a focused assistant.</p>
                </div>
                <div>
                  <span className="eyebrow">03 · EXPLORE</span>
                  <p>Spin a detailed Earth and discover country-level conditions.</p>
                </div>
              </div>
              <p className="about-note-foot">
                Camera access is opt-in. Crime figures are clearly labelled sample data.
              </p>
            </DialogContent>
          </Dialog>
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 rounded-full px-2 sm:px-3"
                aria-label="Open settings"
                title="Settings"
              >
                <Settings2 className="size-4" />
                <span className="hidden sm:inline">Settings</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl border-border bg-card sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-display text-3xl">Settings</DialogTitle>
                <DialogDescription>Make the AEVIA experience feel right for you.</DialogDescription>
              </DialogHeader>

              <section className="space-y-3" aria-labelledby="appearance-heading">
                <div>
                  <h3 id="appearance-heading" className="eyebrow">
                    Color theme
                  </h3>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={appearance.theme === "light" ? "default" : "outline"}
                      aria-pressed={appearance.theme === "light"}
                      onClick={() => setTheme("light")}
                      className="justify-center gap-2 rounded-xl"
                    >
                      <Sun className="size-4" /> Light
                    </Button>
                    <Button
                      type="button"
                      variant={appearance.theme === "dark" ? "default" : "outline"}
                      aria-pressed={appearance.theme === "dark"}
                      onClick={() => setTheme("dark")}
                      className="justify-center gap-2 rounded-xl"
                    >
                      <Moon className="size-4" /> Dark
                    </Button>
                  </div>
                </div>

                <label htmlFor="aevia-font" className="block">
                  <span className="eyebrow">Website typeface</span>
                  <span className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-background px-3">
                    <Type className="size-4 shrink-0 text-muted-foreground" />
                    <select
                      id="aevia-font"
                      value={appearance.font}
                      onChange={(event) =>
                        update({ font: event.target.value as Appearance["font"] })
                      }
                      className="h-11 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
                    >
                      <option value="editorial">AEVIA editorial</option>
                      <option value="sans">Modern sans</option>
                      <option value="serif">Classic serif</option>
                    </select>
                  </span>
                </label>

                <label htmlFor="aevia-text-size" className="block">
                  <span className="eyebrow">Interface text size</span>
                  <select
                    id="aevia-text-size"
                    value={appearance.textSize}
                    onChange={(event) =>
                      update({ textSize: event.target.value as Appearance["textSize"] })
                    }
                    className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="small">Compact</option>
                    <option value="normal">Standard</option>
                    <option value="large">Larger</option>
                  </select>
                </label>

                <div className="space-y-3 rounded-2xl border border-border bg-background/60 p-4">
                  <div>
                    <h3 className="eyebrow">Voice commands</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Tap the mic, wait for “Listening”, then say a page or setting. Try “show me
                      World Explorer”, “open Room Reader”, or “make the site dark”.
                    </p>
                  </div>
                  <label htmlFor="aevia-voice-language" className="block">
                    <span className="text-sm font-medium">Recognition language</span>
                    <select
                      id="aevia-voice-language"
                      value={appearance.voiceLanguage}
                      onChange={(event) =>
                        update({ voiceLanguage: event.target.value as Appearance["voiceLanguage"] })
                      }
                      className="mt-2 h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="en-IN">English (India)</option>
                      <option value="en-US">English (US)</option>
                    </select>
                  </label>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Volume2 className="size-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Speak confirmations</p>
                        <p className="text-xs text-muted-foreground">
                          Read each completed command aloud.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-label="Speak voice command confirmations"
                      aria-checked={appearance.voiceFeedback}
                      onClick={() => update({ voiceFeedback: !appearance.voiceFeedback })}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${appearance.voiceFeedback ? "border-primary bg-primary" : "border-border bg-muted"}`}
                    >
                      <span
                        className={`size-4 rounded-full bg-white shadow transition-transform ${appearance.voiceFeedback ? "translate-x-5" : "translate-x-1"}`}
                      />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Voice input needs a supported browser and microphone permission. Chrome or Edge
                    on HTTPS is recommended.
                  </p>
                </div>

                <label htmlFor="aevia-cursor-feel" className="block">
                  <span className="eyebrow">Air cursor response</span>
                  <select
                    id="aevia-cursor-feel"
                    value={appearance.cursorFeel}
                    onChange={(event) =>
                      update({ cursorFeel: event.target.value as Appearance["cursorFeel"] })
                    }
                    className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="steady">Steady · smoother movement</option>
                    <option value="balanced">Balanced</option>
                    <option value="quick">Quick · follows your hand closely</option>
                  </select>
                </label>

                <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background/60 p-3.5">
                  <div>
                    <p className="text-sm font-medium">Reduce motion</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Limit decorative movement and interface transitions.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-label="Reduce motion"
                    aria-checked={appearance.reduceMotion}
                    onClick={() => update({ reduceMotion: !appearance.reduceMotion })}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${appearance.reduceMotion ? "border-primary bg-primary" : "border-border bg-muted"}`}
                  >
                    <span
                      className={`size-4 rounded-full bg-white shadow transition-transform ${appearance.reduceMotion ? "translate-x-5" : "translate-x-1"}`}
                    />
                  </button>
                </div>
              </section>

              <p className="text-xs text-muted-foreground">
                Preferences are saved on this device. Air Cursor camera access starts only when you
                enable it; voice input starts only when you tap the mic.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full rounded-xl"
                onClick={() => update(DEFAULT_APPEARANCE)}
              >
                Restore default settings
              </Button>
            </DialogContent>
          </Dialog>
          <Link
            to="/exit"
            className="hidden rounded-full border border-border px-4 py-1.5 text-sm transition-colors hover:border-primary hover:text-primary lg:block"
          >
            Exit
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  if (path === "/exit") return null;
  return (
    <footer className="mt-24 border-t border-border bg-card/60">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-4">
        <div className="md:col-span-1">
          <div className="flex items-center gap-3">
            <img src="/logo-mark.png" alt="" className="size-9 object-contain" />
            <p className="font-display text-3xl">AEVIA</p>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            © 2026 AEVIA. Created by Viaan. Built for educational purposes as a school software
            project.
          </p>
        </div>
        <div>
          <p className="eyebrow">Modules</p>
          <ul className="mt-3 space-y-2 text-sm">
            {NAV.slice(1).map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="hover:text-primary">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="eyebrow">Project</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>viaan project</li>
            <li>Academic use{"\u00a0"}</li>
            <li>
              <Link to="/exit" className="text-foreground hover:text-primary">
                Exit session
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="eyebrow">Data</p>
          <p className="mt-3 text-sm text-muted-foreground">
            Crime figures shown are clearly labelled sample data. Live figures are sourced from NCRB
            publications.
          </p>
        </div>
      </div>
      <p className="border-t border-border px-5 py-5 text-center text-xs text-muted-foreground">
        © 2026 AEVIA. Built for educational purposes.
      </p>
    </footer>
  );
}

export function PageIntro({
  module,
  title,
  children,
}: {
  module: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-7xl px-5 pt-14 pb-8">
      <p className="eyebrow">
        <span className="text-primary">●</span> {module}
      </p>
      <h1 className="mt-4 font-display text-6xl leading-[0.95] tracking-tight md:text-7xl">
        {title}
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-muted-foreground">{children}</p>
    </div>
  );
}
