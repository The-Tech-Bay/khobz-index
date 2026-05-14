import { Link } from "react-router";
import { Helmet } from "react-helmet-async";

export function NotFoundPage() {
  return (
    <div style={{ textAlign: "center", padding: "var(--space-16) var(--space-4)" }}>
      <Helmet>
        <title>Page not found — Khobz Index</title>
      </Helmet>
      <h1>404</h1>
      <p style={{ color: "var(--fg-muted)", marginTop: "var(--space-4)" }}>
        This page doesn't exist.
      </p>
      <Link to="/" style={{ marginTop: "var(--space-6)", display: "inline-block" }}>
        Back to map
      </Link>
    </div>
  );
}
