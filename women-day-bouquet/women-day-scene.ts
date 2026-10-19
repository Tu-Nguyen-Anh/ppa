import { WOMEN_DAY_DEFAULT_WISHES } from '../../../models/women-day-content';

/**
 * Canvas 2D pseudo-3D sky of the 20/10 card "Bó hoa giữa trời sao": warm twinkling stars around a camera that
 * orbits the origin and, after setRain(true), glowing wishes, photos and hearts falling through the scene.
 * Plain TS and browser only: the orchestrator creates it after the first render and destroys it with the view.
 */
export interface WomenDaySceneOptions {
  /** Already capped (getWomenDaySkyWishes). */
  wishes: readonly string[];
  /** Sky photos (≤ 10). */
  photos: readonly string[];
  reducedMotion: boolean;
}

interface Sprite {
  readonly image: HTMLCanvasElement;
  /** World units per sprite pixel. */
  readonly unit: number;
}

interface PhotoEntry {
  readonly url: string;
  state: 'loading' | 'ready' | 'broken';
  image: HTMLImageElement | null;
  sprite: Sprite | null;
}

const WISH = 0;
const PHOTO = 1;
const HEART = 2;

class RainItem {
  kind = WISH;
  /** Shuffled index that picks the wish / photo shown by this item (photo items move it on when they wrap). */
  slot = 0;
  row = 0;
  col = 0;
  jitterX = 0;
  jitterZ = 0;
  gridX = 0;
  wrapJitter = 0;
  x = 0;
  y = 0;
  z = 0;
  speed = 0;
  scale = 1;
  swayAmp = 0;
  swaySpeed = 0;
  swayPhase = 0;
  roll = 0;
  rollAmp = 0;
  spin = 0;
  spinSpeed = 0;
  key = '';
  sprite: Sprite | null = null;
  appear = 0;
  // Filled while rendering a frame.
  depth = 0;
  alpha = 0;
  ta = 0;
  tb = 0;
  tc = 0;
  td = 0;
  te = 0;
  tf = 0;
}

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const FOV_TAN = Math.tan(50 * DEG);
const NEAR = 1;
const MAX_DT = 1 / 30;

const INITIAL_YAW = -18 * DEG;
const INITIAL_DISTANCE = 30;
const MIN_DISTANCE = 12;
const MAX_DISTANCE = 55;
const PITCH_LIMIT = 35 * DEG;
const INERTIA_DAMPING = 0.92;
const AUTO_DRIFT = 0.02;
const STAR_SPIN = 0.006;
const PLANE_TILT = 0.42;
const HEART_SWING = 1.2;

const Y_TOP = 95;
const Y_BOTTOM = -55;
const Y_SPAN = Y_TOP - Y_BOTTOM;
const Y_FADE_IN = 55;
const Y_FADE_OUT = -35;

const RAIN_FADE_IN = 1.2;
const RAIN_FADE_OUT = 0.6;
const RAIN_RAMP = 2.4;
const RAIN_START_SPEED = 0.32;
const APPEAR_TIME = 0.6;

const STAR_COLORS = ['#fff7e6', '#ffe9c2', '#ffd7a8', '#fff1f6', '#ffe2ef'];
const STAR_RGB = ['255,247,230', '255,233,194', '255,215,168', '255,241,246', '255,226,239'];
const STAR_WEIGHTS = [0.3, 0.22, 0.14, 0.18, 0.16];
const DUST_COLORS = ['#fff4e2', '#ffe6f0'];
const GLITTER_COLORS = ['#ffd7a8', '#ffb3d4', '#fff1f6'];
const NEBULA_RGB = ['255,122,182', '168,120,255', '255,176,150'];

const WISH_COLORS = ['#ff7ab6', '#ffb3d4'];
const WISH_CORE_COLORS = ['#ff9fca', '#ffcfe3'];
const WISH_GLOW = 'rgba(255,105,180,0.85)';
const WISH_CORE_GLOW = 'rgba(255,214,232,0.9)';
const WISH_FONT_SIZE = 56;
const WISH_FONT = `700 ${WISH_FONT_SIZE}px Quicksand, "Segoe UI", system-ui, sans-serif`;
const WISH_LINE_HEIGHT = Math.round(WISH_FONT_SIZE * 1.3);
const WISH_PAD = 40;
const WISH_WORDS_PER_LINE = 6;
const WISH_MAX_LINE_WIDTH = 1100;
const WISH_WORLD_LINE = 1.5;
const FONT_SAMPLE = 'Aa ăâđêôơư ạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ ♡';
const FONT_TIMEOUT_MS = 2500;

const HEART_TOP = '#ff3b6b';
const HEART_BOTTOM = '#d61f4f';
const HEART_GLOW = 'rgba(255,60,110,0.8)';
const HEART_WORLD_SIZE = 1.6;

const PHOTO_WORLD_SIZE = 9;
const PHOTO_GLOW = 'rgba(255,105,180,0.72)';

// Faint band of denser stars (a soft "milky way"): plane normal and two in-plane axes.
const BAND_N = normalize3(0.32, 0.86, 0.4);
const BAND_A = normalize3(BAND_N[1], -BAND_N[0], 0);
const BAND_B = cross3(BAND_N, BAND_A);

