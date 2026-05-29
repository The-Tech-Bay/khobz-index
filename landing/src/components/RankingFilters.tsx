import type { RankingFilterMode } from '../lib/rankingFilters';
import { rankingFilterLabel } from '../lib/rankingFilters';
import styles from './RankingFilters.module.css';

interface Props {
  mode: RankingFilterMode;
  onChange: (mode: RankingFilterMode) => void;
}

const MODES: RankingFilterMode[] = ['local_only', 'include_partial', 'include_global'];

export function RankingFilters({ mode, onChange }: Props) {
  return (
    <div className={styles.row} role="group" aria-label="Ranking quality filters">
      {MODES.map((value) => (
        <button
          key={value}
          type="button"
          className={mode === value ? styles.active : styles.button}
          aria-pressed={mode === value}
          onClick={() => onChange(value)}
        >
          {rankingFilterLabel(value)}
        </button>
      ))}
    </div>
  );
}
