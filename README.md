# HEAT — Pedal to the Metal (fan build)

The single 473 KB `index15.html` has been split into data files you can edit on
their own. `index.html` is now a ~90-line shell: markup plus an ordered list of
`<script>` tags.

## Layout

```
index.html                     the shell — markup + script order
css/game.css                   all the original game styling
css/career.css                 career-mode styling
js/diagnostic.js               on-screen JS error reporter (safe to delete)
js/track-registry.js           TRACKS {} + defineTrack()      ← loads first
js/game.js                     the game engine
js/audio.js                    soundtrack controller
js/intro.js                    loading screen + title
js/career-map-registry.js      CAREER_PRESETS [] + defineCareerMap()
js/career.js                   career mode
data/cups.js                   championship seasons
data/career-maps/*.js          one file per career map
tracks/*.js                    one file per circuit (+ the board images)
```

## Add a track

1. Save the `const TRACK_X = defineTrack({…});` block the builder gives you as
   `tracks/<key>.js`.
2. Add one line to `index.html`, in the `<!-- ===== TRACKS ===== -->` block:
   `<script src="tracks/<key>.js"></script>`

That's it. The file order in that block is the order circuits appear on the
track-select screen. Delete a line to hide a circuit without deleting the file.

Board images still live in `tracks/` too (`tracks/Pukekohe.png` etc.) — the `.js`
and image files sit side by side quite happily.

## Add a career map

1. Export the map from Mapforge as JSON.
2. Save it as `data/career-maps/<key>.js`, wrapped in one call:

```js
defineCareerMap({ …paste the whole Mapforge JSON here… });
```

3. Add one line to `index.html` in the `<!-- ===== CAREER MAPS ===== -->` block:
   `<script src="data/career-maps/<key>.js"></script>`

**Why `.js` and not `.json`?** A plain `.json` file has to be pulled in with
`fetch()`, which browsers block on `file://` — the game would then only run from
a web server, never by double-clicking `index.html`. The one-line
`defineCareerMap(…)` wrapper keeps the payload as literal Mapforge JSON while
still working both locally and on GitHub Pages. If you'd rather have true `.json`
files, that's a small change to `career-map-registry.js` — just be aware you lose
local double-click testing.

## Edit a championship season

`data/cups.js`. A cup is an ordered list of four track keys.

## Load order

Registries before the files that register into them; data before the code that
reads it. The comment block in `index.html` spells it out. If you shuffle those
`<script>` tags, keep tracks after `track-registry.js` and before `game.js`.

## GitHub Pages

Drop the whole folder in the repo and commit. No build step, no bundler, no
`.nojekyll` needed (nothing starts with an underscore). Paths are all relative,
so it works from a project subpath like `username.github.io/heat/`.
