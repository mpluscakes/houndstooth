# Houndstooth

A moth-eaten diagonal space shooter for phone browsers. Plain HTML + Canvas +
Web Audio, no build step, no dependencies, no asset files.

The whole playfield is tilted to match the tooth: ships fire up and to the
right, and moths arrive from the top right and dive towards the bottom left.

- **Drag** anywhere to move. The ship **fires while you are touching** the
  screen. The cloth corner at the bottom right is out of play: rest your
  thumb there.
- **Double tap** to scatter: the formation bursts apart, wheels around the
  leader and regroups, opening gaps to weave through a tight spray.
- **Shoot the glowing moth**, then **catch the tooth** it drops to add a ship.
  Ships lock together into a houndstooth tiling, and every ship fires.
- **Your formation is your health.** Each hit chews one ship away; lose the
  last one and it's game over.
- Three waves per level, and a **Moth Queen** every fourth level.

Desktop: arrow keys / WASD to move, hold Space (or the mouse button) to fire,
Shift or X to scatter,
M to mute, P to pause.

## Run locally

ES modules need a web server (opening `index.html` from disk won't work):

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. Debug shortcuts: `?level=4` starts on the
first boss, `?ships=6` starts with a formation.

## Deploy (GitHub Pages)

Settings → Pages → "Deploy from a branch" → `main`, folder `/ (root)`.
On iPhone, use Share → "Add to Home Screen" for true full screen.

## Code map

| File | What lives there |
| --- | --- |
| `js/config.js` | All tuning numbers: firing angle, speeds, fire rate, formation slots, moth stats, difficulty curve |
| `js/field.js` | The tilted playfield: axis coordinates (along / across the line of fire), thumb zone, front line |
| `js/waves.js` | Wave layouts and swooping entrance paths |
| `js/enemies.js` | Moth behaviour (enter, tilted grid, dive, return) |
| `js/boss.js` | The Moth Queen and her attacks |
| `js/player.js` | The ship formation: movement, firing, catching, getting hit |
| `js/game.js` | State machine, level director, collisions, HUD and screens |
| `js/sprites.js` | Pixel art and colour palettes |
| `js/audio.js` | Sound effects and the music sequencer (songs are note arrays) |
| `js/fx.js` | Particles, glow, screen shake, flashes, score popups |
| `js/gfx.js` | Integer-scaled canvas, sprite baking, pixel font |
| `js/input.js` | Touch, mouse and keyboard |
| `js/main.js` | Boot and the 60Hz loop |
