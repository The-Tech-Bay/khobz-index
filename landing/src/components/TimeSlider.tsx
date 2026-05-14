import { useState, useEffect, useCallback, useRef } from "react";
import { formatMonth } from "../data";
import styles from "./TimeSlider.module.css";

interface Props {
  months: string[];
  selectedMonth: string;
  onChange: (month: string) => void;
}

export function TimeSlider({ months, selectedMonth, onChange }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentIndex = months.indexOf(selectedMonth);

  const stopPlaying = useCallback(() => {
    setIsPlaying(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const handlePlay = useCallback(() => {
    if (isPlaying) {
      stopPlaying();
      return;
    }

    let idx = currentIndex >= months.length - 1 ? 0 : currentIndex;
    if (idx === 0) onChange(months[0]!);
    setIsPlaying(true);

    intervalRef.current = setInterval(() => {
      idx += 1;
      if (idx >= months.length) {
        stopPlaying();
        return;
      }
      onChange(months[idx]!);
    }, 1500);
  }, [isPlaying, currentIndex, months, onChange, stopPlaying]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    stopPlaying();
    const idx = Number(e.target.value);
    const month = months[idx];
    if (month) onChange(month);
  };

  return (
    <div className={styles.container}>
      <div className={styles.controls}>
        <button
          onClick={handlePlay}
          className={styles.playButton}
          aria-label={isPlaying ? "Pause time animation" : "Play time animation"}
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? "⏸" : "▶"}
        </button>

        <input
          type="range"
          min={0}
          max={months.length - 1}
          value={currentIndex === -1 ? 0 : currentIndex}
          onChange={handleSliderChange}
          className={styles.slider}
          aria-label="Select month"
          aria-valuetext={formatMonth(selectedMonth)}
        />
      </div>

      <div className={styles.labels}>
        <span className={styles.label}>{formatMonth(months[0]!)}</span>
        <span className={styles.currentLabel}>
          {formatMonth(selectedMonth)}
        </span>
        <span className={styles.label}>{formatMonth(months[months.length - 1]!)}</span>
      </div>
    </div>
  );
}
