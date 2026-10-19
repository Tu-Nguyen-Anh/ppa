/**
 * Layered raster artwork of the 20/10 bouquet: every layer is an image absolutely positioned in the 400 × 512 art
 * box (percentages, so the composition scales with the box). Assets live in `public/images/women-day/bouquet`;
 * sources and licences are listed in `public/images/women-day/SOURCES.md`.
 *
 * v3: seven large photo roses (five salmon pink, two cream) filling a dome framed by baby's breath and small rose
 * leaves; a layered cream / blush tissue wrap (frilled collar flaring around the dome, V-folded front panels, a ruffled
 * skirt below the bow) and a dusty-pink satin bow whose knot sits on the tie point (50% × 66%, the sway pivot).
 *
 * Geometry: `x` / `y` are the left / top edge in % of the box width / height, `w` is the width in % of the box
 * width (the height follows the image aspect ratio), `rotate` (deg) and `flip` apply around the image centre.
 * Layers are listed back to front; `z` is the stacking order.
 */
export type BouquetLayerKind = 'back' | 'foliage' | 'filler' | 'flower' | 'front' | 'bow' | 'butterfly';

export interface BouquetLayer {
  kind: BouquetLayerKind;
  /** '/images/women-day/bouquet/<name>.webp' */
  src: string;
  /** Left / top edge in % of the art box width / height. */
  x: number;
  y: number;
  /** Width in % of the art box width (height follows the image aspect). */
  w: number;
  /** Degrees, around the image centre. */
  rotate?: number;
  /** Mirror horizontally. */
  flip?: boolean;
  /** Stacking order (higher = in front). */
  z: number;
  /** Flower covering photo slot 0..5 (dissolves when that photo is revealed). */
  slot?: number;
}

export interface BouquetPhotoSlot {
  /** Left / top edge of the card in % of the art box width / height. */
  x: number;
  y: number;
  /** Card size in % of the art box width / height (3:4 portrait). */
  w: number;
  h: number;
  /** Degrees, around the card centre. */
  rotate: number;
  /** Between the flowers (30-59) and the front wrap (70); the front-centre card is on top. */
  z: number;
}

const DIR = '/images/women-day/bouquet/';

