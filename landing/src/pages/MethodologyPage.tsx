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
    a: "KKI refreshes source checks weekly and publishes canonical country records at monthly grain. The pipeline runs every Monday at 06:00 UTC; monthly snapshots are archived on the first Monday of each month to GitHub Releases, IPFS, and the Internet Archive. Weekly intermediate values are available via the closed API for registered clients (including the Karama promise-tracking app).",
  },
  {
    q: "Can I use this data?",
    a: "Yes. All data files are licensed under CC BY 4.0. Download monthly releases from GitHub, fetch content-addressed snapshots from IPFS, or browse the Internet Archive. Citation format and BibTeX are available in the data README.",
  },
  {
    q: "What sources does the index use?",
    a: "The KKI draws from six source tiers: FAO Food Price Index (global cereals, oils, sugar sub-indices), FAOSTAT (local commodity prices), WFP VAM DataBridges (local market prices for crisis countries), World Bank Pink Sheet (energy/Brent crude), and gold spot from Goldprice.dev, Metals.dev, and LBMA. Each data slot has ≥2 source fallback chains.",
  },
  {
    q: "What does the alpha (α) parameter mean?",
    a: "Alpha controls the balance between local market prices and global commodity prices in the hybrid formula. α = 0.65 (default) means 65% local, 35% global. Countries with subsidized markets (e.g., Egypt) use α = 0.50 to lean more on global prices. Countries with unreliable local data use α = 0.35. If local data is entirely missing, α falls to 0.00 (global-only).",
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
        adult. It is an open, calorie-grounded alternative to the Big Mac Index.
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
              prices from WFP VAM, FAOSTAT, and national statistics
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
              subsidy-heavy = 0.50, low-trust = 0.35
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
          tiers, failure modes, and risk analysis, see the{" "}
          <a
            href="https://github.com/The-Tech-Bay/khobz-index/blob/main/docs/kki/kki_research.md"
            target="_blank"
            rel="noopener noreferrer"
          >
            full methodology on GitHub
          </a>
          .
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
