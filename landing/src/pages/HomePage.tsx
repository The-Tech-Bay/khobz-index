import { useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import {
  getLatestMonth,
  getAvailableMonths,
  getAllRecordsForMonth,
  formatMonth,
} from "../data";
import { RegionPicker, projectionForRegion } from "../components/RegionPicker";
import type { MapRegionId } from "../lib/mapRegionFilter";
import { filterRecordsByMapRegion } from "../lib/mapRegionFilter";
import { WorldMap } from "../components/WorldMap";
import { TimeSlider } from "../components/TimeSlider";
import { CountryRanking } from "../components/CountryRanking";
import { useTouchDevice } from "../hooks/useTouchDevice";
import styles from "./HomePage.module.css";

const MAP_REGION_HEADING_SUFFIX: Record<Exclude<MapRegionId, "global">, string> = {
  africa: "Africa",
  mena: "MENA",
  europe: "Europe",
  asia: "Asia",
  americas: "Americas",
};

export function HomePage() {
  const months = getAvailableMonths();
  const [selectedMonth, setSelectedMonth] = useState(getLatestMonth());
  const [mapRegion, setMapRegion] = useState<MapRegionId>("global");
  const records = getAllRecordsForMonth(selectedMonth);
  const projectionConfig = projectionForRegion(mapRegion);
  const isTouchDevice = useTouchDevice();

  const rankingRecords = useMemo(
    () => filterRecordsByMapRegion(records, mapRegion),
    [records, mapRegion],
  );

  return (
    <>
      <Helmet>
        <title>Karama Khobz Index — What does a day of food cost around the world?</title>
      </Helmet>

      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <h1 className={styles.title}>
            What does a day of food cost{" "}
            <span className={styles.accent}>around the world?</span>
          </h1>
          <p className={styles.subtitle}>
            The Karama Khobz Index measures the cost of one day of staple
            subsistence calories (~2,200 kcal) using region-appropriate baskets.
            An open, calorie-grounded alternative to the Big Mac Index.
          </p>
        </div>
      </section>

      <section className={styles.mapSection} aria-label="Interactive world map">
        <div className={styles.mapContainer}>
          <div className={styles.mapHeader}>
            <h2 className={styles.mapTitle}>
              Cost of 1 KK — {formatMonth(selectedMonth)}
            </h2>
            <p className={styles.mapCaption}>
              {isTouchDevice ? (
                <>
                  Tap a country to preview. Tap again—or use{" "}
                  <strong className={styles.captionAccent}>Explore</strong>—to
                  open details.
                </>
              ) : (
                <>
                  Hover over a country to see details. Click to explore.
                </>
              )}
            </p>
          </div>

          <RegionPicker id="map-region-picker" value={mapRegion} onChange={setMapRegion} />

          <WorldMap
            records={records}
            selectedMonth={selectedMonth}
            projectionConfig={projectionConfig}
          />

          <TimeSlider
            months={months}
            selectedMonth={selectedMonth}
            onChange={setSelectedMonth}
          />
        </div>
      </section>

      <section className={styles.rankingSection} aria-label="Country rankings">
        <div className={styles.rankingContainer}>
          <h2 className={styles.sectionTitle}>
            Ranking by USD cost — {formatMonth(selectedMonth)}
            {mapRegion !== "global" ? (
              <span className={styles.sectionRegionHint}>
                {" "}
                · {MAP_REGION_HEADING_SUFFIX[mapRegion]}
              </span>
            ) : null}
          </h2>
          <CountryRanking records={rankingRecords} />
        </div>
      </section>
    </>
  );
}