function normalize3(x: number, y: number, z: number): [number, number, number] {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

function cross3(a: readonly number[], b: readonly number[]): [number, number, number] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Hermite smoothstep; edge0 may be greater than edge1 (reversed ramp). */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function random(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Roughly gaussian in [-1, 1]. */
function gaussian(): number {
  return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
}

function shuffledRange(count: number): number[] {
  const values = Array.from({ length: count }, (_, index) => index);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  return canvas;
}

function releaseCanvas(canvas: HTMLCanvasElement | null | undefined): void {
  if (!canvas) return;
  canvas.width = 0;
  canvas.height = 0;
}

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Heart whose bounding box starts at (cx - w/2, top). */
function heartPath(ctx: CanvasRenderingContext2D, cx: number, top: number, w: number, h: number): void {
  const half = w / 2;
  ctx.beginPath();
  ctx.moveTo(cx, top + h * 0.26);
  ctx.bezierCurveTo(cx - half * 0.12, top - h * 0.04, cx - half, top - h * 0.02, cx - half, top + h * 0.32);
  ctx.bezierCurveTo(cx - half, top + h * 0.6, cx - half * 0.42, top + h * 0.78, cx, top + h);
  ctx.bezierCurveTo(cx + half * 0.42, top + h * 0.78, cx + half, top + h * 0.6, cx + half, top + h * 0.32);
  ctx.bezierCurveTo(cx + half, top - h * 0.02, cx + half * 0.12, top - h * 0.04, cx, top + h * 0.26);
  ctx.closePath();
}

function detectLowTier(): boolean {
  try {
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    const small = Math.min(window.innerWidth, window.innerHeight) < 700;
    const cores = navigator.hardwareConcurrency;
    return coarse || small || (typeof cores === 'number' && cores > 0 && cores <= 4);
  } catch {
    return true;
  }
}

export class WomenDayScene {
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly lowTier: boolean;
  private readonly reducedMotion: boolean;

  private destroyed = false;
  private running = false;
  private rafId = 0;
  private lastFrame = 0;
  private framesRendered = 0;
  private time = 0;

  private width = 0;
  private height = 0;
  private dpr = 1;
  /** Narrow portrait screens see little sideways: the rain's x layout is pulled in (1 on landscape). */
  private lateral = 1;

  // Camera (orbits the origin) and its basis for the current frame.
  private yaw = INITIAL_YAW;
  private pitch = 0;
  private distance = INITIAL_DISTANCE;
  private distanceTarget = INITIAL_DISTANCE;
  private yawVelocity = 0;
  private pitchVelocity = 0;
  private drift = 1;
  private sinceInteraction = 10;
  private rx = 1;
  private rz = 0;
  private ux = 0;
  private uy = 1;
  private uz = 0;
  private fx = 0;
  private fy = 0;
  private fz = -1;
  private focal = 1;

  // Eased controls from the orchestrator.
  private speedTarget = 1;
  private speed = 1;
  private dimTarget = 0;
  private dim = 0;
  private rainOn = false;
  private rainLevel = 0;
  private rainClock = 0;

  // Stars: unit directions, grouped by colour (starGroupEnd).
  private starYaw = 0;
  private starX = new Float32Array(0);
  private starY = new Float32Array(0);
  private starZ = new Float32Array(0);
  private starSize = new Float32Array(0);
  private starAlpha = new Float32Array(0);
  private starAmp = new Float32Array(0);
  private starF1 = new Float32Array(0);
  private starP1 = new Float32Array(0);
  private starF2 = new Float32Array(0);
  private starP2 = new Float32Array(0);
  private starGroupEnd = new Uint32Array(STAR_COLORS.length);
  // A few bigger soft stars drawn from sprites.
  private brightCount = 0;
  private brightX = new Float32Array(0);
  private brightY = new Float32Array(0);
  private brightZ = new Float32Array(0);
  private brightSize = new Float32Array(0);
  private brightAlpha = new Float32Array(0);
  private brightF = new Float32Array(0);
  private brightP = new Float32Array(0);
  private brightSprite = new Uint8Array(0);
  private brightSprites: HTMLCanvasElement[] = [];
  // Faint steady dust stars, grouped by colour (dustGroupEnd).
  private dustX = new Float32Array(0);
  private dustY = new Float32Array(0);
  private dustZ = new Float32Array(0);
  private dustSize = new Float32Array(0);
  private dustAlpha = new Float32Array(0);
  private dustGroupEnd = new Uint32Array(DUST_COLORS.length);
  // Very faint coloured haze along the band.
  private nebulaCount = 0;
  private nebulaX = new Float32Array(0);
  private nebulaY = new Float32Array(0);
  private nebulaZ = new Float32Array(0);
  private nebulaSize = new Float32Array(0);
  private nebulaAlpha = new Float32Array(0);
  private nebulaAngle = new Float32Array(0);
  private nebulaSprite = new Uint8Array(0);
  private nebulaSprites: HTMLCanvasElement[] = [];
  // Shooting star (screen space).
  private shootActive = false;
  private shootAt = random(4, 8);
  private shootT = 0;
  private shootDuration = 1;
  private shootX = 0;
  private shootY = 0;
  private shootDx = 0;
  private shootDy = 0;
  private shootLength = 0;

  // Glitter dust that falls with the rain.
  private glitterCount = 0;
  private glitterX = new Float32Array(0);
  private glitterY = new Float32Array(0);
  private glitterZ = new Float32Array(0);
  private glitterSpeed = new Float32Array(0);
  private glitterPhase = new Float32Array(0);
  private glitterSize = new Float32Array(0);
  private glitterGroupEnd = new Uint32Array(GLITTER_COLORS.length);

  // Rain items.
  private readonly items: RainItem[] = [];
  private readonly wishItems: RainItem[] = [];
  private readonly photoItems: RainItem[] = [];
  private drawList: RainItem[] = [];
  private wishCols = 0;
  private wishSpacing = 0;
  private heartSprite: Sprite | null = null;

  // Content.
  private wishTexts: string[] = [];
  private neededWishKeys = new Set<string>();
  private readonly wishSprites = new Map<string, Sprite>();
  private readonly pendingWishKeys = new Set<string>();
  /** Keys with a build task in `tasks`: edits while the loop is idle (hidden preview) must not queue duplicates. */
  private readonly queuedWishKeys = new Set<string>();
  private fontReady = false;
  private fontFallbackUsed = false;
  private fontTimer: ReturnType<typeof setTimeout> | null = null;
  private photoUrls: string[] = [];
  private readonly photoEntries = new Map<string, PhotoEntry>();
  /** Loaded photo sprites in list order; a photo item shows readyPhotos[slot % length]. */
  private readyPhotos: Sprite[] = [];
  private readonly tasks: (() => void)[] = [];

  // Controls.
  private controlsEnabled = false;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private lastMoveAt = 0;
  private pinchStart = 0;
  private pinchDistanceStart = INITIAL_DISTANCE;

  constructor(private readonly canvas: HTMLCanvasElement, options: WomenDaySceneOptions) {
    this.ctx = canvas.getContext('2d');
    this.lowTier = detectLowTier();
    this.reducedMotion = !!options.reducedMotion;
    if (!this.ctx) return;

    this.buildSkySprites();
    this.buildStars();
    this.buildNebulae();
    this.buildGlitter();
    this.buildItems();
    this.ensureFont();
    this.updateContent(options.wishes, options.photos);

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('lostpointercapture', this.onPointerUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('contextmenu', this.onContextMenu);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  // ---------------------------------------------------------------- public API

  /** Handles the device pixel ratio (capped per quality tier and by a pixel budget). */
  resize(cssWidth: number, cssHeight: number): void {
    if (this.destroyed || !this.ctx) return;
    const width = Math.max(0, cssWidth);
    const height = Math.max(0, cssHeight);
    const deviceRatio = window.devicePixelRatio || 1;
    const area = Math.max(1, width * height);
    const budget = this.lowTier ? 3_000_000 : 5_000_000;
    let dpr = Math.min(deviceRatio, this.lowTier ? 1.75 : 2, Math.sqrt(budget / area));
    dpr = Math.max(dpr, Math.min(1, deviceRatio));
    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.lateral = height > 0 ? clamp(0.4 + 0.6 * (width / height), 0.68, 1) : 1;
    if (this.canvas.width !== pixelWidth) this.canvas.width = pixelWidth;
    if (this.canvas.height !== pixelHeight) this.canvas.height = pixelHeight;
    this.requestFrame();
  }

  /** Starts the animation loop (stars always; the rain only after setRain(true)). */
  start(): void {
    if (this.destroyed || this.running || !this.ctx) return;
    this.running = true;
    this.requestFrame();
  }

  setRain(on: boolean): void {
    if (this.rainOn === on) return;
    this.rainOn = on;
    if (on && this.rainLevel <= 0) this.rainClock = 0;
  }

  /** Scene speed multiplier, eased over ~0.5 s. */
  setSpeedFactor(factor: number): void {
    this.speedTarget = clamp(Number.isFinite(factor) ? factor : 1, 0, 3);
  }

  /** 0..1, eased: stars inside a centred ellipse (behind the bouquet) are multiplied by (1 - amount). */
  setFocusDim(amount: number): void {
    this.dimTarget = clamp(Number.isFinite(amount) ? amount : 0, 0, 1);
    if (this.framesRendered === 0) this.dim = this.dimTarget;
  }

  setControlsEnabled(on: boolean): void {
    if (this.controlsEnabled === on) return;
    this.controlsEnabled = on;
    if (!on) {
      this.releasePointers();
      this.yawVelocity = 0;
      this.pitchVelocity = 0;
    }
    this.updateCursor();
  }

  /** Swaps wishes / photos without restarting the scene: unchanged sprites and item positions are kept. */
  updateContent(wishes: readonly string[], photos: readonly string[]): void {
    if (this.destroyed || !this.ctx) return;
    const photoList = Array.from(new Set((photos ?? []).map(url => (url ?? '').trim()).filter(Boolean)));
    let wishList = (wishes ?? []).map(wish => (wish ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean);
    if (!wishList.length && !photoList.length) wishList = [...WOMEN_DAY_DEFAULT_WISHES];
    this.setWishes(wishList);
    this.setPhotos(photoList);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    if (this.fontTimer !== null) clearTimeout(this.fontTimer);
    this.fontTimer = null;

    const canvas = this.canvas;
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('pointermove', this.onPointerMove);
    canvas.removeEventListener('pointerup', this.onPointerUp);
    canvas.removeEventListener('pointercancel', this.onPointerUp);
    canvas.removeEventListener('lostpointercapture', this.onPointerUp);
    canvas.removeEventListener('wheel', this.onWheel);
    canvas.removeEventListener('contextmenu', this.onContextMenu);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.releasePointers();
    canvas.style.cursor = '';

    for (const item of this.items) item.sprite = null;
    this.items.length = 0;
    this.wishItems.length = 0;
    this.photoItems.length = 0;
    this.drawList = [];
    this.tasks.length = 0;
    this.readyPhotos = [];
    for (const entry of this.photoEntries.values()) this.releasePhoto(entry);
    this.photoEntries.clear();
    for (const sprite of this.wishSprites.values()) releaseCanvas(sprite.image);
    this.wishSprites.clear();
    this.pendingWishKeys.clear();
    this.queuedWishKeys.clear();
    releaseCanvas(this.heartSprite?.image);
    this.heartSprite = null;
    this.brightSprites.forEach(releaseCanvas);
    this.nebulaSprites.forEach(releaseCanvas);
    this.brightSprites = [];
    this.nebulaSprites = [];

    if (this.ctx) {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  // ---------------------------------------------------------------- loop

  private requestFrame(): void {
    if (this.rafId || !this.running || this.destroyed) return;
    if (this.width < 1 || this.height < 1 || document.hidden) return;
    this.rafId = requestAnimationFrame(this.frame);
  }

  private readonly frame = (now: number): void => {
    this.rafId = 0;
    if (this.destroyed || !this.running || !this.ctx) return;
    // Idle while hidden or collapsed; visibilitychange / resize restart the loop.
    if (this.width < 1 || this.height < 1 || document.hidden) {
      this.lastFrame = 0;
      return;
    }
    this.rafId = requestAnimationFrame(this.frame);
    let dt = this.lastFrame ? (now - this.lastFrame) / 1000 : 1 / 60;
    this.lastFrame = now;
    dt = clamp(dt, 0, MAX_DT);
    this.time += dt;
    this.runTasks();
    this.update(dt);
    this.render(this.ctx);
    this.framesRendered++;
  };

  private readonly onVisibilityChange = (): void => {
    if (document.hidden) {
      if (this.rafId) cancelAnimationFrame(this.rafId);
      this.rafId = 0;
      this.lastFrame = 0;
    } else {
      this.requestFrame();
    }
  };

  /** Sprite builds (text, photos) are spread over frames to keep the loop smooth. */
  private runTasks(): void {
    if (!this.tasks.length) return;
    const started = performance.now();
    do {
      const task = this.tasks.shift();
      task?.();
    } while (this.tasks.length && performance.now() - started < 6);
  }

  // ---------------------------------------------------------------- update

  private update(dt: number): void {
    this.speed += (this.speedTarget - this.speed) * (1 - Math.exp(-dt / 0.16));
    this.dim += (this.dimTarget - this.dim) * (1 - Math.exp(-dt / 0.3));
    if (Math.abs(this.dim - this.dimTarget) < 0.001) this.dim = this.dimTarget;

    if (this.rainOn) {
      this.rainLevel = Math.min(1, this.rainLevel + dt / RAIN_FADE_IN);
      this.rainClock += dt;
    } else {
      this.rainLevel = Math.max(0, this.rainLevel - dt / RAIN_FADE_OUT);
    }

    this.updateCamera(dt);
    this.starYaw += STAR_SPIN * this.speed * dt * (this.reducedMotion ? 0.5 : 1);
    this.updateShootingStar(dt);

    for (const item of this.items) {
      if (item.appear < 1) item.appear = Math.min(1, item.appear + dt / APPEAR_TIME);
    }
    if (this.rainLevel > 0) this.updateRain(dt);
  }

  private updateCamera(dt: number): void {
    const interacting = this.pointers.size > 0;
    if (interacting) {
      this.sinceInteraction = 0;
    } else {
      this.sinceInteraction += dt;
      if (this.yawVelocity !== 0 || this.pitchVelocity !== 0) {
        this.yaw += this.yawVelocity * dt;
        this.pitch += this.pitchVelocity * dt;
        const decay = Math.pow(INERTIA_DAMPING, dt * 60);
        this.yawVelocity *= decay;
        this.pitchVelocity *= decay;
        if (Math.abs(this.yawVelocity) < 1e-4) this.yawVelocity = 0;
        if (Math.abs(this.pitchVelocity) < 1e-4) this.pitchVelocity = 0;
      }
    }
    if (this.pitch > PITCH_LIMIT || this.pitch < -PITCH_LIMIT) {
      this.pitch = clamp(this.pitch, -PITCH_LIMIT, PITCH_LIMIT);
      this.pitchVelocity = 0;
    }

    if (!this.reducedMotion) {
      const want = interacting || this.sinceInteraction < 1.2 ? 0 : 1;
      this.drift += (want - this.drift) * (1 - Math.exp(-dt / 0.8));
      this.yaw += AUTO_DRIFT * this.drift * this.speed * dt;
    }

    this.distance += (this.distanceTarget - this.distance) * (1 - Math.exp(-dt / 0.12));

    const cy = Math.cos(this.yaw);
    const sy = Math.sin(this.yaw);
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    this.rx = cy;
    this.rz = -sy;
    this.ux = -sy * sp;
    this.uy = cp;
    this.uz = -cy * sp;
    this.fx = -sy * cp;
    this.fy = -sp;
    this.fz = -cy * cp;
    // 100° across the longer side: a portrait phone gets the vertical 100°; a landscape screen does not
    // stretch to a 125°+ horizontal view with smeared edges.
    this.focal = (0.5 * Math.max(this.width, this.height)) / FOV_TAN;
  }

  private updateShootingStar(dt: number): void {
    if (this.reducedMotion) return;
    if (this.shootActive) {
      this.shootT += dt * clamp(this.speed, 0.4, 1);
      if (this.shootT >= this.shootDuration) {
        this.shootActive = false;
        this.shootAt = this.time + random(7, 15);
      }
      return;
    }
    if (this.time < this.shootAt) return;
    const angle = random(18, 38) * DEG;
    const direction = Math.random() < 0.5 ? -1 : 1;
    this.shootActive = true;
    this.shootT = 0;
    this.shootDuration = random(0.8, 1.2);
    this.shootX = this.width * random(direction > 0 ? 0.08 : 0.4, direction > 0 ? 0.6 : 0.92);
    this.shootY = this.height * random(0.04, 0.3);
    this.shootDx = Math.cos(angle) * direction;
    this.shootDy = Math.sin(angle);
    this.shootLength = clamp(Math.min(this.width, this.height) * random(0.22, 0.34), 70, 240);
  }

  private updateRain(dt: number): void {
    const ramp = RAIN_START_SPEED + (1 - RAIN_START_SPEED) * smoothstep(0, RAIN_RAMP, this.rainClock);
    const step = dt * this.speed * ramp * (this.reducedMotion ? 0.4 : 1);
    for (const item of this.items) {
      item.y -= item.speed * step;
      if (item.y < Y_BOTTOM) {
        item.y += Y_SPAN;
        item.x = item.gridX + random(-1, 1) * item.wrapJitter;
        if (item.kind === PHOTO) this.nextPhoto(item);
      }
      item.swayPhase += item.swaySpeed * step;
      if (item.spinSpeed) item.spin += item.spinSpeed * step;
    }
    for (let i = 0; i < this.glitterCount; i++) {
      let y = this.glitterY[i] - this.glitterSpeed[i] * step;
      if (y < Y_BOTTOM) {
        y += Y_SPAN;
        this.glitterX[i] = random(-45, 45);
      }
      this.glitterY[i] = y;
      this.glitterPhase[i] += step * 1.3;
    }
  }

  // ---------------------------------------------------------------- render

  private render(ctx: CanvasRenderingContext2D): void {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';
    this.renderSky(ctx);
    if (this.rainLevel > 0) this.renderRain(ctx);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private renderSky(ctx: CanvasRenderingContext2D): void {
    const width = this.width;
    const height = this.height;
    const dpr = this.dpr;
    const centerX = width / 2;
    const centerY = height / 2;
    const focal = this.focal;

    // The star sphere turns slowly on its own: rotate the camera basis by -starYaw instead of every star.
    const cs = Math.cos(this.starYaw);
    const ss = Math.sin(this.starYaw);
    const Rx = this.rx * cs - this.rz * ss;
    const Rz = this.rx * ss + this.rz * cs;
    const Ux = this.ux * cs - this.uz * ss;
    const Uy = this.uy;
    const Uz = this.ux * ss + this.uz * cs;
    const Fx = this.fx * cs - this.fz * ss;
    const Fy = this.fy;
    const Fz = this.fx * ss + this.fz * cs;

    const dimming = this.dim > 0.002;
    const dimX = width * 0.5;
    const dimY = height * 0.46;
    const dimRx = 1 / Math.max(1, width * 0.36);
    const dimRy = 1 / Math.max(1, height * 0.3);
    const dimAmount = this.dim;
    const dimAt = (x: number, y: number): number => {
      const dx = (x - dimX) * dimRx;
      const dy = (y - dimY) * dimRy;
      const q2 = dx * dx + dy * dy;
      if (q2 >= 1.8225) return 1; // 1.35²: outside the soft edge
      const mask = q2 <= 1 ? 1 : 1 - smoothstep(1, 1.35, Math.sqrt(q2));
      return 1 - dimAmount * mask;
    };

    const t = this.time * (this.reducedMotion ? 0.5 : 1);
    const twinkleScale = this.reducedMotion ? 0.6 : 1;
    // Sub-pixel stars wash out on 1x screens.
    const starScale = dpr < 1.5 ? 1.3 : 1;
    ctx.globalCompositeOperation = 'lighter';

    // Haze.
    for (let i = 0; i < this.nebulaCount; i++) {
      const x = this.nebulaX[i];
      const y = this.nebulaY[i];
      const z = this.nebulaZ[i];
      const zc = x * Fx + y * Fy + z * Fz;
      if (zc < 0.15) continue;
      const inv = focal / zc;
      const sx = centerX + (x * Rx + z * Rz) * inv;
      const sy = centerY - (x * Ux + y * Uy + z * Uz) * inv;
      const size = this.nebulaSize[i] * inv;
      if (sx + size < 0 || sx - size > width || sy + size < 0 || sy - size > height) continue;
      const sprite = this.nebulaSprites[this.nebulaSprite[i]];
      if (!sprite) continue;
      const scale = size / sprite.width;
      const angle = this.nebulaAngle[i];
      const ca = Math.cos(angle) * scale;
      const sa = Math.sin(angle) * scale;
      ctx.globalAlpha = this.nebulaAlpha[i] * (dimming ? 1 - dimAmount * 0.5 : 1);
      ctx.setTransform(ca * dpr, sa * dpr, -sa * dpr, ca * dpr, sx * dpr, sy * dpr);
      ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Dust stars.
    let start = 0;
    for (let color = 0; color < DUST_COLORS.length; color++) {
      const end = this.dustGroupEnd[color];
      ctx.fillStyle = DUST_COLORS[color];
      for (let i = start; i < end; i++) {
        const x = this.dustX[i];
        const y = this.dustY[i];
        const z = this.dustZ[i];
        const zc = x * Fx + y * Fy + z * Fz;
        if (zc < 0.08) continue;
        const inv = focal / zc;
        const sx = centerX + (x * Rx + z * Rz) * inv;
        if (sx < -2 || sx > width + 2) continue;
        const sy = centerY - (x * Ux + y * Uy + z * Uz) * inv;
        if (sy < -2 || sy > height + 2) continue;
        const alpha = dimming ? this.dustAlpha[i] * dimAt(sx, sy) : this.dustAlpha[i];
        if (alpha < 0.03) continue;
        const size = this.dustSize[i] * starScale;
        ctx.globalAlpha = alpha;
        ctx.fillRect(sx - size / 2, sy - size / 2, size, size);
      }
      start = end;
    }

    // Twinkling stars: one fillRect each, grouped by colour.
    start = 0;
    for (let color = 0; color < STAR_COLORS.length; color++) {
      const end = this.starGroupEnd[color];
      ctx.fillStyle = STAR_COLORS[color];
      for (let i = start; i < end; i++) {
        const x = this.starX[i];
        const y = this.starY[i];
        const z = this.starZ[i];
        const zc = x * Fx + y * Fy + z * Fz;
        if (zc < 0.08) continue;
        const inv = focal / zc;
        const sx = centerX + (x * Rx + z * Rz) * inv;
        if (sx < -3 || sx > width + 3) continue;
        const sy = centerY - (x * Ux + y * Uy + z * Uz) * inv;
        if (sy < -3 || sy > height + 3) continue;
        const wave = 0.6 * Math.sin(t * this.starF1[i] + this.starP1[i]) + 0.4 * Math.sin(t * this.starF2[i] + this.starP2[i]);
        let alpha = this.starAlpha[i] * (1 - this.starAmp[i] * twinkleScale * (0.5 - 0.5 * wave));
        if (dimming) alpha *= dimAt(sx, sy);
        if (alpha < 0.02) continue;
        const size = this.starSize[i] * starScale;
        ctx.globalAlpha = alpha > 1 ? 1 : alpha;
        if (size < 1.5) {
          ctx.fillRect(sx - size / 2, sy - size / 2, size, size);
        } else {
          // A tiny cross instead of a blocky square; the overlap makes a brighter core.
          const thin = size * 0.5;
          ctx.fillRect(sx - size / 2, sy - thin / 2, size, thin);
          ctx.fillRect(sx - thin / 2, sy - size / 2, thin, size);
        }
      }
      start = end;
    }

    // Bigger soft stars.
    for (let i = 0; i < this.brightCount; i++) {
      const x = this.brightX[i];
      const y = this.brightY[i];
      const z = this.brightZ[i];
      const zc = x * Fx + y * Fy + z * Fz;
      if (zc < 0.08) continue;
      const inv = focal / zc;
      const sx = centerX + (x * Rx + z * Rz) * inv;
      const sy = centerY - (x * Ux + y * Uy + z * Uz) * inv;
      const wave = Math.sin(t * this.brightF[i] + this.brightP[i]);
      const size = this.brightSize[i] * (1 + 0.12 * twinkleScale * wave);
      const half = size / 2;
      if (sx + half < 0 || sx - half > width || sy + half < 0 || sy - half > height) continue;
      let alpha = this.brightAlpha[i] * (0.78 + 0.22 * twinkleScale * wave);
      if (dimming) alpha *= dimAt(sx, sy);
      if (alpha < 0.02) continue;
      const sprite = this.brightSprites[this.brightSprite[i]];
      if (!sprite) continue;
      ctx.globalAlpha = alpha > 1 ? 1 : alpha;
      ctx.drawImage(sprite, sx - half, sy - half, size, size);
    }

    if (this.shootActive) this.renderShootingStar(ctx);
  }

  private renderShootingStar(ctx: CanvasRenderingContext2D): void {
    const p = clamp(this.shootT / this.shootDuration, 0, 1);
    const travel = 1 - Math.pow(1 - p, 3);
    const headX = this.shootX + this.shootDx * this.shootLength * 1.7 * travel;
    const headY = this.shootY + this.shootDy * this.shootLength * 1.7 * travel;
    const tail = this.shootLength * (0.3 + 0.7 * Math.sin(Math.PI * Math.min(1, p * 1.15)));
    const tailX = headX - this.shootDx * tail;
    const tailY = headY - this.shootDy * tail;
    const fade = p < 0.12 ? p / 0.12 : p > 0.7 ? (1 - p) / 0.3 : 1;
    if (fade <= 0.01) return;
    const gradient = ctx.createLinearGradient(headX, headY, tailX, tailY);
    gradient.addColorStop(0, `rgba(255,247,230,${(0.95 * fade).toFixed(3)})`);
    gradient.addColorStop(0.25, `rgba(255,215,168,${(0.5 * fade).toFixed(3)})`);
    gradient.addColorStop(1, 'rgba(255,215,168,0)');
    ctx.globalAlpha = 1;
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(headX, headY);
    ctx.lineTo(tailX, tailY);
    ctx.stroke();
    const glow = this.brightSprites[0];
    if (glow) {
      ctx.globalAlpha = fade;
      ctx.drawImage(glow, headX - 7, headY - 7, 14, 14);
    }
  }

  private renderRain(ctx: CanvasRenderingContext2D): void {
    const level = smoothstep(0, 1, this.rainLevel);
    if (level <= 0.001) return;
    const width = this.width;
    const height = this.height;
    const dpr = this.dpr;
    const centerX = width / 2;
    const centerY = height / 2;
    const focal = this.focal;
    const { rx, rz, ux, uy, uz, fx, fy, fz } = this;
    const distance = this.distance;
    const lateral = this.lateral;
    const camX = -distance * fx;
    const camY = -distance * fy;
    const camZ = -distance * fz;
    const longSide = Math.max(width, height);
    const maxExtent = longSide * 4;
    // Planes face +Z around the front and back views and turn with the camera in between: they tilt in
    // perspective (up to PLANE_TILT) while orbiting but never end up edge-on.
    const planeYaw = this.yaw - PLANE_TILT * Math.sin(2 * this.yaw);
    const planeCos = Math.cos(planeYaw);
    const planeSin = Math.sin(planeYaw);

    // Glitter dust (behind the items).
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    const twinkleTime = this.time * 3;
    let start = 0;
    for (let color = 0; color < GLITTER_COLORS.length; color++) {
      const end = this.glitterGroupEnd[color];
      ctx.fillStyle = GLITTER_COLORS[color];
      for (let i = start; i < end; i++) {
        const phase = this.glitterPhase[i];
        const x = (this.glitterX[i] + 0.5 * Math.sin(phase)) * lateral;
        const y = this.glitterY[i];
        const z = this.glitterZ[i];
        const zc = x * fx + y * fy + z * fz + distance;
        if (zc < 2) continue;
        const inv = focal / zc;
        const sx = centerX + (x * rx + z * rz) * inv;
        if (sx < -4 || sx > width + 4) continue;
        const sy = centerY - (x * ux + y * uy + z * uz) * inv;
        if (sy < -4 || sy > height + 4) continue;
        const vertical = smoothstep(Y_TOP, Y_FADE_IN, y) * smoothstep(Y_BOTTOM, Y_FADE_OUT, y);
        const alpha = level * vertical * smoothstep(2, 7, zc) * (1 - 0.5 * smoothstep(40, 100, zc))
          * (0.55 + 0.45 * Math.sin(twinkleTime + phase * 2.1));
        if (alpha < 0.03) continue;
        const size = clamp((this.glitterSize[i] * 14) / zc, 0.7, 3);
        ctx.globalAlpha = alpha * 0.85;
        ctx.fillRect(sx - size / 2, sy - size / 2, size, size);
      }
      start = end;
    }

    // Project the planes; keep the visible ones.
    const drawList = this.drawList;
    let count = 0;
    for (const item of this.items) {
      const sprite = item.sprite;
      if (!sprite || sprite.image.width === 0) continue;
      const y = item.y;
      const vertical = smoothstep(Y_TOP, Y_FADE_IN, y) * smoothstep(Y_BOTTOM, Y_FADE_OUT, y);
      if (vertical <= 0.002) continue;
      const x = (item.x + item.swayAmp * Math.sin(item.swayPhase)) * lateral;
      const z = item.z;
      const zc = x * fx + y * fy + z * fz + distance;
      if (zc < NEAR) continue;
      let alpha = level * vertical * item.appear * smoothstep(NEAR, 6.5, zc) * (1 - 0.5 * smoothstep(35, 110, zc));
      let ca = planeCos;
      let sa = planeSin;
      if (item.kind === HEART) {
        // Hearts swing to and fro around the vertical axis (a full spin would show red slivers edge-on).
        const swing = planeYaw + HEART_SWING * Math.sin(item.spin);
        ca = Math.cos(swing);
        sa = Math.sin(swing);
      } else {
        // Planes seen almost edge-on (far off-axis) fade out instead of flickering as slivers.
        const vx = camX - x;
        const vy = camY - y;
        const vz = camZ - z;
        const facing = Math.abs(sa * vx + ca * vz) / Math.sqrt(vx * vx + vy * vy + vz * vz);
        alpha *= smoothstep(0.06, 0.3, facing);
      }
      if (alpha < 0.01) continue;

      const inv = focal / zc;
      const xc = x * rx + z * rz;
      const yc = x * ux + y * uy + z * uz;
      const sx = centerX + xc * inv;
      const sy = centerY - yc * inv;

      // Plane axes in world space: a roll in its own plane, then the plane's yaw.
      const roll = item.roll + item.rollAmp * Math.sin(item.swayPhase * 0.9 + item.slot);
      const cr = Math.cos(roll);
      const sr = Math.sin(roll);
      const Rwx = cr * ca;
      const Rwy = sr;
      const Rwz = -cr * sa;
      const Dwx = sr * ca;
      const Dwy = -cr;
      const Dwz = -sr * sa;
      // Jacobian of the perspective projection at the centre: screen pixels per world unit along each axis.
      const rcx = Rwx * rx + Rwz * rz;
      const rcy = Rwx * ux + Rwy * uy + Rwz * uz;
      const rcz = Rwx * fx + Rwy * fy + Rwz * fz;
      const dcx = Dwx * rx + Dwz * rz;
      const dcy = Dwx * ux + Dwy * uy + Dwz * uz;
      const dcz = Dwx * fx + Dwy * fy + Dwz * fz;
      const ox = xc / zc;
      const oy = yc / zc;
      const k = sprite.unit * item.scale * inv;
      let a = (rcx - ox * rcz) * k;
      let b = -(rcy - oy * rcz) * k;
      const c = (dcx - ox * dcz) * k;
      const d = -(dcy - oy * dcz) * k;
      // Seen from behind: flip horizontally so text and photos never read mirrored.
      if (a * d - b * c < 0) {
        a = -a;
        b = -b;
      }
      const halfW = sprite.image.width / 2;
      const halfH = sprite.image.height / 2;
      const extentX = Math.abs(a) * halfW + Math.abs(c) * halfH;
      const extentY = Math.abs(b) * halfW + Math.abs(d) * halfH;
      if (sx + extentX < 0 || sx - extentX > width || sy + extentY < 0 || sy - extentY > height) continue;
      if (extentX > maxExtent || extentY > maxExtent) continue;
      // Items rushing past the lens grow huge and soft: let them dissolve before they fill the screen.
      alpha *= 1 - smoothstep(0.34 * longSide, 0.66 * longSide, extentX > extentY ? extentX : extentY);
      if (alpha < 0.01) continue;

      item.depth = zc;
      item.alpha = alpha * (item.kind === PHOTO ? 1 : 0.96);
      item.ta = a * dpr;
      item.tb = b * dpr;
      item.tc = c * dpr;
      item.td = d * dpr;
      item.te = sx * dpr;
      item.tf = sy * dpr;
      drawList[count++] = item;
    }

    // Far to near.
    for (let i = 1; i < count; i++) {
      const current = drawList[i];
      let j = i - 1;
      while (j >= 0 && drawList[j].depth < current.depth) {
        drawList[j + 1] = drawList[j];
        j--;
      }
      drawList[j + 1] = current;
    }

    let mode = '';
    for (let i = 0; i < count; i++) {
      const item = drawList[i];
      const sprite = item.sprite;
      if (!sprite) continue;
      // Wishes add light (glowing text); photos and hearts are opaque.
      const wanted = item.kind === WISH ? 'lighter' : 'source-over';
      if (wanted !== mode) {
        ctx.globalCompositeOperation = wanted;
        mode = wanted;
      }
      ctx.globalAlpha = item.alpha > 1 ? 1 : item.alpha;
      ctx.setTransform(item.ta, item.tb, item.tc, item.td, item.te, item.tf);
      ctx.drawImage(sprite.image, -sprite.image.width / 2, -sprite.image.height / 2);
    }
  }

  // ---------------------------------------------------------------- building the world

  private buildSkySprites(): void {
    for (const rgb of STAR_RGB) this.brightSprites.push(this.buildStarSprite(rgb, false));
    for (const rgb of STAR_RGB) this.brightSprites.push(this.buildStarSprite(rgb, true));
    for (const rgb of NEBULA_RGB) this.nebulaSprites.push(this.buildNebulaSprite(rgb));
  }

  private buildStarSprite(rgb: string, flare: boolean): HTMLCanvasElement {
    const size = flare ? 96 : 64;
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;
    const center = size / 2;
    const glow = ctx.createRadialGradient(center, center, 0, center, center, center);
    glow.addColorStop(0, 'rgba(255,255,255,1)');
    glow.addColorStop(flare ? 0.05 : 0.08, `rgba(${rgb},0.95)`);
    glow.addColorStop(flare ? 0.14 : 0.22, `rgba(${rgb},0.4)`);
    glow.addColorStop(0.5, `rgba(${rgb},0.08)`);
    glow.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);
    if (flare) {
      // Soft four-point sparkle.
      ctx.globalCompositeOperation = 'lighter';
      for (const vertical of [false, true]) {
        const spike = vertical
          ? ctx.createLinearGradient(center, 0, center, size)
          : ctx.createLinearGradient(0, center, size, center);
        spike.addColorStop(0, `rgba(${rgb},0)`);
        spike.addColorStop(0.5, `rgba(${rgb},0.75)`);
        spike.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = spike;
        if (vertical) ctx.fillRect(center - 0.8, 0, 1.6, size);
        else ctx.fillRect(0, center - 0.8, size, 1.6);
      }
    }
    return canvas;
  }

  private buildNebulaSprite(rgb: string): HTMLCanvasElement {
    const width = 256;
    const height = 128;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
      const x = random(64, width - 64);
      const y = height / 2 + random(-14, 14);
      const radius = random(30, 58);
      const blob = ctx.createRadialGradient(x, y, 0, x, y, radius);
      blob.addColorStop(0, `rgba(${rgb},0.34)`);
      blob.addColorStop(0.55, `rgba(${rgb},0.12)`);
      blob.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = blob;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    return canvas;
  }

  /** Random unit direction; about a third of them gather around a faint band across the sky. */
  private skyDirection(out: Float32Array, index: number): void {
    let x: number;
    let y: number;
    let z: number;
    if (Math.random() < 0.34) {
      const angle = Math.random() * TAU;
      const offset = gaussian() * 0.24;
      const co = Math.cos(offset);
      const so = Math.sin(offset);
      const ca = Math.cos(angle);
      const sa = Math.sin(angle);
      x = co * (ca * BAND_A[0] + sa * BAND_B[0]) + so * BAND_N[0];
      y = co * (ca * BAND_A[1] + sa * BAND_B[1]) + so * BAND_N[1];
      z = co * (ca * BAND_A[2] + sa * BAND_B[2]) + so * BAND_N[2];
    } else {
      const u = Math.random() * 2 - 1;
      const phi = Math.random() * TAU;
      const r = Math.sqrt(1 - u * u);
      x = r * Math.cos(phi);
      y = u;
      z = r * Math.sin(phi);
    }
    out[index * 3] = x;
    out[index * 3 + 1] = y;
    out[index * 3 + 2] = z;
  }

  private buildStars(): void {
    const count = this.lowTier ? 700 : 1200;
    const bright = this.lowTier ? 60 : 90;
    const direction = new Float32Array(3);
    this.starX = new Float32Array(count);
    this.starY = new Float32Array(count);
    this.starZ = new Float32Array(count);
    this.starSize = new Float32Array(count);
    this.starAlpha = new Float32Array(count);
    this.starAmp = new Float32Array(count);
    this.starF1 = new Float32Array(count);
    this.starP1 = new Float32Array(count);
    this.starF2 = new Float32Array(count);
    this.starP2 = new Float32Array(count);

    let index = 0;
    for (let color = 0; color < STAR_COLORS.length; color++) {
      const last = color === STAR_COLORS.length - 1;
      const groupCount = last ? count - index : Math.min(count - index, Math.round(count * STAR_WEIGHTS[color]));
      for (let i = 0; i < groupCount; i++, index++) {
        this.skyDirection(direction, 0);
        // Stars sit 70–220 units away; farther ones are a little dimmer.
        const radius = random(70, 220);
        const shade = 1 - 0.3 * ((radius - 70) / 150);
        this.starX[index] = direction[0];
        this.starY[index] = direction[1];
        this.starZ[index] = direction[2];
        this.starSize[index] = Math.random() < 0.06 ? random(1.7, 2.5) : 0.9 + 0.9 * Math.pow(Math.random(), 1.6);
        this.starAlpha[index] = random(0.55, 1) * shade;
        this.starAmp[index] = 0.12 + 0.5 * Math.pow(Math.random(), 1.4);
        this.starF1[index] = random(0.5, 2.2);
        this.starP1[index] = Math.random() * TAU;
        this.starF2[index] = random(1.6, 4.4);
        this.starP2[index] = Math.random() * TAU;
      }
      this.starGroupEnd[color] = index;
    }

    this.brightCount = bright;
    this.brightX = new Float32Array(bright);
    this.brightY = new Float32Array(bright);
    this.brightZ = new Float32Array(bright);
    this.brightSize = new Float32Array(bright);
    this.brightAlpha = new Float32Array(bright);
    this.brightF = new Float32Array(bright);
    this.brightP = new Float32Array(bright);
    this.brightSprite = new Uint8Array(bright);
    const flares = this.lowTier ? 10 : 14;
    for (let i = 0; i < bright; i++) {
      this.skyDirection(direction, 0);
      this.brightX[i] = direction[0];
      this.brightY[i] = direction[1];
      this.brightZ[i] = direction[2];
      const flare = i < flares;
      const color = this.pickStarColor();
      this.brightSprite[i] = color + (flare ? STAR_RGB.length : 0);
      this.brightSize[i] = flare ? random(14, 24) : random(6, 13);
      this.brightAlpha[i] = flare ? random(0.75, 1) : random(0.5, 0.95);
      this.brightF[i] = random(0.6, 1.8);
      this.brightP[i] = Math.random() * TAU;
    }

    // Faint, steady dust stars: depth for the sky at the cost of one fillRect each (no twinkle maths).
    const dust = this.lowTier ? 2400 : 3600;
    this.dustX = new Float32Array(dust);
    this.dustY = new Float32Array(dust);
    this.dustZ = new Float32Array(dust);
    this.dustSize = new Float32Array(dust);
    this.dustAlpha = new Float32Array(dust);
    index = 0;
    for (let color = 0; color < DUST_COLORS.length; color++) {
      const end = color === DUST_COLORS.length - 1 ? dust : Math.round(((color + 1) * dust) / DUST_COLORS.length);
      for (; index < end; index++) {
        this.skyDirection(direction, 0);
        this.dustX[index] = direction[0];
        this.dustY[index] = direction[1];
        this.dustZ[index] = direction[2];
        this.dustSize[index] = random(0.7, 1.2);
        this.dustAlpha[index] = 0.22 + 0.48 * Math.pow(Math.random(), 1.5);
      }
      this.dustGroupEnd[color] = index;
    }
  }

  private pickStarColor(): number {
    let roll = Math.random();
    for (let color = 0; color < STAR_WEIGHTS.length; color++) {
      roll -= STAR_WEIGHTS[color];
      if (roll <= 0) return color;
    }
    return 0;
  }

  private buildNebulae(): void {
    const count = this.lowTier ? 3 : 5;
    const direction = new Float32Array(3);
    this.nebulaCount = count;
    this.nebulaX = new Float32Array(count);
    this.nebulaY = new Float32Array(count);
    this.nebulaZ = new Float32Array(count);
    this.nebulaSize = new Float32Array(count);
    this.nebulaAlpha = new Float32Array(count);
    this.nebulaAngle = new Float32Array(count);
    this.nebulaSprite = new Uint8Array(count);
    for (let i = 0; i < count; i++) {
      // Spread along the band, the first one in front of the initial camera.
      const angle = Math.PI / 2 + (i / count) * TAU + random(-0.25, 0.25);
      const offset = random(-0.08, 0.08);
      for (let axis = 0; axis < 3; axis++) {
        direction[axis] = Math.cos(offset) * (Math.cos(angle) * BAND_A[axis] + Math.sin(angle) * BAND_B[axis])
          + Math.sin(offset) * BAND_N[axis];
      }
      this.nebulaX[i] = direction[0];
      this.nebulaY[i] = direction[1];
      this.nebulaZ[i] = direction[2];
      this.nebulaSize[i] = random(1.1, 1.7);
      this.nebulaAlpha[i] = random(0.1, 0.15);
      this.nebulaAngle[i] = random(-0.5, 0.5);
      this.nebulaSprite[i] = i % NEBULA_RGB.length;
    }
  }

  private buildGlitter(): void {
    const count = this.lowTier ? 70 : 140;
    this.glitterCount = count;
    this.glitterX = new Float32Array(count);
    this.glitterY = new Float32Array(count);
    this.glitterZ = new Float32Array(count);
    this.glitterSpeed = new Float32Array(count);
    this.glitterPhase = new Float32Array(count);
    this.glitterSize = new Float32Array(count);
    let index = 0;
    for (let color = 0; color < GLITTER_COLORS.length; color++) {
      const end = color === GLITTER_COLORS.length - 1 ? count : Math.round(((color + 1) * count) / GLITTER_COLORS.length);
      for (; index < end; index++) {
        this.glitterX[index] = random(-45, 45);
        this.glitterY[index] = random(Y_BOTTOM, Y_TOP);
        this.glitterZ[index] = random(-25, 42);
        this.glitterSpeed[index] = random(2.5, 5.5);
        this.glitterPhase[index] = Math.random() * TAU;
        this.glitterSize[index] = random(0.9, 2);
      }
      this.glitterGroupEnd[color] = index;
    }
  }

  private buildItems(): void {
    const low = this.lowTier;

    const wishRows = low ? 6 : 8;
    const wishCols = low ? 10 : 14;
    this.wishCols = wishCols;
    const wishSlots = shuffledRange(wishRows * wishCols);
    for (let row = 0; row < wishRows; row++) {
      for (let col = 0; col < wishCols; col++) {
        const item = new RainItem();
        item.kind = WISH;
        item.row = row;
        item.col = col;
        item.slot = wishSlots[row * wishCols + col];
        item.jitterX = random(-1, 1);
        item.jitterZ = random(-1, 1);
        item.y = random(Y_BOTTOM, Y_TOP);
        item.speed = random(7, 9);
        item.scale = random(0.92, 1.1);
        item.swayAmp = 0.45;
        item.swaySpeed = random(0.55, 1.05);
        item.swayPhase = Math.random() * TAU;
        item.rollAmp = 0.035;
        this.items.push(item);
        this.wishItems.push(item);
      }
    }
    this.layoutWishes(3.4);

    const photoXs = low ? [-20, 0, 20] : [-27, -9, 9, 27];
    const photoZs = low ? [-10, 3, 16] : [-10, 0, 10, 20];
    const photoSlots = shuffledRange(photoXs.length * photoZs.length);
    photoZs.forEach((z, row) => {
      photoXs.forEach((x, col) => {
        const item = new RainItem();
        item.kind = PHOTO;
        item.row = row;
        item.col = col;
        item.slot = photoSlots[row * photoXs.length + col];
        item.gridX = x;
        item.wrapJitter = 2.5;
        item.x = x + random(-1, 1) * item.wrapJitter;
        item.z = z + random(-2, 2);
        item.y = random(Y_BOTTOM, Y_TOP);
        item.speed = random(4, 9);
        item.swayAmp = random(0.8, 1.6);
        item.swaySpeed = random(0.45, 0.85);
        item.swayPhase = Math.random() * TAU;
        item.roll = random(-0.12, 0.12);
        item.rollAmp = 0.05;
        this.items.push(item);
        this.photoItems.push(item);
      });
    });

    this.heartSprite = this.buildHeartSprite();
    const heartRows = low ? 3 : 4;
    const heartCols = low ? 5 : 6;
    for (let row = 0; row < heartRows; row++) {
      for (let col = 0; col < heartCols; col++) {
        const item = new RainItem();
        item.kind = HEART;
        item.row = row;
        item.col = col;
        item.slot = row * heartCols + col;
        item.gridX = (col - (heartCols - 1) / 2) * 7.5;
        item.wrapJitter = 2.5;
        item.x = item.gridX + random(-1, 1) * item.wrapJitter;
        item.z = -14 + row * (low ? 13 : 10) + random(-3, 3);
        item.y = random(Y_BOTTOM, Y_TOP);
        item.speed = random(5, 12);
        item.scale = random(0.8, 1.25);
        item.swayAmp = random(0.6, 1.2);
        item.swaySpeed = random(0.9, 1.7);
        item.swayPhase = Math.random() * TAU;
        item.roll = random(-0.25, 0.25);
        item.rollAmp = 0.2;
        item.spin = Math.random() * TAU;
        item.spinSpeed = random(1.1, 2.4) * (Math.random() < 0.5 ? -1 : 1);
        item.sprite = this.heartSprite;
        item.appear = 1;
        this.items.push(item);
      }
    }
    this.drawList = new Array<RainItem>(this.items.length);
  }

  /** Grid of wishes: x = (col − (cols−1)/2)·s, z = −10 + row·s·1.5 (some rows pass beside and behind the camera). */
  private layoutWishes(spacing: number): void {
    if (spacing === this.wishSpacing) return;
    this.wishSpacing = spacing;
    const cols = this.wishCols;
    for (const item of this.wishItems) {
      item.gridX = (item.col - (cols - 1) / 2) * spacing;
      item.wrapJitter = spacing * 0.35;
      item.x = item.gridX + item.jitterX * item.wrapJitter;
      item.z = -10 + item.row * spacing * 1.5 + item.jitterZ * spacing * 0.4;
    }
  }

  // ---------------------------------------------------------------- wishes

  private ensureFont(): void {
    const fonts = document.fonts;
    if (!fonts || typeof fonts.load !== 'function') {
      this.fontReady = true;
      return;
    }
    const spec = `700 ${WISH_FONT_SIZE}px Quicksand`;
    try {
      if (fonts.check(spec, FONT_SAMPLE)) {
        this.fontReady = true;
        return;
      }
    } catch {
      this.fontReady = true;
      return;
    }
    this.fontTimer = setTimeout(() => this.onFontSettled(false), FONT_TIMEOUT_MS);
    fonts.load(spec, FONT_SAMPLE).then(
      faces => this.onFontSettled(faces.length > 0),
      () => this.onFontSettled(false)
    );
  }

  private onFontSettled(loaded: boolean): void {
    if (this.destroyed) return;
    if (this.fontTimer !== null) {
      clearTimeout(this.fontTimer);
      this.fontTimer = null;
    }
    if (this.fontReady) {
      // The timeout won: rebuild the fallback-font sprites now that Quicksand is here.
      if (loaded && this.fontFallbackUsed) {
        this.fontFallbackUsed = false;
        this.neededWishKeys.forEach(key => this.pendingWishKeys.add(key));
        this.flushWishQueue();
      }
      return;
    }
    this.fontReady = true;
    this.fontFallbackUsed = !loaded;
    this.flushWishQueue();
  }

  private setWishes(texts: string[]): void {
    if (sameList(texts, this.wishTexts)) return;
    this.wishTexts = texts;
    this.layoutWishes(texts.some(text => text.length > 20) ? 6 : 3.4);

    const needed = new Set<string>();
    texts.forEach((text, index) => {
      if (texts.length === 1) {
        needed.add(this.wishKey(0, text));
        needed.add(this.wishKey(1, text));
      } else {
        needed.add(this.wishKey(index % 2, text));
      }
    });
    this.neededWishKeys = needed;
    for (const key of this.pendingWishKeys) if (!needed.has(key)) this.pendingWishKeys.delete(key);
    for (const key of needed) if (!this.wishSprites.has(key)) this.pendingWishKeys.add(key);

    // Re-point the items first, then free the sprites nobody uses any more.
    this.assignWishSprites();
    for (const [key, sprite] of this.wishSprites) {
      if (!needed.has(key)) {
        this.wishSprites.delete(key);
        releaseCanvas(sprite.image);
      }
    }
    this.flushWishQueue();
  }

  private wishKey(color: number, text: string): string {
    return `${color}|${text}`;
  }

  private flushWishQueue(): void {
    if (!this.fontReady || !this.pendingWishKeys.size) return;
    const keys = Array.from(this.pendingWishKeys);
    this.pendingWishKeys.clear();
    for (const key of keys) {
      // A queued task builds with whatever font is ready when it runs.
      if (this.queuedWishKeys.has(key)) continue;
      this.queuedWishKeys.add(key);
      this.tasks.push(() => {
        this.queuedWishKeys.delete(key);
        if (this.destroyed || !this.neededWishKeys.has(key)) return;
        const separator = key.indexOf('|');
        const color = Number(key.slice(0, separator));
        const sprite = this.buildWishSprite(key.slice(separator + 1), color);
        if (!sprite) return;
        const previous = this.wishSprites.get(key);
        this.wishSprites.set(key, sprite);
        this.assignWishSprites();
        if (previous && previous !== sprite) releaseCanvas(previous.image);
      });
    }
  }

  private assignWishSprites(): void {
    const texts = this.wishTexts;
    const count = texts.length;
    for (const item of this.wishItems) {
      let key = '';
      if (count) {
        const index = item.slot % count;
        const color = count === 1 ? item.slot % 2 : index % 2;
        key = this.wishKey(color, texts[index]);
      }
      const sprite = key ? this.wishSprites.get(key) ?? null : null;
      if (key !== item.key) {
        item.key = key;
        item.sprite = sprite;
        item.appear = 0;
      } else if (sprite !== item.sprite) {
        // Same text, new sprite (font swap): keep it visible; a first sprite fades in.
        if (!item.sprite) item.appear = 0;
        item.sprite = sprite;
      }
    }
  }

  private buildWishSprite(text: string, color: number): Sprite | null {
    const measure = createCanvas(1, 1).getContext('2d');
    if (!measure) return null;
    measure.font = WISH_FONT;

    // A line break every 6 words; very long lines also wrap by width.
    const lines: string[] = [];
    const words = text.split(' ').filter(Boolean);
    for (let i = 0; i < words.length; i += WISH_WORDS_PER_LINE) {
      let line = '';
      for (const word of words.slice(i, i + WISH_WORDS_PER_LINE)) {
        const candidate = line ? `${line} ${word}` : word;
        if (line && measure.measureText(candidate).width > WISH_MAX_LINE_WIDTH) {
          lines.push(line);
          line = word;
        } else {
          line = candidate;
        }
      }
      if (line) lines.push(line);
    }
    if (!lines.length) return null;

    const lineWidths = lines.map(line => Math.min(WISH_MAX_LINE_WIDTH * 1.4, measure.measureText(line).width));
    const width = Math.ceil(Math.max(...lineWidths) + WISH_PAD * 2);
    const height = Math.ceil(lines.length * WISH_LINE_HEIGHT + WISH_PAD * 2);
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.font = WISH_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const centerX = width / 2;
    const lineY = (index: number) => WISH_PAD + WISH_LINE_HEIGHT * (index + 0.5);
    const maxWidth = WISH_MAX_LINE_WIDTH * 1.4;

    // Baked glow: a wide pink halo, then a brighter core.
    ctx.shadowColor = WISH_GLOW;
    ctx.shadowBlur = 24;
    ctx.fillStyle = WISH_COLORS[color] ?? WISH_COLORS[0];
    lines.forEach((line, index) => ctx.fillText(line, centerX, lineY(index), maxWidth));
    ctx.shadowColor = WISH_CORE_GLOW;
    ctx.shadowBlur = 6;
    ctx.fillStyle = WISH_CORE_COLORS[color] ?? WISH_CORE_COLORS[0];
    lines.forEach((line, index) => ctx.fillText(line, centerX, lineY(index), maxWidth));

    return { image: canvas, unit: WISH_WORLD_LINE / WISH_LINE_HEIGHT };
  }

  // ---------------------------------------------------------------- photos

  private setPhotos(urls: string[]): void {
    if (sameList(urls, this.photoUrls)) return;
    this.photoUrls = urls;
    for (const url of urls) {
      if (this.photoEntries.has(url)) continue;
      const entry: PhotoEntry = { url, state: 'loading', image: null, sprite: null };
      this.photoEntries.set(url, entry);
      this.loadPhoto(entry);
    }
    const removed = Array.from(this.photoEntries.values()).filter(entry => !urls.includes(entry.url));
    removed.forEach(entry => this.photoEntries.delete(entry.url));
    this.refreshReadyPhotos();
    removed.forEach(entry => this.releasePhoto(entry));
  }

  /**
   * No crossOrigin on purpose: pixels are never read back, so a tainted canvas is fine, and a plain request
   * shares the browser cache with the bouquet's <img> (the image host answers CORS requests with `Vary: Origin`,
   * which would download every photo twice).
   */
  private loadPhoto(entry: PhotoEntry): void {
    const image = new Image();
    entry.image = image;
    image.decoding = 'async';
    image.onload = () => {
      image.onload = null;
      image.onerror = null;
      if (this.destroyed || entry.image !== image) return;
      const ready = typeof image.decode === 'function' ? image.decode().catch(() => undefined) : Promise.resolve();
      ready.then(() => {
        if (this.destroyed || entry.image !== image) return;
        this.tasks.push(() => this.finishPhoto(entry, image));
        this.requestFrame();
      });
    };
    image.onerror = () => {
      image.onload = null;
      image.onerror = null;
      if (this.destroyed || entry.image !== image) return;
      // Broken images are skipped: the other photos fill their slots.
      entry.image = null;
      entry.state = 'broken';
    };
    image.src = entry.url;
  }

  private finishPhoto(entry: PhotoEntry, image: HTMLImageElement): void {
    if (this.destroyed || entry.image !== image || this.photoEntries.get(entry.url) !== entry) return;
    entry.image = null;
    if (!image.naturalWidth || !image.naturalHeight) {
      entry.state = 'broken';
      return;
    }
    try {
      entry.sprite = this.buildPhotoSprite(image);
      entry.state = entry.sprite ? 'ready' : 'broken';
    } catch {
      entry.sprite = null;
      entry.state = 'broken';
    }
    this.refreshReadyPhotos();
  }

  private releasePhoto(entry: PhotoEntry): void {
    const image = entry.image;
    entry.image = null;
    if (image) {
      image.onload = null;
      image.onerror = null;
      image.removeAttribute('src');
    }
    releaseCanvas(entry.sprite?.image);
    entry.sprite = null;
  }

  private refreshReadyPhotos(): void {
    const ready: Sprite[] = [];
    for (const url of this.photoUrls) {
      const entry = this.photoEntries.get(url);
      if (entry?.state === 'ready' && entry.sprite) ready.push(entry.sprite);
    }
    this.readyPhotos = ready;
    for (const item of this.photoItems) {
      const sprite = ready.length ? ready[item.slot % ready.length] : null;
      if (sprite !== item.sprite) {
        item.sprite = sprite;
        item.appear = 0;
      }
    }
  }

  /**
   * A photo item wrapping to the top is still fully faded there, so it changes photo unseen: to the one the other
   * items show least (the next in order on a tie). Every photo comes round, even with fewer items than photos.
   */
  private nextPhoto(item: RainItem): void {
    const ready = this.readyPhotos;
    const count = ready.length;
    if (count < 2) return;
    const uses = new Array<number>(count).fill(0);
    for (const other of this.photoItems) if (other !== item) uses[other.slot % count]++;
    let step = 1;
    for (let candidate = 2; candidate <= count; candidate++) {
      if (uses[(item.slot + candidate) % count] < uses[(item.slot + step) % count]) step = candidate;
    }
    // Kept below count: when the list changes later (late load, preview edit), fewer items swap mid-flight.
    item.slot = (item.slot + step) % count;
    item.sprite = ready[item.slot];
  }

  private buildPhotoSprite(image: HTMLImageElement): Sprite | null {
    const maxSide = this.lowTier ? 512 : 768;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const longest = Math.max(width, height);
    const pad = Math.max(8, Math.round(longest * 0.08));
    const radius = Math.min(width, height) * 0.06;
    const canvas = createCanvas(width + pad * 2, height + pad * 2);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Soft pink outer glow.
    ctx.save();
    ctx.shadowColor = PHOTO_GLOW;
    ctx.shadowBlur = pad * 0.9;
    ctx.fillStyle = '#ffe4ef';
    roundedRectPath(ctx, pad, pad, width, height, radius);
    ctx.fill();
    ctx.restore();

    ctx.save();
    roundedRectPath(ctx, pad, pad, width, height, radius);
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, pad, pad, width, height);
    ctx.restore();

    // Thin light rim.
    const line = Math.max(1.5, longest * 0.006);
    ctx.lineWidth = line;
    ctx.strokeStyle = 'rgba(255,238,246,0.6)';
    roundedRectPath(ctx, pad + line / 2, pad + line / 2, width - line, height - line, Math.max(0, radius - line / 2));
    ctx.stroke();

    return { image: canvas, unit: PHOTO_WORLD_SIZE / longest };
  }

  private buildHeartSprite(): Sprite | null {
    const heartWidth = 120;
    const heartHeight = 108;
    const pad = 34;
    const canvas = createCanvas(heartWidth + pad * 2, heartHeight + pad * 2);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const cx = canvas.width / 2;
    const top = pad;

    const fill = ctx.createLinearGradient(0, top, 0, top + heartHeight);
    fill.addColorStop(0, HEART_TOP);
    fill.addColorStop(1, HEART_BOTTOM);
    ctx.shadowColor = HEART_GLOW;
    ctx.shadowBlur = 26;
    ctx.fillStyle = fill;
    heartPath(ctx, cx, top, heartWidth, heartHeight);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.shadowColor = 'rgba(0,0,0,0)';
    ctx.save();
    heartPath(ctx, cx, top, heartWidth, heartHeight);
    ctx.clip();
    // Glossy highlight on the left lobe and a soft inner shade at the tip.
    const glossX = cx - heartWidth * 0.22;
    const glossY = top + heartHeight * 0.27;
    const gloss = ctx.createRadialGradient(glossX, glossY, 0, glossX, glossY, heartWidth * 0.32);
    gloss.addColorStop(0, 'rgba(255,255,255,0.6)');
    gloss.addColorStop(0.45, 'rgba(255,214,226,0.22)');
    gloss.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gloss;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const shade = ctx.createRadialGradient(cx, top + heartHeight * 0.95, 0, cx, top + heartHeight * 0.95, heartWidth * 0.5);
    shade.addColorStop(0, 'rgba(120,0,30,0.28)');
    shade.addColorStop(1, 'rgba(120,0,30,0)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    return { image: canvas, unit: HEART_WORLD_SIZE / heartWidth };
  }

  // ---------------------------------------------------------------- controls

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (!this.controlsEnabled) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    try {
      this.canvas.setPointerCapture(event.pointerId);
    } catch {
      // The pointer may already be gone.
    }
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.yawVelocity = 0;
    this.pitchVelocity = 0;
    this.lastMoveAt = performance.now();
    if (this.pointers.size >= 2) this.beginPinch();
    this.updateCursor();
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const pointer = this.pointers.get(event.pointerId);
    if (!pointer || !this.controlsEnabled) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (this.pointers.size >= 2) {
      this.updatePinch();
      return;
    }
    const now = performance.now();
    const perPixel = 2.8 / Math.max(400, this.height);
    const deltaYaw = -dx * perPixel;
    const deltaPitch = dy * perPixel;
    this.yaw += deltaYaw;
    this.pitch = clamp(this.pitch + deltaPitch, -PITCH_LIMIT, PITCH_LIMIT);
    const elapsed = Math.max(8, now - this.lastMoveAt) / 1000;
    this.yawVelocity = clamp(this.yawVelocity * 0.5 + (deltaYaw / elapsed) * 0.5, -4, 4);
    this.pitchVelocity = clamp(this.pitchVelocity * 0.5 + (deltaPitch / elapsed) * 0.5, -3, 3);
    this.lastMoveAt = now;
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (!this.pointers.delete(event.pointerId)) return;
    if (this.pointers.size === 1) {
      // Back from a pinch to a one-finger drag.
      this.yawVelocity = 0;
      this.pitchVelocity = 0;
      this.lastMoveAt = performance.now();
    } else if (this.pointers.size === 0 && performance.now() - this.lastMoveAt > 90) {
      // The finger rested before lifting: no fling.
      this.yawVelocity = 0;
      this.pitchVelocity = 0;
    }
    this.sinceInteraction = 0;
    this.updateCursor();
  };

  private readonly onWheel = (event: WheelEvent): void => {
    if (!this.controlsEnabled) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? Math.max(1, this.height) : 1;
    const delta = clamp(event.deltaY * unit, -240, 240);
    // Trackpad pinch arrives as ctrl+wheel with small deltas.
    const factor = event.ctrlKey ? 0.01 : 0.0015;
    this.distanceTarget = clamp(this.distanceTarget * Math.exp(delta * factor), MIN_DISTANCE, MAX_DISTANCE);
    this.sinceInteraction = 0;
  };

  private readonly onContextMenu = (event: Event): void => {
    if (this.controlsEnabled) event.preventDefault();
  };

  private beginPinch(): void {
    const distance = this.pointerSpread();
    this.pinchStart = distance;
    this.pinchDistanceStart = this.distanceTarget;
    this.yawVelocity = 0;
    this.pitchVelocity = 0;
  }

  private updatePinch(): void {
    const spread = this.pointerSpread();
    if (this.pinchStart > 0 && spread > 0) {
      this.distanceTarget = clamp((this.pinchDistanceStart * this.pinchStart) / spread, MIN_DISTANCE, MAX_DISTANCE);
    }
  }

  private pointerSpread(): number {
    const [first, second] = Array.from(this.pointers.values());
    return first && second ? Math.hypot(first.x - second.x, first.y - second.y) : 0;
  }

  private releasePointers(): void {
    for (const id of this.pointers.keys()) {
      try {
        if (this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id);
      } catch {
        // Ignore: capture already lost.
      }
    }
    this.pointers.clear();
  }

  private updateCursor(): void {
    if (this.destroyed) return;
    this.canvas.style.cursor = this.controlsEnabled ? (this.pointers.size ? 'grabbing' : 'grab') : '';
  }
}
