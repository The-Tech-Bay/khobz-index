import { useState } from "react";
import { MapPanel } from "./components/MapPanel";
import { SimpleMapsVariant } from "./maps/SimpleMapsVariant";
import { D3SvgVariant } from "./maps/D3SvgVariant";
import { MapLibreVariant } from "./maps/MapLibreVariant";
import { SAMPLE_RECORDS } from "./lib/sampleData";
import { useKkiColorScale } from "./lib/colorScale";
import styles from "./App.module.css";

export function App() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const { scale, min, max } = useKkiColorScale(SAMPLE_RECORDS);
  const isDark = theme === "dark";

  return (
    <div data-theme={theme}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div>
            <p className={styles.eyebrow}>Temporary local test — delete after choosing</p>
            <h1 className={styles.title}>KKI map integration comparison</h1>
            <p className={styles.subtitle}>
              Three world-map stacks with the same sample KKI choropleth data. Hover
              countries with data; toggle dark mode to compare contrast.
            </p>
          </div>
          <button
            type="button"
            className={styles.themeToggle}
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
          >
            {isDark ? "Light mode" : "Dark mode"}
          </button>
        </div>
      </header>

      <main className={styles.grid}>
        <MapPanel
          variant="A"
          title="react-simple-maps (current)"
          stack="react-simple-maps + world-atlas"
          rendering="SVG choropleth"
          bundleHint="~45 KB gzip (map chunk in prod)"
          legendMin={min}
          legendMax={max}
          pros={[
            "Already wired in landing/",
            "Declarative React API",
            "No tile server or API key",
          ]}
          cons={[
            "Extra abstraction over d3-geo",
            "Zoom/pan via ZoomableGroup only",
            "SVG perf on very small screens",
          ]}
        >
          <SimpleMapsVariant
            records={SAMPLE_RECORDS}
            colorScale={scale}
            isDark={isDark}
          />
        </MapPanel>

        <MapPanel
          variant="B"
          title="Raw D3 geo + SVG"
          stack="d3-geo + topojson-client"
          rendering="Hand-built SVG paths"
          bundleHint="~25 KB gzip (d3-geo only)"
          legendMin={min}
          legendMax={max}
          pros={[
            "Smallest dependency surface",
            "Full control over paths & projection",
            "Same visual language as variant A",
          ]}
          cons={[
            "More manual interaction wiring",
            "No built-in zoom helper",
            "You own accessibility polish",
          ]}
        >
          <D3SvgVariant records={SAMPLE_RECORDS} colorScale={scale} isDark={isDark} />
        </MapPanel>

        <MapPanel
          variant="C"
          title="MapLibre GL JS"
          stack="maplibre-gl + GeoJSON"
          rendering="WebGL vector fill"
          bundleHint="~220 KB gzip (heaviest)"
          legendMin={min}
          legendMax={max}
          pros={[
            "Crisp at any zoom level",
            "Native pan/zoom controls",
            "Room for future tile overlays",
          ]}
          cons={[
            "Largest bundle cost",
            "WebGL context on mobile",
            "Different interaction model vs SVG",
          ]}
        >
          <MapLibreVariant
            records={SAMPLE_RECORDS}
            colorScale={scale}
            isDark={isDark}
          />
        </MapPanel>
      </main>

      <footer className={styles.footer}>
        <p>
          Sample data only · Same projection center as production · Folder:{" "}
          <code>khobz-index/test-landing/</code>
        </p>
      </footer>
    </div>
  );
}
