# KKI Landing — Map Integration Comparison

Temporary visual comparison harness for choosing the landing-page world map stack before Phase 3.

**Delete this folder** after picking an integration.

## Variants

| # | Stack | Rendering | Notes |
|---|--------|-----------|--------|
| A | `react-simple-maps` | SVG + TopoJSON | Current production choice in `landing/` |
| B | `d3-geo` (raw) | SVG paths | Same TopoJSON data, no RSM wrapper — sharper control |
| C | `maplibre-gl` | WebGL + GeoJSON | GPU vector fill; smooth zoom/pan |

All three use the same sample KKI USD values, color scale, and projection center so differences are mostly visual (stroke crispness, hover feel, zoom behavior).

## Run locally

Run these commands **one at a time** (do not paste inline `#` comments — the shell treats them as arguments):

```bash
cd khobz-index/test-landing
bun install
bun run dev
```

Then open **http://localhost:5174** in your browser.

If that port is already in use, stop the other Vite process first, or Vite may fall back to **5173**.

## What to compare

- Country border crispness at default zoom
- Color fill quality on small countries
- Hover / selection affordance
- Bundle weight feel (check Network tab)
- Dark-mode contrast (toggle in header)
- Mobile tap target feel

## Cleanup

```bash
rm -rf khobz-index/test-landing
```
