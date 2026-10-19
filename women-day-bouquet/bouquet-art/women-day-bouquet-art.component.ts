import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  input,
  signal,
  viewChildren
} from '@angular/core';
import { BOUQUET_LAYERS, BOUQUET_PHOTO_SLOTS, BouquetLayer } from './bouquet-layers';

type StyleMap = Readonly<Record<string, string>>;

interface LayerView {
  readonly src: string;
  /** Position, size, stacking and rotation/flip in % of the art box. */
  readonly style: StyleMap;
  /** Photo slot whose photo takes this flower's place, or null. */
  readonly slot: number | null;
  readonly butterfly: boolean;
  /** Second butterfly: its own timing, so the two never beat in sync. */
  readonly alt: boolean;
}

interface CardLayout {
  readonly index: number;
  readonly style: StyleMap;
}

/** Reveal stagger per slot (ms): the centre first, then the top, the upper sides and the lower sides. */
const SLOT_STAGGER_MS: readonly number[] = [0, 220, 440, 120, 600, 760];
/** A photo starts growing a beat after its rose starts to dissolve. */
const PHOTO_DELAY_MS = 160;

const percent = (value: number) => `${value}%`;

/** Same order as the asset composition: mirror first, then rotate around the image centre. */
function layerTransform({ rotate, flip }: BouquetLayer): string | null {
  const parts = [rotate ? `rotate(${rotate}deg)` : '', flip ? 'scaleX(-1)' : ''].filter(Boolean);
  return parts.length ? parts.join(' ') : null;
}

const LAYERS: readonly LayerView[] = (() => {
  let butterflies = 0;
  return BOUQUET_LAYERS.map(layer => {
    const slot = layer.slot ?? null;
    const style: Record<string, string> = {
      left: percent(layer.x),
      top: percent(layer.y),
      width: percent(layer.w),
      'z-index': String(layer.z)
    };
    const transform = layerTransform(layer);
    if (transform) style['transform'] = transform;
    if (slot !== null) style['animation-delay'] = `${SLOT_STAGGER_MS[slot] ?? 0}ms`;
    const butterfly = layer.kind === 'butterfly';
    return { src: layer.src, style, slot, butterfly, alt: butterfly && butterflies++ % 2 === 1 };
  });
})();

const CARDS: readonly CardLayout[] = BOUQUET_PHOTO_SLOTS.map((slot, index) => ({
  index,
  style: {
    left: percent(slot.x),
    top: percent(slot.y),
    width: percent(slot.w),
    height: percent(slot.h),
    rotate: `${slot.rotate}deg`,
    'z-index': String(slot.z),
    'animation-delay': `${PHOTO_DELAY_MS + (SLOT_STAGGER_MS[index] ?? 0)}ms`
  }
}));

/**
 * Decorative bouquet of the 20/10 card: layered raster artwork (wrap papers, leaves, baby's breath, roses, satin bow,
 * butterflies) whose six slot roses give way to the card's photos on reveal. Purely presentational and
 * pointer-transparent: the parent's button covers it and handles the interaction.
 */
@Component({
  selector: 'app-women-day-bouquet-art',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './women-day-bouquet-art.component.html',
  styleUrl: './women-day-bouquet-art.component.css',
  host: {
    class: 'pointer-events-none block w-full select-none [-webkit-touch-callout:none]',
    'aria-hidden': 'true'
  }
})
export class WomenDayBouquetArtComponent {
  /** Bouquet photos: photo i takes the place of the rose of slot i (the first 6 are used). */
  readonly photos = input<readonly string[]>([]);
  /** false: roses; true: the roses of the slots that have a photo dissolve into those photos. */
  readonly revealed = input(false);

  protected readonly layers = LAYERS;

  private readonly broken = signal<ReadonlySet<string>>(new Set());
  private readonly images = viewChildren<ElementRef<HTMLImageElement>>('image');

  protected readonly cards = computed(() => {
    const photos = this.photos();
    const broken = this.broken();
    const revealed = this.revealed();
    return CARDS.map(card => {
      const src = photos[card.index]?.trim() || null;
      // A photo that cannot load keeps its rose instead of showing an empty frame.
      const photo = src && !broken.has(src) ? src : null;
      return { ...card, photo, shown: revealed && photo !== null };
    });
  });

  /** Per slot: its rose has given way to the photo. */
  protected readonly dissolved = computed(() => this.cards().map(card => card.shown));

  constructor() {
    // An image may already have failed before hydration attached the (error) listeners.
    afterNextRender(() => {
      for (const { nativeElement: image } of this.images()) {
        const src = image.getAttribute('src');
        if (src && image.complete && image.naturalWidth === 0) this.markBroken(src);
      }
    });
  }

  protected isBroken(src: string): boolean {
    return this.broken().has(src);
  }

  protected markBroken(src: string): void {
    this.broken.update(set => (set.has(src) ? set : new Set(set).add(src)));
  }
}
