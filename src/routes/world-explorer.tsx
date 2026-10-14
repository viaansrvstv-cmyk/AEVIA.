import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CloudSun, Globe2 } from "lucide-react";
import { PageIntro } from "@/components/site-chrome";
import { WorldLocationPanel } from "@/components/world-location-panel";
import { Button } from "@/components/ui/button";
import type { Country, Location } from "@/lib/world-explorer";
import data from "@/assets/world-countries.json";

const WorldGlobe = lazy(() => import("@/components/world-globe"));
const countries = (data as Country[]).slice().sort((a, b) => a.name.localeCompare(b.name));

export const Route = createFileRoute("/world-explorer")({
  head: () => ({
    meta: [
      { title: "World Explorer — live globe | AEVIA" },
      {
        name: "description",
        content:
          "Explore an interactive Earth with country borders, real local time, live weather and country vitals.",
      },
      { property: "og:title", content: "World Explorer — live globe | AEVIA" },
      {
        property: "og:description",
        content:
          "Explore an interactive Earth with country borders, real local time, live weather and country vitals.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WorldExplorer,
});

class GlobeBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    if (this.state.failed)
      return (
        <div className="world-load">
          <div className="text-center">
            <p>The globe couldn’t load. Country details are still available above.</p>
            <Button
              variant="outline"
              className="mt-4 rounded-full"
              onClick={() => this.setState({ failed: false })}
            >
              Retry globe
            </Button>
          </div>
        </div>
      );
    return this.props.children;
  }
}
function WorldExplorer() {
  const [location, setLocation] = useState<Location>();
  const [focus, setFocus] = useState<Country>();
  const [cloudsOn, setCloudsOn] = useState(true);
  const [panelClosing, setPanelClosing] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);
  useEffect(
    () => () => {
      if (closeTimer.current !== undefined) window.clearTimeout(closeTimer.current);
    },
    [],
  );
  const closePanel = useCallback(() => {
    setPanelClosing(true);
    if (closeTimer.current !== undefined) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      setLocation(undefined);
      setPanelClosing(false);
      closeTimer.current = undefined;
    }, 220);
  }, []);
  const select = useCallback((value: Location) => {
    if (closeTimer.current !== undefined) window.clearTimeout(closeTimer.current);
    closeTimer.current = undefined;
    setPanelClosing(false);
    setLocation(value);
  }, []);
  return (
    <section className="world-page">
      <PageIntro module="Module 05 · Spatial" title="World Explorer">
        One planet. A thousand perspectives. Local time, weather and the world’s vitals — connected
        in real time.
      </PageIntro>
      <div className="mx-auto max-w-7xl px-5">
        <div className="world-toolbar">
          <p className="eyebrow flex items-center gap-2">
            <Globe2 className="size-4 text-primary" />
            Planet Earth · Live conditions
          </p>
          <div className="world-toolbar-actions">
            <select
              className="world-select"
              aria-label="Choose a country"
              value={location?.country.id ?? ""}
              onChange={(e) => {
                const country = countries.find((c) => c.id === e.target.value);
                if (country) {
                  setFocus(country);
                  select({ country, lat: country.lat, lon: country.lon });
                }
              }}
            >
              <option value="" disabled>
                Choose a country
              </option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              size="sm"
              className="world-cloud-toggle rounded-full"
              aria-pressed={cloudsOn}
              onClick={() => setCloudsOn((value) => !value)}
            >
              <CloudSun className="size-4" />
              Clouds {cloudsOn ? "on" : "off"}
            </Button>
          </div>
        </div>
        <div className="world-stage">
          <GlobeBoundary>
            <ClientOnly fallback={<p className="world-load">Preparing planet Earth…</p>}>
              <Suspense fallback={<p className="world-load">Preparing planet Earth…</p>}>
                <WorldGlobe
                  countries={countries}
                  selected={location?.country}
                  focus={focus}
                  onSelect={select}
                  cloudsOn={cloudsOn}
                />
              </Suspense>
            </ClientOnly>
          </GlobeBoundary>
          {location && (
            <div className={`world-panel-slot${panelClosing ? " is-closing" : ""}`}>
              <WorldLocationPanel
                key={location.country.id}
                location={location}
                onClose={closePanel}
              />
            </div>
          )}
        </div>
        <p className="world-caption">
          Satellite-style day imagery · Optional moving cloud layer · Natural Earth country
          boundaries. <a href="/earth-texture-credits.txt">Texture sources &amp; credits</a>.
          Borders are cartographic references, not a statement on territorial claims.
        </p>
      </div>
    </section>
  );
}
