# Floating Village · South India

A low-poly floating-island diorama of a South Indian village, built with Three.js and no build step.
Everything is procedural (no model files): tiled-roof houses, thatched huts, a gopuram temple, banyan
and coconut palms, paddy field, pond with geese, a bullock cart and villagers walking the lane.

## Run

Any static server works (ES modules need `http://`, not `file://`):

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

Three.js r160 is vendored in `vendor/`, so it runs offline.

## Controls

- Drag to orbit, scroll/pinch to zoom.
- **Weather**: Sunny, Cloudy, Rain, Storm, Mist (keys `1`–`5`). Changes blend smoothly.
- **Time of day**: Dawn / Noon / Dusk / Night presets, a clock slider, or the *Day cycle* toggle.
- **Fine-tune**: clouds, rain, fog, wind and lightning sliders.
- **Sound** (off by default): procedural rain, wind and thunder.
- Rain then Sunny at low sun shows a rainbow while the ground is still wet.

## Layout

- `src/main.js` – scene assembly, village layout, animation loop, UI wiring
- `src/builders.js` – houses, temple, trees, people, bullock, cart, props
- `src/island.js` – island terrain, rock underside, road ribbons
- `src/life.js` – lane walkers (dogs), climbing cats, geese, ploughing path
- `src/weather.js` – sky, sun/moon, lights, clouds, rain, lightning, fog, sound
