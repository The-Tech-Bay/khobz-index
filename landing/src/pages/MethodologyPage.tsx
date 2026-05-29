import { Helmet } from "react-helmet-async";
import styles from "./MethodologyPage.module.css";

const BASKETS = [
  { region: "MENA / North Africa", nickname: "Khobz basket", items: "Wheat flour, cooking oil, sugar, pulses", kcal: "~15,400" },
  { region: "South Asia", nickname: "Atta basket", items: "Wheat flour, rice, lentils, edible oil", kcal: "~15,200" },
  { region: "East / Southern Africa", nickname: "Sadza / Ugali basket", items: "Maize meal, cooking oil, dried beans, sugar", kcal: "~15,300" },
  { region: "West Africa", nickname: "Riz basket", items: "Rice, cassava/yam, palm oil, dried fish", kcal: "~15,100" },
  { region: "East Asia", nickname: "Mihan basket", items: "Rice, cooking oil, soy, sugar", kcal: "~15,300" },
  { region: "Latin America", nickname: "Tortilla basket", items: "Maize/wheat flour, oil, black beans, sugar", kcal: "~15,400" },
  { region: "OECD / Europe", nickname: "Loaf basket", items: "Wheat bread, dairy, oil, sugar, eggs", kcal: "~15,500" },
];

const SOURCE_ROADMAP = [
  { market: "United States", priority: "BLS Average Retail Food Prices", status: "Planned — improves absolute US levels vs FAOSTAT producer proxies" },
  { market: "EU / OECD", priority: "Eurostat HICP food sub-index and national retail food datasets", status: "Research" },
  { market: "Developing markets", priority: "FAO FPMA, WFP/HDX, World Bank RTFP", status: "Partial — WFP VAM where available" },
  { market: "Universal fallback", priority: "IMF Food CPI for local basket movement without item prices", status: "Implemented for historical CPI chaining" },
];

const FAQ = [
  {
    q: "What is a KK?",
    a: "One KK (Khobz unit) represents one day of staple subsistence calories for one adult — roughly 2,200 kcal. The regional basket is calibrated to approximately 7 days of subsistence per purchase unit (~15,300 kcal). A KK is a biological constant: a Casablancan and a Mumbaikar both need ~2,200 kcal/day — the biology is universal even when the menu is not.",
  },
  {
    q: "How is this different from the Big Mac Index?",
    a: "The Big Mac Index uses a single processed product available mainly in wealthier countries. The KKI uses region-appropriate baskets of staple subsistence foods (flour, oil, pulses, rice) that reflect what people in each region actually eat to survive. KKI is calorie-grounded (2,200 kcal/day), open-source, and covers countries where McDonald's doesn't operate.",
  },
  {
    q: "How often is it updated?",
    a: "KKI refreshes source checks weekly and publishes canonical country records at monthly grain. The pipeline runs every Monday at 06:00 UTC; monthly snapshots are archived on GitHub Releases, IPFS, and the Internet Archive.",
  },
  {
    q: "Can I use this data?",
    a: "Yes. All data files are licensed under CC BY 4.0. Download monthly releases from GitHub, fetch content-addressed snapshots from IPFS, or browse the Internet Archive. Citation format and BibTeX are available in the data README.",
  },
  {
    q: "What sources does the index use in v1.0?",
    a: "As implemented today: FAO Food Price Index sub-indices (global cereals, oils, sugar), FAOSTAT producer/wholesale commodity prices (local leg where available), WFP VAM DataBridges (crisis markets), World Bank Pink Sheet (Brent crude), and gold spot (Goldprice.dev, Metals.dev, LBMA fallbacks). Each data slot has ≥2 source fallback chains. See docs/kki/kki-data-quality.md for caveats.",
  },
  {
    q: "What do full, degraded, and global_only mean?",
    a: "These quality labels describe local basket coverage, separate from historical-estimate confidence. full = enough local prices to use the nominal basket. degraded = at least ~60% of basket weight has prices, but some items are missing (weights re-normalized). global_only = below the ~60% weight threshold, so the local leg is suppressed and KKI uses only the global commodity track. Countries can show commodity rows below threshold without using them in the formula.",
  },
  {
    q: "What does the alpha (α) parameter mean?",
    a: "Alpha controls the balance between local market prices and global commodity prices in the hybrid formula. α = 0.65 (default) means 65% local, 35% global when the local leg is accepted. Countries with subsidized markets (e.g., Egypt) use α = 0.50. If local coverage fails the threshold, α falls to 0.00 (global_only).",
  },
];