export const BOUQUET_LAYERS: readonly BouquetLayer[] = [
  { kind: 'back', src: `${DIR}wrap-back.webp`, x: 1.74, y: 0, w: 96.09, z: 1 },
  { kind: 'back', src: `${DIR}wrap-skirt.webp`, x: 21.74, y: 61.65, w: 56.09, z: 2 },
  { kind: 'foliage', src: `${DIR}leaf-b.webp`, x: 23.85, y: 6.25, w: 11, rotate: -171.5, z: 10 },
  { kind: 'foliage', src: `${DIR}leaf-a.webp`, x: 66.18, y: 8.21, w: 11.5, rotate: -95.7, flip: true, z: 10 },
  { kind: 'foliage', src: `${DIR}leaf-c.webp`, x: 9.32, y: 19.2, w: 11, rotate: 24.4, flip: true, z: 11 },
  { kind: 'foliage', src: `${DIR}leaf-c.webp`, x: 80.03, y: 19.69, w: 11, rotate: -23.2, z: 11 },
  { kind: 'foliage', src: `${DIR}leaf-a.webp`, x: 6.23, y: 32.55, w: 10.5, rotate: 30.8, z: 12 },
  { kind: 'foliage', src: `${DIR}leaf-b.webp`, x: 83.1, y: 32.76, w: 10.5, rotate: -118.3, flip: true, z: 12 },
  { kind: 'foliage', src: `${DIR}leaf-c.webp`, x: 58.5, y: 53.06, w: 12, rotate: 24, z: 12 },
  { kind: 'foliage', src: `${DIR}leaf-a.webp`, x: 35.5, y: 55.78, w: 10, rotate: -150, flip: true, z: 12 },
  { kind: 'filler', src: `${DIR}bb-spray.webp`, x: 11.3, y: 9.25, w: 28, rotate: -43.2, flip: true, z: 20 },
  { kind: 'filler', src: `${DIR}bb-cloud.webp`, x: 30.69, y: 4.6, w: 22.03, rotate: -12.1, z: 20 },
  { kind: 'filler', src: `${DIR}bb-tuft.webp`, x: 45.14, y: 4.52, w: 13.43, rotate: 2.5, flip: true, z: 20 },
  { kind: 'filler', src: `${DIR}bb-spray.webp`, x: 45.6, y: 3.36, w: 28.6, rotate: 15.1, z: 20 },
  { kind: 'filler', src: `${DIR}bb-cloud.webp`, x: 3.42, y: 19.92, w: 25.8, rotate: -73.7, z: 21 },
  { kind: 'filler', src: `${DIR}bb-cloud.webp`, x: 64.18, y: 11.3, w: 24.2, rotate: 45.5, flip: true, z: 21 },
  { kind: 'filler', src: `${DIR}bb-spray.webp`, x: 70.31, y: 20.08, w: 26.23, rotate: 76.3, z: 21 },
  { kind: 'filler', src: `${DIR}bb-tuft.webp`, x: 5.95, y: 34.08, w: 16.1, rotate: -104.9, z: 22 },
  { kind: 'filler', src: `${DIR}bb-tuft.webp`, x: 78, y: 35.34, w: 15.1, rotate: 107.5, flip: true, z: 22 },
  { kind: 'filler', src: `${DIR}bb-cloud.webp`, x: 54, y: 50.4, w: 15, rotate: 160, z: 23 },
  { kind: 'filler', src: `${DIR}bb-tuft.webp`, x: 21.5, y: 48.21, w: 13, rotate: -150, z: 23 },
  { kind: 'filler', src: `${DIR}bb-tuft.webp`, x: 39.75, y: 54.3, w: 13.5, rotate: -176, flip: true, z: 23 },
  { kind: 'filler', src: `${DIR}bb-cloud.webp`, x: 46, y: 53.21, w: 16, rotate: 172, z: 23 },
  { kind: 'flower', src: `${DIR}rose-cream-b.webp`, x: 13.81, y: 10.77, w: 33.38, rotate: -12, z: 40, slot: 4 },
  { kind: 'flower', src: `${DIR}rose-pink-b.webp`, x: 33.51, y: 4.88, w: 34.48, rotate: 45, z: 41, slot: 1 },
  { kind: 'flower', src: `${DIR}rose-pink-c.webp`, x: 54.09, y: 11.36, w: 32.83, rotate: 120, flip: true, z: 42, slot: 5 },
  { kind: 'flower', src: `${DIR}rose-pink-d.webp`, x: 8.98, y: 26.53, w: 35.05, rotate: 135, flip: true, z: 43, slot: 2 },
  { kind: 'flower', src: `${DIR}rose-cream-a.webp`, x: 56.73, y: 26.18, w: 34.05, rotate: 8, flip: true, z: 44, slot: 3 },
  { kind: 'flower', src: `${DIR}rose-pink-a.webp`, x: 24.71, y: 43.24, w: 25.58, rotate: 110, z: 45 },
  { kind: 'flower', src: `${DIR}rose-pink-a.webp`, x: 29.43, y: 26.36, w: 41.15, rotate: -4, z: 46, slot: 0 },
  { kind: 'filler', src: `${DIR}bb-pom.webp`, x: 36.25, y: 27.29, w: 7.5, rotate: -20, z: 50 },
  { kind: 'filler', src: `${DIR}bb-pom.webp`, x: 57.13, y: 27.37, w: 7.25, rotate: 25, flip: true, z: 50 },
  { kind: 'filler', src: `${DIR}bb-pom.webp`, x: 10.25, y: 28.92, w: 8.5, rotate: -60, z: 50 },
  { kind: 'filler', src: `${DIR}bb-pom.webp`, x: 81.75, y: 28.69, w: 8, rotate: 64, flip: true, z: 50 },
  { kind: 'filler', src: `${DIR}bb-pom.webp`, x: 60.75, y: 49.95, w: 7.5, rotate: 150, z: 50 },
  { kind: 'filler', src: `${DIR}bb-pom.webp`, x: 34, y: 44.64, w: 7, rotate: -150, flip: true, z: 50 },
  { kind: 'filler', src: `${DIR}bb-pom.webp`, x: 16.25, y: 47.99, w: 7.5, rotate: -110, z: 50 },
  { kind: 'filler', src: `${DIR}bb-pom.webp`, x: 76.75, y: 47.99, w: 7.5, rotate: 110, flip: true, z: 50 },
  { kind: 'front', src: `${DIR}wrap-front.webp`, x: 3.7, y: 46.37, w: 92.61, z: 70 },
  { kind: 'bow', src: `${DIR}bow.webp`, x: 26.57, y: 58.36, w: 47.39, z: 80 },
  { kind: 'butterfly', src: `${DIR}butterfly-a.webp`, x: 4.25, y: 7.64, w: 11.5, rotate: -18, z: 90 },
  { kind: 'butterfly', src: `${DIR}butterfly-b.webp`, x: 87.5, y: 39.61, w: 10, rotate: 14, flip: true, z: 91 }
];

/**
 * Six photo cards in prominence order (photo i -> slot i), positioned where the slot roses are: 0 the large
 * centre-front pink, 1 top-centre, 2 middle-left, 3 middle-right (cream), 4 top-left (cream), 5 top-right.
 */
export const BOUQUET_PHOTO_SLOTS: readonly BouquetPhotoSlot[] = [
  { x: 34.25, y: 25, w: 31.5, h: 32.81, rotate: -2, z: 65 },
  { x: 37.75, y: 5.21, w: 26, h: 27.08, rotate: 3, z: 61 },
  { x: 14, y: 26.89, w: 26, h: 27.08, rotate: -6, z: 63 },
  { x: 60, y: 26.69, w: 26, h: 27.08, rotate: 6, z: 64 },
  { x: 18.75, y: 10.68, w: 24.5, h: 25.52, rotate: -5, z: 60 },
  { x: 58, y: 10.87, w: 24.5, h: 25.52, rotate: 5, z: 62 }
];
