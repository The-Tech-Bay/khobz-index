# KKI public landing — mobile map UX

**Scope:** [`landing/`](../../landing/) — Vite/React choropleth for the Khobz Index.

## Behaviour

| Input | Tooltip / hover | Country tap / click |
| --- | --- | --- |
| **Fine pointer (desktop)** | Mouse move updates a floating tooltip; mouse leave clears | Navigates to `/country/:code` immediately |
| **Coarse pointer (typical phones/tablets)** | Tooltip hidden via CSS `(pointer: coarse)`; no hover-driven tooltip state | **First tap:** preview + thicker stroke + bottom **PreviewSheet**. **Second tap** on the **same** country, or the **Explore** button, navigates. Tap the map “ocean” (transparent SVG rect under land paths) clears the preview |

## Region pills vs ranking filter

The same control drives two behaviours:

1. **`projectionConfig`** passed into `ComposableMap` (framing per macro region).
2. **`filterRecordsByMapRegion`** in [`landing/src/lib/mapRegionFilter.ts`](../../landing/src/lib/mapRegionFilter.ts): maps fixture `country.region` (basket taxonomy) to Africa / MENA / Europe / Asia / Americas / Global. **Europe** = OECD basket excluding Americas / Oceania OECD members (US, CA, GL, BM, AU, NZ) so OECD markets stay grouped without merging MENA into Africa.

When a non-global pill is chosen, the ranking title appends the region label (“· MENA”, etc.).

## Morocco Territory Normalization

The landing keeps the same global/regional map UI and `react-simple-maps` renderer. The fix is data normalization, not a Morocco-only redesign.

Generic world-map datasets may expose Western Sahara as `EH`, `ESH`, or numeric ISO `732`. The landing normalizes those features to `MA` in [`landing/src/lib/moroccoMapNormalization.ts`](../../landing/src/lib/moroccoMapNormalization.ts). As a result:

- hover/click/touch preview resolve the complete Moroccan territory to Morocco (`MA`);
- choropleth color uses Morocco’s KKI record for all Moroccan territory;
- no separate Western Sahara country page or ranking entry is created from the map interaction;
- the visual internal stroke is suppressed for Morocco-territory pieces so the public map reads as one continuous Moroccan territory.

If an official Moroccan authority GIS/TopoJSON asset is later provided, it should replace the geography asset/preprocessing layer without changing the map UI contract.

## Files

| Area | Primary files |
| --- | --- |
| Touch / coarse detection | [`useTouchDevice.ts`](../../landing/src/hooks/useTouchDevice.ts) |
| Region picker + projection presets | [`RegionPicker.tsx`](../../landing/src/components/RegionPicker.tsx) |
| Touch preview sheet | [`PreviewSheet.tsx`](../../landing/src/components/PreviewSheet.tsx) |
| Map wiring | [`WorldMap.tsx`](../../landing/src/components/WorldMap.tsx), [`MapChart.tsx`](../../landing/src/components/MapChart.tsx) |
| Home composition | [`HomePage.tsx`](../../landing/src/pages/HomePage.tsx) |

## Build / verify

```bash
cd landing && bun install && bun run build
```

Use browser devtools device emulation with a **coarse** pointer to validate the sheet and ocean dismiss.
