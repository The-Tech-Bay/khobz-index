import { Outlet, Link, useLocation } from "react-router";
import { useTheme } from "../hooks/useTheme";
import styles from "./Layout.module.css";

export function Layout() {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  return (
    <div className={styles.layout}>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      <header className={styles.header}>
        <nav className={styles.nav} aria-label="Main navigation">
          <Link to="/" className={styles.logo}>
            <span className={styles.logoMain}>
              <span className={styles.logoK}>K</span>arama Khobz Index
            </span>
            <span className={styles.logoSub}>Kilocalorie Index</span>
          </Link>

          <div className={styles.navLinks}>
            <Link
              to="/"
              className={location.pathname === "/" ? styles.activeLink : styles.navLink}
            >
              Map
            </Link>
            <Link
              to="/methodology"
              className={location.pathname === "/methodology" ? styles.activeLink : styles.navLink}
            >
              Methodology
            </Link>
            <button
              onClick={toggleTheme}
              className={styles.themeToggle}
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            >
              {theme === "light" ? "🌙" : "☀️"}
            </button>
          </div>
        </nav>
      </header>

      <main id="main-content" className={styles.main}>
        <Outlet />
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <p className={styles.footerText}>
            Karama Khobz Index (KKI) — open food-purchasing-power data. Licensed{" "}
            <a
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noopener noreferrer"
            >
              CC BY 4.0
            </a>
          </p>
          <p className={styles.footerText}>
            <a
              href="https://github.com/The-Tech-Bay/khobz-index"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            {" · "}
            <Link to="/methodology">Methodology</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
