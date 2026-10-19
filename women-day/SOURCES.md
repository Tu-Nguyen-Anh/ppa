# 20/10 artwork: sources and licences

Artwork of the 20/10 card style `women-day-bouquet` (the bouquet in `bouquet/`, the envelope and letter decoration in
`decor/`; the letter's flower clusters reuse the bouquet files). The roses are cut out of public-domain photographs
(Flickr, Public Domain Mark 1.0) and a CC0 photograph (rawpixel); the leaves and butterflies come from CC0 rawpixel
images. All of them were cut out of their backgrounds, colour-graded to the card palette, cropped and resized. Assets
marked "procedural" were drawn for this project in code (Canvas 2D / WebGL) and have no external source.

## Photo sources

| Source | Page | Licence | Used for |
| --- | --- | --- | --- |
| "Peach Rose" (Flickr) | https://www.flickr.com/photos/154119024@N06/46415839454 | Public Domain Mark 1.0 | `bouquet/rose-pink-a` (salmon pink), `rose-pink-c` (lighter, cooler pink), `rose-cream-b` (regraded to cream with a blush-peach heart) |
| Coral rose on black (rawpixel) | https://www.rawpixel.com/image/6068633/free-public-domain-cc0-photo | CC0 1.0 | `bouquet/rose-pink-b`, `rose-pink-d` (toned to soft and light salmon pink) |
| "Pale Peach Rose IMG_0111" (Flickr) | https://www.flickr.com/photos/78478557@N06/25501351794 | Public Domain Mark 1.0 | `bouquet/rose-cream-a` (cream with a peach centre) |
| Red rose png flower sticker (rawpixel) | https://www.rawpixel.com/image/6494180/png-flower-sticker | CC0 1.0 | `bouquet/leaf-a`, `leaf-b`, `leaf-c` (single rose leaves, regraded to deep rose-leaf greens) |
| Butterfly png sticker, transparent background (rawpixel) | https://www.rawpixel.com/image/8707233/png-white-background-butterfly | CC0 1.0 | `bouquet/butterfly-a`, `butterfly-b` (orange tips recoloured pink) |

## Procedural (drawn for this project)

| Asset | What it is |
| --- | --- |
| `bouquet/wrap-back.webp` | Frilled collar behind the roses: cream tissue sheets with ruffled hems over blush tissue, flaring around the dome |
| `bouquet/wrap-front.webp` | Two cream front panels folding into a V towards the tie point, blush tissue lining along their ruffled edges |
| `bouquet/wrap-skirt.webp` | Ruffled skirt below the bow: cream, blush and cream layers with wavy hems |
| `bouquet/bow.webp` | Dusty-pink satin bow (3D ribbon meshes, satin shading): two loops, wrapped knot, two twisting tails with V-cut ends |
| `bouquet/bb-cloud.webp`, `bb-spray.webp`, `bb-tuft.webp`, `bb-pom.webp` | Baby's breath: branching olive stems with clusters of tiny cream florets and buds |
| `decor/rose-corner.webp` | Spray for a top-left corner composed from the bouquet's own roses, leaves and baby's breath (sources above) |

## Files

All files are WebP with alpha. The bouquet layers are placed by
`src/components/women-day/women-day-bouquet/bouquet-art/bouquet-layers.ts` (400 × 512 art box, tie point at 50 % / 66 %);
the letter's clusters by `DECOR_CLUSTERS` in `src/components/women-day/women-day-bouquet/letter/women-day-letter.component.ts`.

| File | Size (px) | Notes |
| --- | --- | --- |
| `bouquet/wrap-back.webp` | 884 × 806 | back layer, art-space placement |
| `bouquet/wrap-front.webp` | 852 × 269 | front layer, art-space placement |
| `bouquet/wrap-skirt.webp` | 516 × 452 | back layer below the tie point, art-space placement |
| `bouquet/bow.webp` | 436 × 500 | the knot centre is at ≈ 50 % / 18 % of the image |
| `bouquet/rose-pink-a/b/c/d.webp`, `rose-cream-a/b.webp` | 391–396 × 361–396 | rose heads (356 px) with a 20 px soft shadow pad |
| `bouquet/leaf-a/b/c.webp` | 222–228 wide | single rose leaves with a soft shadow; tips point down-left (a), down-right (b) and right (c) |
| `bouquet/bb-cloud.webp`, `bb-spray.webp`, `bb-tuft.webp`, `bb-pom.webp` | 258 × 206, 286 × 248, 161 × 131, 88 × 72 | fillers growing upwards (stems at the bottom) |
| `bouquet/butterfly-a.webp`, `butterfly-b.webp` | 150 × 84 | wings open, seen from above |
| `decor/rose-corner.webp` | 423 × 450 | spray for a top-left corner (mirror it for other corners); soft shadows suit light paper |
