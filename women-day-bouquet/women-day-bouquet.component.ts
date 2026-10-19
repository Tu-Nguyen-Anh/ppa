import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterEveryRender,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild
} from '@angular/core';
import { Confirm, Thiep } from '../../../models/thiep.model';
import {
  WomenDayEnvelope,
  getWomenDayEnvelope,
  getWomenDayPhotos,
  getWomenDaySkyWishes,
  parseWomenDayContent
} from '../../../models/women-day-content';
import { WomenDayBouquetArtComponent } from './bouquet-art/women-day-bouquet-art.component';
import { WomenDayLetterComponent } from './letter/women-day-letter.component';
import { WomenDayScene } from './women-day-scene';

type BouquetPhase = 'intro' | 'revealed' | 'opening' | 'sky';
type TooltipState = 'hidden' | 'shown' | 'leaving';
type Timer = ReturnType<typeof setTimeout>;

/** After the tap the photos bloom out of the roses; the gift then opens by itself (another tap opens it sooner). */
const BLOOM_MS = 2600;
const BLOOM_REDUCED_MS = 900;
/** A tap this soon after the reveal is the second half of a double tap: it must not skip the bloom. */
const DOUBLE_TAP_MS = 500;
const OPENING_MS = 1400;
const OPENING_REDUCED_MS = 200;
const TOOLTIP_DELAY_MS = 800;
const TOOLTIP_MS = 4000;
const TOOLTIP_FADE_MS = 500;
const FOCUS_DIM = 0.7;
const LETTER_SPEED = 0.32;

/** Pink glow behind the bouquet: it brightens while the photos bloom and flares as the gift opens. */
const GLOW: Readonly<Record<BouquetPhase, { opacity: number; scale: number }>> = {
  intro: { opacity: 0.62, scale: 1 },
  revealed: { opacity: 0.86, scale: 1.06 },
  opening: { opacity: 1, scale: 1.16 },
  sky: { opacity: 0, scale: 1.16 }
};

const sameStrings = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

const sameEnvelope = (a: WomenDayEnvelope, b: WomenDayEnvelope) =>
  a.topLine === b.topLine && a.headline === b.headline && a.bottomLine === b.bottomLine;

const sameReplies = (a: readonly Confirm[], b: readonly Confirm[]) =>
  a.length === b.length && a.every((reply, index) => {
    const other = b[index];
    return reply === other || (!!reply && !!other && reply.user === other.user && reply.letter === other.letter
      && reply.isConfirm === other.isConfirm && reply.timestamp === other.timestamp);
  });

/** Read when needed (browser only): the guest may change the setting while the card is open. */
const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * 20/10 card "Bó hoa giữa trời sao": bouquet → (tap) photos bloom out of the roses → the bouquet opens by itself
 * into a starry sky of falling wishes, photos and hearts → envelope button → letter with the reply form.
 */
