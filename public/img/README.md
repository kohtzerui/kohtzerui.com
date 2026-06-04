# Billboard Photos

Drop your images here. They will be served at `/img/<filename>` by Vite.

## SBCC26
Add photos for the SBCC26 billboard here, e.g.:
- `sbcc26-team.jpg`
- `sbcc26-cluster.jpg`
- `sbcc26-results.jpg`

## Recommended format
- **Size:** 1024 × 512 px (2:1 ratio matches the billboard panels)
- **Format:** JPG or PNG
- **Naming:** lowercase with hyphens, e.g. `sbcc26-team.jpg`

## Usage
In `STATION_CONFIGS` (objects.js), set the `photo` field:
```js
photo: '/img/sbcc26-team.jpg'
```
