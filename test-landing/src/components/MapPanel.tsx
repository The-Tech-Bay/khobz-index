import type { ReactNode } from "react";
import styles from "./MapPanel.module.css";

interface Props {
  variant: "A" | "B" | "C";
  title: string;
  stack: string;
  rendering: string;
  bundleHint: string;
  pros: string[];
  cons: string[];
  children: ReactNode;
  legendMin: number;
  legendMax: number;
}

export function MapPanel({
  variant,
  title,
  stack,
  rendering,
  bundleHint,
  pros,
  cons,
  children,
  legendMin,
  legendMax,
}: Props) {
  return (
    <article className={styles.panel} aria-labelledby={`map-${variant}-title`}>
      <header className={styles.header}>
        <div className={styles.badge}>Variant {variant}</div>
        <h2 id={`map-${variant}-title`} className={styles.title}>
          {title}
        </h2>
        <dl className={styles.meta}>
          <div>
            <dt>Stack</dt>
            <dd>{stack}</dd>
          </div>
          <div>
            <dt>Rendering</dt>
            <dd>{rendering}</dd>
          </div>
          <div>
            <dt>Bundle</dt>
            <dd>{bundleHint}</dd>
          </div>
        </dl>
      </header>

      {children}

      <div className={styles.legend} aria-hidden="true">
        <span>${legendMin.toFixed(2)}</span>
        <div className={styles.legendBar} />
        <span>${legendMax.toFixed(2)}</span>
      </div>

      <div className={styles.notes}>
        <div>
          <h3>Pros</h3>
          <ul>
            {pros.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Cons</h3>
          <ul>
            {cons.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}
