import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router";
import { Layout } from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { NotFoundPage } from "./pages/NotFoundPage";

const CountryPage = lazy(() =>
  import("./pages/CountryPage").then((m) => ({ default: m.CountryPage })),
);
const MethodologyPage = lazy(() =>
  import("./pages/MethodologyPage").then((m) => ({ default: m.MethodologyPage })),
);

function PageFallback() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-16)" }}>
      <span style={{ color: "var(--fg-muted)" }}>Loading...</span>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route
          path="country/:code"
          element={
            <Suspense fallback={<PageFallback />}>
              <CountryPage />
            </Suspense>
          }
        />
        <Route
          path="methodology"
          element={
            <Suspense fallback={<PageFallback />}>
              <MethodologyPage />
            </Suspense>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