@Component({
  selector: 'app-women-day-bouquet',
  standalone: true,
  imports: [WomenDayBouquetArtComponent, WomenDayLetterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './women-day-bouquet.component.html',
  styleUrl: './women-day-bouquet.component.css'
})
export class WomenDayBouquetComponent {
  readonly invitationData = input<Thiep | null>(null);
  readonly isPreview = input(false);

  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly root = viewChild.required<ElementRef<HTMLElement>>('root');
  private readonly skyCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('skyCanvas');
  private readonly bouquetButton = viewChild<ElementRef<HTMLButtonElement>>('bouquetButton');
  private readonly envelopeButton = viewChild<ElementRef<HTMLButtonElement>>('envelopeButton');

  // Content (the create form sends a new object every 500 ms: equality keeps the scene and children calm).
  private readonly content = computed(() => parseWomenDayContent(this.invitationData()?.description));
  private readonly wishes = computed(() => getWomenDaySkyWishes(this.content()), { equal: sameStrings });
  private readonly photos = computed(() => getWomenDayPhotos(this.invitationData()));
  protected readonly bouquetPhotos = computed(() => this.photos().bouquet, { equal: sameStrings });
  private readonly skyPhotos = computed(() => this.photos().sky, { equal: sameStrings });
  protected readonly letterPhoto = computed(() => this.photos().letter);
  protected readonly envelope = computed(() => getWomenDayEnvelope(this.invitationData()), { equal: sameEnvelope });
  protected readonly letterText = computed(() => this.content().letter);
  protected readonly rsvpQuestion = computed(() => this.content().rsvpQuestion);
  protected readonly senderName = computed(() => this.invitationData()?.senderName?.trim() ?? '');
  protected readonly receiverName = computed(() => this.invitationData()?.receiverName?.trim() ?? '');
  protected readonly invitationId = computed(() => this.invitationData()?.id ?? null);
  protected readonly showReplies = computed(() => !!this.invitationData()?.isShowConfirm);
  protected readonly replies = computed<readonly Confirm[]>(() => this.invitationData()?.confirms ?? [], { equal: sameReplies });

  // Experience: phases only move forward.
  protected readonly phase = signal<BouquetPhase>('intro');
  protected readonly revealed = computed(() => this.phase() !== 'intro');
  protected readonly envelopeVisible = computed(() => this.phase() === 'sky');
  protected readonly sceneReady = signal(false);
  protected readonly tooltip = signal<TooltipState>('hidden');
  protected readonly letterOpen = signal(false);
  protected readonly letterMounted = signal(false);
  protected readonly announcement = signal('');

  protected readonly hintText = computed(() => (this.phase() === 'intro' ? 'Chạm vào bó hoa' : 'Đang mở quà…'));
  protected readonly bouquetLabel = computed(() => (this.phase() === 'intro' ? 'Chạm để mở bó hoa' : 'Mở quà ngay'));
  protected readonly glow = computed(() => GLOW[this.phase()]);

  private readonly scene = signal<WomenDayScene | null>(null);
  private sceneCanvas: HTMLCanvasElement | null = null;
  private disposeScene: (() => void) | null = null;
  private readonly timers = new Set<Timer>();
  private bloomTimer: Timer | null = null;
  private destroyed = false;
  private revealedAt = Number.NEGATIVE_INFINITY;
  private focusEnvelopeOnShow = false;

  constructor() {
    effect(() => {
      const scene = this.scene();
      if (scene) scene.updateContent(this.wishes(), this.skyPhotos());
    });
    effect(() => {
      const scene = this.scene();
      if (scene) this.applyPhase(scene, this.phase());
    });
    effect(() => {
      this.scene()?.setSpeedFactor(this.letterOpen() ? LETTER_SPEED : 1);
    });

    afterEveryRender(() => this.syncScene());
    this.destroyRef.onDestroy(() => this.teardown());
  }

  // ---------------------------------------------------------------- bouquet stage

  /** Tap or click on the stage; Enter and Space arrive here too, as the native click of the bouquet button. */
  protected onStageClick(): void {
    const phase = this.phase();
    if (phase === 'intro') {
      if (this.bouquetPhotos().length) this.reveal();
      else this.startOpening(); // Nothing to bloom: open the gift right away.
    } else if (phase === 'revealed' && performance.now() - this.revealedAt >= DOUBLE_TAP_MS) {
      this.startOpening();
    }
  }

  protected onBouquetKeydown(event: KeyboardEvent): void {
    // A held Enter repeats clicks: one press is one activation.
    if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault();
  }

  // ---------------------------------------------------------------- letter

  protected openLetter(): void {
    this.letterMounted.set(true);
    this.letterOpen.set(true);
    this.hideTooltip();
  }

  protected closeLetter(): void {
    this.letterOpen.set(false);
  }

  // ---------------------------------------------------------------- flow

  private reveal(): void {
    this.phase.set('revealed');
    this.revealedAt = performance.now();
    this.announcement.set('Bó hoa đã nở ra những bức ảnh, món quà đang mở…');
    this.bloomTimer = this.later(() => {
      this.bloomTimer = null;
      this.startOpening();
    }, prefersReducedMotion() ? BLOOM_REDUCED_MS : BLOOM_MS);
  }

  private startOpening(): void {
    const phase = this.phase();
    if (phase === 'opening' || phase === 'sky') return;
    this.clearLater(this.bloomTimer);
    this.bloomTimer = null;
    // Keyboard and screen reader users follow the gift: focus moves on to the envelope button.
    const button = this.bouquetButton()?.nativeElement;
    this.focusEnvelopeOnShow = !!button && document.activeElement === button;
    this.phase.set('opening');
    this.later(() => this.enterSky(), prefersReducedMotion() ? OPENING_REDUCED_MS : OPENING_MS);
  }

  private enterSky(): void {
    // Moved away during the opening: leave focus where the guest put it.
    const moveFocus = this.focusEnvelopeOnShow && this.canMoveFocus();
    this.focusEnvelopeOnShow = false;
    this.phase.set('sky');
    this.announcement.set(
      'Những lời chúc đang rơi giữa trời sao. Bạn có một lá thư: nút "Thư" ở góc trên bên trái. '
      + 'Kéo để xoay, chụm hai ngón hoặc cuộn để phóng to.'
    );
    if (moveFocus) {
      // The bouquet button leaves the DOM: keep focus inside the card until the envelope button renders.
      this.root().nativeElement.focus({ preventScroll: true });
      afterNextRender(() => {
        if (this.canMoveFocus()) this.envelopeButton()?.nativeElement.focus({ preventScroll: true });
      }, { injector: this.injector });
    }
    this.later(() => {
      if (this.letterOpen()) return;
      this.tooltip.set('shown');
      this.later(() => this.hideTooltip(), TOOLTIP_MS);
    }, TOOLTIP_DELAY_MS);
  }

  /** Focus is still where the card left it (bouquet button or root) or nowhere: moving it takes nothing away. */
  private canMoveFocus(): boolean {
    const active = document.activeElement;
    return !active || active === document.body || active === this.root().nativeElement
      || active === this.bouquetButton()?.nativeElement;
  }

  private hideTooltip(): void {
    if (this.tooltip() !== 'shown') return;
    this.tooltip.set('leaving');
    this.later(() => this.tooltip.set('hidden'), TOOLTIP_FADE_MS);
  }

  // ---------------------------------------------------------------- scene

  /**
   * Keeps the sky attached to the current canvas. Runs after every render (browser only) but only acts when
   * the canvas element changes: the first render, and the dev server's HMR, which rebuilds the view around
   * the same component instance.
   */
  private syncScene(): void {
    if (this.destroyed) return;
    const canvas = this.skyCanvas().nativeElement;
    if (canvas === this.sceneCanvas) return;
    if (this.disposeScene) {
      this.disposeScene();
      this.disposeScene = null;
      this.scene.set(null);
      this.sceneReady.set(false);
    }
    this.sceneCanvas = canvas;
    this.createScene(canvas, this.root().nativeElement);
  }

  private createScene(canvas: HTMLCanvasElement, root: HTMLElement): void {
    let scene: WomenDayScene;
    try {
      scene = new WomenDayScene(canvas, {
        wishes: this.wishes(),
        photos: this.skyPhotos(),
        reducedMotion: prefersReducedMotion()
      });
    } catch (error) {
      // The card still works without the sky (bouquet, envelope and letter are DOM).
      console.error('[women-day] Không khởi tạo được bầu trời sao', error);
      return;
    }

    // Size from the root (the create-page preview is a smaller box than the window).
    const measure = () => scene.resize(root.clientWidth, root.clientHeight);
    measure();
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure);
      observer.observe(root);
    } else {
      window.addEventListener('resize', measure);
    }
    this.applyPhase(scene, this.phase());
    scene.start();
    this.scene.set(scene);
    const fadeIn = requestAnimationFrame(() => this.sceneReady.set(true));

    this.disposeScene = () => {
      cancelAnimationFrame(fadeIn);
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      scene.destroy();
    };
  }

  private applyPhase(scene: WomenDayScene, phase: BouquetPhase): void {
    scene.setFocusDim(phase === 'intro' || phase === 'revealed' ? FOCUS_DIM : 0);
    scene.setRain(phase === 'opening' || phase === 'sky');
    scene.setControlsEnabled(phase === 'sky');
  }

  private later(callback: () => void, delay: number): Timer {
    const id = setTimeout(() => {
      this.timers.delete(id);
      if (!this.destroyed) callback();
    }, delay);
    this.timers.add(id);
    return id;
  }

  private clearLater(id: Timer | null): void {
    if (id === null) return;
    clearTimeout(id);
    this.timers.delete(id);
  }

  private teardown(): void {
    this.destroyed = true;
    this.timers.forEach(id => clearTimeout(id));
    this.timers.clear();
    this.disposeScene?.();
    this.disposeScene = null;
  }
}
