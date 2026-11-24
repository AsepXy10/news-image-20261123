# World News in One Image — 23 November 2026

[![make.fun · news-image-20261123](https://make.fun/badge/news-image-20261123.svg)](https://make.fun/bounty/news-image-20261123?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261123)
[![rank](https://make.fun/badge/news-image-20261123/AsepXy10/news-image-20261123/rank.svg)](https://make.fun/bounty/news-image-20261123/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261123)
[![reward](https://make.fun/badge/news-image-20261123/AsepXy10/news-image-20261123/reward.svg)](https://make.fun/bounty/news-image-20261123?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261123)

A Node 22 program that draws a 1024×1024 PNG summing up Monday 23 November
2026's world news: six headline stories in a 2×3 grid, plus a footer of four
smaller items. Everything is drawn by hand in `main.ts` — a 5×7 bitmap font,
simple vector icons, and a hand-built PNG encoder. Standard library only, no
network access at runtime, no external assets, and fully deterministic: two
runs write byte-identical PNGs.

## How to run

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

The image is written to `out/entry.png` (1024×1024, well under 1 MiB).

## The six stories

1. **COP31 collapses without a deal** — COP31 in Antalya ended with no
   agreement, the first failed UN climate talks since Copenhagen 2009, after
   oil states blocked a fossil-fuel phase-out. (Reuters, AP, BBC, Japan Times)
2. **Iran strikes Bahrain, Gulf tankers** — Bahrain says Iran hit a civilian
   site, wounding two; the US hit an Iranian oil tanker near Hormuz.
   (Reuters, AP, Al Jazeera, Japan Times)
3. **Russian drones hit Kyiv region** — A Russian drone strike on Kyiv region
   killed at least four; Kyiv hit Russian ships in Libya. (Spyglass, Euronews)
4. **Stocks rebound after AI rout** — US stock futures rebounded after an
   AI-driven tech rout sent the S&P 500 and Nasdaq into correction.
   (Spyglass)
5. **BepiColombo reaches Mercury** — Europe and Japan's BepiColombo probe
   began orbiting Mercury, though controllers reported a glitch. (Spyglass)
6. **Trump: permanent deal or strikes** — Trump demands a permanent Iran
   nuclear deal or warns of major strikes after the new year.
   (Arabia Headline, Euronews)

Footer items: Netanyahu and Eisenkot end coalition talks without a deal;
Saudi Arabia orders 50% Saudization in 17 financial professions from May
2027; Britain to build Ukrainian drones in a joint project.

Sources: Reuters, AP, BBC, Al Jazeera, Japan Times, Euronews.
