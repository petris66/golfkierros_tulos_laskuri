# GPS Builder 0.5.0

Development-only GPS Library builder for Golf Voice Scorecard AI.

## Changes
- Fetches both golf greens and numbered golf hole lines from OpenStreetMap.
- Automatically matches numbered hole geometry to the nearest green.
- Keeps manual map correction as fallback.
- Porvoo test mode exports only known unchanged holes 1-3 and 8-18.
- Porvoo holes 4-7 are intentionally excluded from the first field-test JSON.

## Porvoo workflow
1. Open `tools/gps-builder.html?v=500`.
2. Select Porvoo preset.
3. Fetch greens from OpenStreetMap.
4. Builder auto-matches numbered hole lines to greens.
5. Verify holes 1-3 and 8-18.
6. Generate JSON.
7. Download `porvoogolf.json`.
8. Add it to `data/gps/FI/`.
9. Field-test Green Center against Garmin.