export function MethodologyPage() {
  return (
    <div className={styles.page}>
      <Helmet>
        <title>Methodology — Karama Khobz Index</title>
        <meta
          name="description"
          content="How the Karama Khobz Index works: caloric-subsistence invariant, hybrid weighting formula, regional baskets, and data sources."
        />
      </Helmet>

      <h1 className={styles.title}>Methodology</h1>
      <p className={styles.intro}>
        The Karama Khobz Index (KKI) measures the <strong>local-currency cost
        of one day of staple subsistence calories</strong> (~2,200 kcal) for one
        adult. Scientific alias: Karama Kilocalorie Index. It is an open,
        calorie-grounded alternative to the Big Mac Index — published reference
        data, not a currency or investment product.
      </p>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>The caloric anchor</h2>
        <div className={styles.callout}>
          <span className={styles.calloutEmphasis}>1 KK ≈ 1 day of food</span>
          <span className={styles.calloutSub}>
            ~2,200 kcal from a fixed regional basket of staples
          </span>
        </div>
        <p className={styles.body}>
          Each regional basket is calibrated to approximately 7 days of
          subsistence per purchase unit (~15,300 kcal). This biological constant
          is the universal anchor — the biology is universal even when the menu
          is not.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>The formula</h2>
        <div className={styles.formulaBox}>
          <div className={styles.formulaDiagram}>
            <div className={styles.formulaBlock}>
              <span className={styles.formulaLabel}>KKI</span>
            </div>
            <span className={styles.formulaEquals}>=</span>
            <div className={styles.formulaGroup}>
              <div className={styles.formulaBlockLocal}>
                <span className={styles.formulaAlpha}>α</span>
                <span className={styles.formulaTimes}>×</span>
                <span className={styles.formulaLabel}>LOCAL basket</span>
              </div>
              <span className={styles.formulaPlus}>+</span>
              <div className={styles.formulaBlockGlobal}>
                <span className={styles.formulaAlpha}>(1 − α)</span>
                <span className={styles.formulaTimes}>×</span>
                <span className={styles.formulaLabel}>GLOBAL basket</span>
              </div>
            </div>
          </div>

          <div className={styles.formulaLegend}>
            <div className={styles.formulaLegendItem}>
              <span className={styles.dotLocal} />
              <strong>LOCAL basket</strong> — weighted average of regional staple
              prices from WFP VAM, FAOSTAT, and national statistics (when coverage
              clears the ~60% nominal-weight threshold)
            </div>
            <div className={styles.formulaLegendItem}>
              <span className={styles.dotGlobal} />
              <strong>GLOBAL basket</strong> — FAO Food Price Index
              sub-indices (cereals, oils, sugar) + Brent crude + gold spot,
              converted to local currency
            </div>
            <div className={styles.formulaLegendItem}>
              <span className={styles.dotAlpha} />
              <strong>α (alpha)</strong> — per-country hybrid weight (default
              0.65). Tuned by market type: high-trust = 0.80, standard = 0.65,
              subsidy-heavy = 0.50, low-trust = 0.35. Forced to 0 when local
              coverage fails.
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Regional baskets</h2>
        <p className={styles.body}>
          Seven region-appropriate baskets, each calibrated to ~7 days of
          subsistence. Cross-region comparability: 1 KK in Casablanca = 1 KK in
          Mumbai = 1 KK in Sao Paulo.
        </p>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Region</th>
                <th>Basket</th>
                <th>Staples</th>
                <th>Calories</th>
              </tr>
            </thead>
            <tbody>
              {BASKETS.map((b) => (
                <tr key={b.region}>
                  <td className={styles.regionName}>{b.region}</td>
                  <td className={styles.basketName}>{b.nickname}</td>
                  <td>{b.items}</td>
                  <td className={styles.numeric}>{b.kcal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Source coverage roadmap</h2>
        <p className={styles.body}>
          v1.0 publishes with the sources above. Better local coverage should
          improve quality labels — it does not silently backfill weak data as
          observed.
        </p>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Market</th>
                <th>Priority source</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {SOURCE_ROADMAP.map((row) => (
                <tr key={row.market}>
                  <td className={styles.regionName}>{row.market}</td>
                  <td>{row.priority}</td>
                  <td>{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Frequently asked questions</h2>
        <div className={styles.faqList}>
          {FAQ.map((item) => (
            <details key={item.q} className={styles.faqItem}>
              <summary className={styles.faqQuestion}>{item.q}</summary>
              <p className={styles.faqAnswer}>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Full methodology</h2>
        <p className={styles.body}>
          For the complete research document covering data sources, reliability
          tiers, failure modes, and risk analysis, see{" "}
          the{" "}
          <a
            href="https://github.com/The-Tech-Bay/khobz-index/blob/main/docs/kki/kki_research.md"
            target="_blank"
            rel="noopener noreferrer"
          >
            full methodology on GitHub
          </a>
          {" "}(<code>docs/kki/kki_research.md</code> in this repo).
        </p>
        <p className={styles.license}>
          Data licensed under{" "}
          <a
            href="https://creativecommons.org/licenses/by/4.0/"
            target="_blank"
            rel="noopener noreferrer"
          >
            CC BY 4.0
          </a>
          . Open data. Open methodology. Open source.
        </p>
      </section>
    </div>
  );
}
