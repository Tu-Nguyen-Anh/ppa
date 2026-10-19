import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  PLATFORM_ID,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
  viewChild,
  viewChildren
} from '@angular/core';
import { NgTemplateOutlet, isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { timeout } from 'rxjs';
import { Confirm } from '../../../../models/thiep.model';
import {
  WOMEN_DAY_LIMITS,
  WOMEN_DAY_RSVP_ANSWERS,
  WomenDayEnvelope,
  isWomenDayPreviewId,
  splitWomenDayLetter
} from '../../../../models/women-day-content';
import { InvitationApiService } from '../../../../services/invitation-api.service';
import { ToastService } from '../../../../services/toast.service';
import { StorageUtil } from '../../../../utils/storage.util';

type EnvelopeStage = 'closed' | 'opening' | 'open';
type ReplyAnswer = 'yes' | 'no';

interface SentReply {
  name: string;
  answer: ReplyAnswer | null;
  message: string;
  at: string;
}

interface ReplyView {
  key: string;
  name: string;
  message: string;
  answerLabel: string | null;
  positive: boolean;
  relative: string;
  iso: string | null;
}

/** The paper is out of the pocket (see the choreography in the stylesheet). */
const HANDOFF_MS = 1300;
const LETTER_FLIGHT_MS = 900;
/** Opening done: letter settled (handoff + flight) and the envelope gone. */
const OPENING_MS = 2250;
const LEAVE_MS = 220;
const EASE_OUT = 'cubic-bezier(0.22, 0.75, 0.25, 1)';
const EASE_FLIGHT = 'cubic-bezier(0.5, 0, 0.2, 1)';
const REQUEST_TIMEOUT_MS = 20_000;
const STORAGE_PREFIX = 'rsvp_submitted_';
const MAX_SHOWN_REPLIES = 20;
const EXCERPT_LENGTH = 160;
const FAILURE_MESSAGE = 'Không gửi được hồi âm, vui lòng thử lại.';
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
/** Shared SVG defs of the template. Each instance prefixes their ids (see `ids`, `url`, `href`). */
const DEF_NAMES = ['wax', 'waxPress', 'gloss', 'heart', 'sparkle'] as const;

type DefName = (typeof DEF_NAMES)[number];

/**
 * Flower clusters on the envelope and the letter, built from the bouquet's own artwork (photo roses, small rose
 * leaves and baby's breath, already cached by the time the letter mounts) and the decor corner made from the same
 * elements (public/images/women-day, sources in SOURCES.md).
 */
const DECOR_DIR = '/images/women-day/';
const DECOR_SIZES = {
  'bouquet/rose-pink-a': [396, 361],
  'bouquet/rose-pink-c': [396, 361],
  'bouquet/rose-pink-d': [396, 385],
  'bouquet/rose-cream-a': [391, 396],
  'bouquet/rose-cream-b': [396, 361],
  'bouquet/leaf-a': [228, 187],
  'bouquet/leaf-b': [222, 228],
  'bouquet/leaf-c': [228, 117],
  'bouquet/bb-spray': [286, 248],
  'bouquet/bb-cloud': [258, 206],
  'bouquet/bb-tuft': [161, 131],
  'bouquet/bb-pom': [88, 72],
  'decor/rose-corner': [423, 450]
} as const satisfies Record<string, readonly [number, number]>;

type DecorAsset = keyof typeof DECOR_SIZES;
/** Image centre (x, y) and width in % of the cluster box, rotation in degrees. Back to front. */
type DecorSpec = readonly [asset: DecorAsset, x: number, y: number, width: number, rotate?: number];

interface DecorImage {
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly style: Readonly<Record<string, string>>;
}

function decorCluster(specs: readonly DecorSpec[]): readonly DecorImage[] {
  return specs.map(([asset, x, y, width, rotate = 0]) => ({
    src: `${DECOR_DIR}${asset}.webp`,
    width: DECOR_SIZES[asset][0],
    height: DECOR_SIZES[asset][1],
    style: {
      left: `${x}%`,
      top: `${y}%`,
      width: `${width}%`,
      transform: `translate(-50%, -50%)${rotate ? ` rotate(${rotate}deg)` : ''}`
    }
  }));
}

/**
 * Each cluster fills a box anchored in the template (its aspect ratio and size are set there). Leaves are turned so
 * their tips point away from the roses; baby's breath images grow upwards, so their rotation is the growth direction.
 */
const DECOR_CLUSTERS = {
  /** Envelope flap, top-right corner (box 1.25:1). */
  flap: decorCluster([
    ['bouquet/leaf-c', 52, 40, 20, -164],
    ['bouquet/leaf-a', 46, 60, 22, 12],
    ['bouquet/leaf-b', 58, 74, 20, 57],
    ['bouquet/leaf-c', 84, 78, 24, 66],
    ['bouquet/bb-spray', 47, 56, 36, -112],
    ['bouquet/bb-cloud', 70, 80, 26, 210],
    ['bouquet/bb-tuft', 47, 38, 14, -100],
    ['bouquet/rose-pink-c', 64, 44, 27, 20],
    ['bouquet/rose-cream-b', 62, 14, 34.5, -8],
    ['bouquet/rose-cream-a', 88, 44, 34.5, 10],
    ['bouquet/rose-pink-a', 90, 6, 54, -12]
  ]),
  /** Envelope pocket, bottom-left corner (box 1:1). */
  pocket: decorCluster([
    ['bouquet/leaf-c', 8, 36, 20, -104],
    ['bouquet/leaf-a', 24, 26, 24, 132],
    ['bouquet/leaf-c', 56, 40, 26, -44],
    ['bouquet/leaf-b', 66, 58, 20, -63],
    ['bouquet/bb-spray', 44, 30, 48, 35],
    ['bouquet/bb-cloud', 63, 47, 22, 75],
    ['bouquet/bb-tuft', 64, 28, 14, 40],
    ['bouquet/rose-pink-d', 40, 60, 27, 30],
    ['bouquet/rose-cream-b', 14, 54, 42, -10],
    ['bouquet/rose-cream-a', 48, 82, 34.5, 12],
    ['bouquet/rose-pink-a', 12, 92, 65, 8]
  ]),
  /**
   * Envelope pocket, right side (box 1:1): hidden behind the flap's flowers while the envelope is closed, it keeps
   * the right side of the pocket in bloom once the flap (and its flowers) has turned away.
   */
  side: decorCluster([
    ['bouquet/leaf-c', 30, 52, 22, -174],
    ['bouquet/leaf-a', 38, 70, 26, -13],
    ['bouquet/leaf-b', 62, 76, 26, 17],
    ['bouquet/bb-cloud', 34, 42, 44, -70],
    ['bouquet/bb-tuft', 20, 62, 16, -120],
    ['bouquet/rose-cream-b', 44, 72, 33, 14],
    ['bouquet/rose-pink-c', 80, 44, 58, -20]
  ]),
  /** Greenery tucked under the wax seal (box 1.6:1, centred on the seal). */
  seal: decorCluster([
    ['bouquet/leaf-c', 72, 46, 24, -4],
    ['bouquet/leaf-a', 66, 58, 18, -123],
    ['bouquet/leaf-c', 28, 54, 22, 176],
    ['bouquet/leaf-b', 32, 42, 18, 147],
    ['bouquet/bb-cloud', 76, 34, 28, 70],
    ['bouquet/bb-tuft', 23, 56, 24, -95],
    ['bouquet/bb-pom', 84, 48, 10, 75]
  ]),
  /** Letter paper, top-left corner (box 423:450). */
  corner: decorCluster([['decor/rose-corner', 50, 50, 100, 13]]),
  /** Bottom-right corner of the letter photo (box 1.2:1). */
  photo: decorCluster([
    ['bouquet/leaf-a', 66, 26, 20, 117],
    ['bouquet/leaf-c', 78, 34, 26, -54],
    ['bouquet/leaf-b', 22, 66, 24, 137],
    ['bouquet/bb-spray', 40, 32, 38, -50],
    ['bouquet/bb-cloud', 87, 82, 28, 120],
    ['bouquet/bb-pom', 94, 22, 12, 30],
    ['bouquet/rose-pink-c', 22, 80, 29, -16],
    ['bouquet/rose-cream-b', 46, 70, 38, 6],
    ['bouquet/rose-pink-a', 74, 66, 50, -8]
  ]),
  /** Beside the signature when the letter has no photo (box 1.6:1). */
  signature: decorCluster([
    ['bouquet/leaf-c', 28, 50, 26, -154],
    ['bouquet/leaf-a', 30, 68, 18, 7],
    ['bouquet/bb-cloud', 70, 36, 32, 50],
    ['bouquet/rose-cream-a', 44, 62, 38, -8],
    ['bouquet/rose-pink-a', 70, 66, 42, 10]
  ])
} as const;

let nextInstanceId = 0;

@Component({
  selector: 'app-women-day-letter',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './women-day-letter.component.html',
  styleUrl: './women-day-letter.component.css',
  host: {
    '(document:keydown)': 'onDocumentKeydown($event)'
  }
})
export class WomenDayLetterComponent {
  readonly open = input(false);
  readonly envelope = input.required<WomenDayEnvelope>();
  readonly letterText = input('');
  readonly photoUrl = input<string | null>(null);
  readonly senderName = input('');
  readonly receiverName = input('');
  readonly rsvpQuestion = input('');
  readonly invitationId = input<string | null>(null);
  readonly isPreview = input(false);
  readonly showReplies = input(false);
  readonly replies = input<readonly Confirm[]>([]);
  /** When false, the whole reply area (the "Gửi hồi âm" form and the received-replies list) is hidden. */
  readonly showReplyForm = input(true);
  readonly closed = output<void>();

  private readonly api = inject(InvitationApiService);
  private readonly toast = inject(ToastService);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly limits = WOMEN_DAY_LIMITS;
  protected readonly answerOptions: readonly { value: ReplyAnswer; label: string }[] = [
    { value: 'yes', label: WOMEN_DAY_RSVP_ANSWERS.yes },
    { value: 'no', label: WOMEN_DAY_RSVP_ANSWERS.no }
  ];
  // Several letters can be mounted at once (create page previews), so SVG ids must be unique too: url(#id)
  // resolves to the first match in the document, which may sit in another letter's hidden overlay.
  protected readonly ids = createIds(++nextInstanceId);
  protected readonly url = defMap(name => `url(#${this.ids[name]})`);
  protected readonly href = defMap(name => `#${this.ids[name]}`);
  protected readonly decor = DECOR_CLUSTERS;

  private readonly dialogRef = viewChild<ElementRef<HTMLElement>>('dialog');
  private readonly closeButtonRef = viewChild<ElementRef<HTMLButtonElement>>('closeButton');
  private readonly letterRef = viewChild<ElementRef<HTMLElement>>('letter');
  private readonly paperRef = viewChild<ElementRef<HTMLElement>>('paper');
  private readonly peekRef = viewChild<ElementRef<HTMLElement>>('peek');
  private readonly envelopeBackRef = viewChild<ElementRef<HTMLElement>>('envelopeBack');
  private readonly thanksRef = viewChild<ElementRef<HTMLElement>>('thanks');
  private readonly answerButtonRefs = viewChildren<ElementRef<HTMLButtonElement>>('answerButton');
  private readonly nameInputRef = viewChild<ElementRef<HTMLInputElement>>('nameInput');
  private readonly messageInputRef = viewChild<ElementRef<HTMLTextAreaElement>>('messageInput');

  // Overlay + envelope state
  protected readonly visible = signal(false);
  protected readonly leaving = signal(false);
  protected readonly stage = signal<EnvelopeStage>('closed');
  /** Size of the letter copy inside the envelope (only needed when the letter is wider than the envelope). */
  protected readonly replicaFrame = signal<{ width: number; scale: number } | null>(null);
  private returnFocusTo: HTMLElement | null = null;
  private pressOnBackdrop = false;
  private letterAnimations: Animation[] = [];
  private stageTimer: ReturnType<typeof setTimeout> | null = null;
  private handoffTimer: ReturnType<typeof setTimeout> | null = null;
  private leaveTimer: ReturnType<typeof setTimeout> | null = null;
  private revealTimer: ReturnType<typeof setTimeout> | null = null;

  // Letter
  private readonly letter = computed(() => splitWomenDayLetter(this.letterText()));
  private readonly receiverLabel = computed(() => this.receiverName()?.trim() || 'em');
  protected readonly senderLabel = computed(() => this.senderName()?.trim() || 'người gửi');
  protected readonly greeting = computed(() => this.letter().greeting || `Gửi ${this.receiverLabel()}`);
  protected readonly paragraphs = computed(() => {
    const paragraphs = this.letter().paragraphs;
    return paragraphs.length
      ? paragraphs
      : [`Chúc mừng ngày Phụ nữ Việt Nam 20/10. Mong những điều dịu dàng và hạnh phúc nhất luôn đến với ${this.receiverLabel()}.`];
  });
  protected readonly signature = computed(() => {
    const sender = this.senderName()?.trim();
    return sender ? `${sender} ♡` : '';
  });
  protected readonly photoFailed = linkedSignal({ source: this.photoUrl, computation: () => false });
  protected readonly photo = computed(() => (this.photoFailed() ? null : this.photoUrl()?.trim() || null));
  protected readonly envelopeLabel = computed(() => {
    const { topLine, headline, bottomLine } = this.envelope();
    return `Mở thư: ${topLine}, ${headline}, ${bottomLine}`;
  });

  // Reply form
  private nameEdited = false;
  protected readonly replyName = linkedSignal<string, string>({
    source: () => this.receiverName() ?? '',
    computation: (receiver, previous) => previous && this.nameEdited
      ? previous.value
      : receiver.trim().slice(0, WOMEN_DAY_LIMITS.replyNameLength)
  });
  protected readonly replyMessage = signal('');
  protected readonly replyAnswer = signal<ReplyAnswer | null>(null);
  protected readonly attempted = signal(false);
  protected readonly sending = signal(false);
  protected readonly replyMode = signal<'form' | 'sent'>('form');
  protected readonly sentReply = signal<SentReply | null>(null);
  protected readonly sentIsPreview = signal(false);
  private readonly localReplies = signal<Confirm[]>([]);

  protected readonly question = computed(() => this.rsvpQuestion()?.trim() ?? '');
  protected readonly hasQuestion = computed(() => !!this.question());
  private readonly answerMissing = computed(() => this.hasQuestion() && !this.replyAnswer());
  private readonly nameMissing = computed(() => !this.replyName().trim());
  private readonly messageMissing = computed(() => !this.hasQuestion() && !this.replyMessage().trim());
  protected readonly answerErrorVisible = computed(() => this.attempted() && this.answerMissing());
  protected readonly nameErrorVisible = computed(() => this.attempted() && this.nameMissing());
  protected readonly messageErrorVisible = computed(() => this.attempted() && this.messageMissing());
  private readonly hasDraft = computed(() => this.replyMode() === 'form' && !!this.replyMessage().trim());

  protected readonly sentAnswerLabel = computed(() => {
    const answer = this.sentReply()?.answer;
    return answer && this.hasQuestion() ? WOMEN_DAY_RSVP_ANSWERS[answer] : null;
  });
  protected readonly sentExcerpt = computed(() => {
    const message = this.sentReply()?.message?.trim() ?? '';
    return message.length > EXCERPT_LENGTH ? `${message.slice(0, EXCERPT_LENGTH - 1).trimEnd()}…` : message;
  });

  protected readonly shownReplies = computed<ReplyView[]>(() => {
    if (!this.showReplies()) return [];
    this.visible(); // refresh relative times whenever the letter is shown again
    const now = Date.now();
    const server = Array.isArray(this.replies()) ? this.replies().filter(Boolean) : [];
    const local = this.localReplies().filter(mine => !server.some(reply => isSameReply(reply, mine)));
    const withAnswer = this.hasQuestion();

    return [...local, ...server]
      .map((reply, index) => ({ reply, index, time: parseTimestamp(reply.timestamp) }))
      .sort((a, b) => (b.time ?? 0) - (a.time ?? 0) || a.index - b.index)
      .slice(0, MAX_SHOWN_REPLIES)
      .map(({ reply, index, time }) => ({
        key: `${index}|${reply.timestamp ?? ''}|${reply.user ?? ''}`,
        name: reply.user?.trim() || 'Một người bạn',
        message: reply.letter?.trim() ?? '',
        answerLabel: withAnswer ? (reply.isConfirm ? WOMEN_DAY_RSVP_ANSWERS.yes : WOMEN_DAY_RSVP_ANSWERS.no) : null,
        positive: !!reply.isConfirm,
        relative: time === null ? '' : formatRelativeTime(time, now),
        iso: time === null ? null : new Date(time).toISOString()
      }));
  });

  constructor() {
    effect(() => {
      const open = this.open();
      untracked(() => (open ? this.show() : this.hide()));
    });

    effect(() => {
      const id = this.invitationId();
      if (this.isBrowser) untracked(() => this.restoreSentReply(id));
    });

    this.destroyRef.onDestroy(() => {
      for (const timer of [this.stageTimer, this.handoffTimer, this.leaveTimer, this.revealTimer]) {
        if (timer) clearTimeout(timer);
      }
      this.cancelLetterAnimations();
    });
  }

  // ---------------------------------------------------------------- dialog

  protected requestClose(): void {
    this.closed.emit();
  }

  protected onBackdropPointerDown(event: PointerEvent): void {
    this.pressOnBackdrop = isBackdrop(event.target);
  }

  protected onBackdropPointerUp(event: PointerEvent): void {
    if (!isBackdrop(event.target)) this.pressOnBackdrop = false;
  }

  protected onBackdropClick(event: MouseEvent): void {
    // A drag between the backdrop and the letter or the envelope (text selection, textarea resize) also ends as a
    // click on the stage, their common ancestor: only a press and a release both on the backdrop close.
    const pressOnBackdrop = this.pressOnBackdrop;
    this.pressOnBackdrop = false;
    if (!pressOnBackdrop || !isBackdrop(event.target)) return;
    // Keep an unsent reply safe from stray taps around the letter.
    if (this.hasDraft() || this.sending()) return;
    this.requestClose();
  }

  protected onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.visible() || this.leaving() || !this.isOwnFocus(event.target)) return;
    if ((event.key === 'Escape' || event.key === 'Esc') && !event.isComposing) {
      event.preventDefault();
      this.requestClose();
    } else if (event.key === 'Tab') {
      this.trapFocus(event);
    }
  }

  private show(): void {
    this.clearTimer('leave');
    this.leaving.set(false);
    if (!this.isBrowser) {
      this.visible.set(true);
      return;
    }
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body && !this.dialogRef()?.nativeElement.contains(active)) {
      this.returnFocusTo = active;
    }
    this.visible.set(true);
    this.focusAfterRender(() => this.closeButtonRef()?.nativeElement);
    if (this.stage() === 'open' && !prefersReducedMotion()) {
      afterNextRender(() => this.animateLetter(
        [{ opacity: 0, transform: 'translateY(14px) scale(0.985)' }, { opacity: 1, transform: 'none' }],
        420,
        'backwards',
        EASE_OUT
      ), { injector: this.injector });
    }
  }

  private hide(): void {
    if (!this.visible() || this.leaving()) return;
    if (this.stage() === 'opening') this.finishOpening(false);
    if (!this.isBrowser || prefersReducedMotion()) {
      this.visible.set(false);
      this.restoreFocus();
      return;
    }
    this.leaving.set(true);
    this.restoreFocus();
    this.leaveTimer = setTimeout(() => {
      this.leaveTimer = null;
      this.leaving.set(false);
      this.visible.set(false);
    }, LEAVE_MS);
  }

  private restoreFocus(): void {
    const target = this.returnFocusTo;
    this.returnFocusTo = null;
    if (target?.isConnected && this.isOwnFocus(document.activeElement)) target.focus({ preventScroll: true });
  }

  /**
   * Focus (or a key's target) inside the letter, or on nothing in particular (body). Anything else belongs to the
   * page: on the create page the form beside the preview and the zoomed preview modal keep their own keys and focus.
   */
  private isOwnFocus(node: EventTarget | null): boolean {
    if (!(node instanceof Node) || node === document.body || node === document.documentElement) return true;
    return !!this.dialogRef()?.nativeElement.contains(node);
  }

  private trapFocus(event: KeyboardEvent): void {
    const dialog = this.dialogRef()?.nativeElement;
    if (!dialog) return;
    const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
      .filter(element => element.getClientRects().length > 0 && element.getAttribute('aria-hidden') !== 'true');
    if (!focusables.length) {
      event.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    const inside = active instanceof HTMLElement && dialog.contains(active);
    if (event.shiftKey ? !inside || active === first || active === dialog : !inside || active === last) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  }

  // -------------------------------------------------------------- envelope

  protected openEnvelope(): void {
    if (this.stage() !== 'closed') return;
    if (!this.isBrowser || prefersReducedMotion()) {
      this.finishOpening(true);
      return;
    }
    this.measureReplica();
    this.stage.set('opening');
    this.handoffTimer = setTimeout(() => {
      this.handoffTimer = null;
      this.handOffToLetter();
    }, HANDOFF_MS);
    this.stageTimer = setTimeout(() => this.finishOpening(true), OPENING_MS);
  }

  /** Lays the paper's letter copy out at the letter's real width (same as the article: min(100% - 32px, 560px)). */
  private measureReplica(): void {
    const dialog = this.dialogRef()?.nativeElement;
    const peek = this.peekRef()?.nativeElement;
    if (!dialog || !peek) return;
    const letterWidth = Math.min(dialog.clientWidth - 32, 560);
    const paperWidth = peek.getBoundingClientRect().width;
    this.replicaFrame.set(letterWidth > 0 && paperWidth > 0 ? { width: letterWidth, scale: paperWidth / letterWidth } : null);
  }

  /**
   * FLIP: the real letter starts exactly over the paper sticking out of the envelope (clipped at the
   * envelope mouth, so nothing changes visually), then grows into place while the envelope drops away.
   */
  private handOffToLetter(): void {
    const letter = this.letterRef()?.nativeElement;
    const peek = this.peekRef()?.nativeElement;
    const back = this.envelopeBackRef()?.nativeElement;
    if (!letter) return;
    const to = letter.getBoundingClientRect();
    const from = peek?.getBoundingClientRect();
    if (!from || !back || !from.width || !to.width || !to.height) {
      this.animateLetter([{ opacity: 0, transform: 'translateY(16px) scale(0.97)' }, { opacity: 1, transform: 'none' }], 600, 'both', EASE_OUT);
      return;
    }
    const scale = from.width / to.width;
    const shownHeight = Math.max(0, back.getBoundingClientRect().top - from.top) / scale;
    const clipBottom = Math.max(0, to.height - shownHeight);
    const spread = -96; // never clip the paper's own shadow on the other sides
    this.animateLetter([
      {
        transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${scale})`,
        clipPath: `inset(${spread}px ${spread}px ${clipBottom}px ${spread}px)`
      },
      { transform: 'none', clipPath: `inset(${spread}px)` }
    ], LETTER_FLIGHT_MS, 'both', EASE_FLIGHT);
    // Quick dissolve over the identical-looking paper while the flight is still slow.
    this.letterAnimations.push(letter.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, fill: 'both' }));
  }

  private finishOpening(moveFocus: boolean): void {
    this.clearTimer('stage');
    this.clearTimer('handoff');
    this.stage.set('open');
    if (!this.isBrowser) return;
    afterNextRender(() => {
      // The stage styles now match the flight's end state, so the filled animations can go.
      this.cancelLetterAnimations();
      if (!moveFocus) return;
      // The envelope button is gone; keep keyboard and screen-reader users on the letter.
      const dialog = this.dialogRef()?.nativeElement;
      const active = document.activeElement;
      const focusInside = !!dialog && active instanceof HTMLElement && active !== dialog && dialog.contains(active);
      if (!focusInside) this.letterRef()?.nativeElement.focus({ preventScroll: true });
    }, { injector: this.injector });
  }

  private animateLetter(keyframes: Keyframe[], duration: number, fill: FillMode, easing: string): void {
    const letter = this.letterRef()?.nativeElement;
    if (!letter || typeof letter.animate !== 'function') return;
    this.cancelLetterAnimations();
    this.letterAnimations.push(letter.animate(keyframes, { duration, easing, fill }));
  }

  private cancelLetterAnimations(): void {
    this.letterAnimations.forEach(animation => animation.cancel());
    this.letterAnimations = [];
  }

  // ----------------------------------------------------------------- reply

  protected selectAnswer(answer: ReplyAnswer): void {
    this.replyAnswer.set(answer);
  }

  protected onNameInput(event: Event): void {
    this.nameEdited = true;
    this.replyName.set((event.target as HTMLInputElement).value);
  }

  protected onMessageInput(event: Event): void {
    this.replyMessage.set((event.target as HTMLTextAreaElement).value);
  }

  protected submitReply(event: Event): void {
    event.preventDefault();
    if (this.sending()) return;

    this.attempted.set(true);
    const invalid = this.answerMissing()
      ? this.answerButtonRefs()[0]
      : this.nameMissing()
        ? this.nameInputRef()
        : this.messageMissing()
          ? this.messageInputRef()
          : null;
    if (invalid) {
      invalid.nativeElement.focus();
      return;
    }

    const answer = this.hasQuestion() ? this.replyAnswer() : null;
    const reply: SentReply = {
      name: this.replyName().trim(),
      answer,
      message: this.replyMessage().trim(),
      at: new Date().toISOString()
    };
    const id = this.invitationId()?.trim() ?? '';

    if (this.isPreview() || isWomenDayPreviewId(id)) {
      this.completeReply(reply, true);
      this.toast.showInfo('Đây là bản xem trước — hồi âm chưa được gửi.');
      return;
    }

    const isConfirm = answer ? answer === 'yes' : true;
    this.sending.set(true);
    this.api.confirm({ slugOrId: id, user: reply.name, letter: reply.message, isConfirm })
      .pipe(timeout(REQUEST_TIMEOUT_MS), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.sending.set(false);
          if (!res?.success) {
            this.toast.showError(res?.message || FAILURE_MESSAGE);
            return;
          }
          StorageUtil.setItem(STORAGE_PREFIX + id, JSON.stringify(reply));
          this.localReplies.update(list => [
            { user: reply.name, letter: reply.message, isConfirm, timestamp: reply.at },
            ...list
          ]);
          this.completeReply(reply, false);
          this.toast.showSuccess(`Đã gửi hồi âm cho ${this.senderLabel()} 💌`);
        },
        error: (error: unknown) => {
          this.sending.set(false);
          this.toast.showError(readErrorMessage(error) || FAILURE_MESSAGE);
        }
      });
  }

  protected writeAnother(): void {
    const sent = this.sentReply();
    if (!this.replyAnswer() && sent?.answer) this.replyAnswer.set(sent.answer);
    if (!this.replyName().trim() && sent?.name) this.replyName.set(sent.name);
    this.attempted.set(false);
    this.replyMode.set('form');
    this.focusAfterRender(() => this.messageInputRef()?.nativeElement);
  }

  private completeReply(reply: SentReply, preview: boolean): void {
    this.sentReply.set(reply);
    this.sentIsPreview.set(preview);
    this.replyMode.set('sent');
    this.replyMessage.set('');
    this.attempted.set(false);
    this.focusAfterRender(() => this.thanksRef()?.nativeElement);
  }

  private restoreSentReply(id: string | null): void {
    if (isWomenDayPreviewId(id)) return;
    const stored = parseStoredReply(StorageUtil.getItem(STORAGE_PREFIX + id));
    if (!stored) return;
    this.sentReply.set(stored);
    this.sentIsPreview.set(false);
    this.replyMode.set('sent');
    if (stored.name && !this.nameEdited) {
      this.nameEdited = true;
      this.replyName.set(stored.name.slice(0, WOMEN_DAY_LIMITS.replyNameLength));
    }
  }

  /** Phones: once the on-screen keyboard is up, scroll the letter (not the page) so the field stays visible. */
  protected revealField(event: FocusEvent): void {
    if (!this.isBrowser || !window.matchMedia?.('(pointer: coarse)').matches) return;
    const field = event.target as HTMLElement;
    this.clearTimer('reveal');
    this.revealTimer = setTimeout(() => {
      this.revealTimer = null;
      const paper = this.paperRef()?.nativeElement;
      if (!paper || !field.isConnected || document.activeElement !== field) return;
      const viewport = window.visualViewport;
      const paperRect = paper.getBoundingClientRect();
      const top = Math.max(paperRect.top, viewport?.offsetTop ?? 0) + 16;
      const bottom = Math.min(paperRect.bottom, viewport ? viewport.offsetTop + viewport.height : window.innerHeight) - 16;
      const rect = field.getBoundingClientRect();
      if (rect.bottom > bottom) paper.scrollTop += Math.min(rect.bottom - bottom, rect.top - top);
      else if (rect.top < top) paper.scrollTop -= top - rect.top;
    }, 320);
  }

  // --------------------------------------------------------------- helpers

  private focusAfterRender(target: () => HTMLElement | null | undefined): void {
    if (!this.isBrowser) return;
    afterNextRender(() => target()?.focus({ preventScroll: true }), { injector: this.injector });
  }

  private clearTimer(name: 'stage' | 'handoff' | 'leave' | 'reveal'): void {
    const key = `${name}Timer` as const;
    const timer = this[key];
    if (timer) clearTimeout(timer);
    this[key] = null;
  }
}

function createIds(instance: number) {
  const prefix = `wdl${instance}`;
  return {
    title: `${prefix}-title`,
    hint: `${prefix}-hint`,
    greeting: `${prefix}-greeting`,
    replyTitle: `${prefix}-reply-title`,
    question: `${prefix}-question`,
    answerError: `${prefix}-answer-error`,
    name: `${prefix}-name`,
    nameError: `${prefix}-name-error`,
    message: `${prefix}-message`,
    messageHint: `${prefix}-message-hint`,
    messageError: `${prefix}-message-error`,
    repliesTitle: `${prefix}-replies-title`,
    ...defMap(name => `${prefix}-${name}`)
  };
}

function defMap(format: (name: DefName) => string): Readonly<Record<DefName, string>> {
  return Object.fromEntries(DEF_NAMES.map(name => [name, format(name)])) as Record<DefName, string>;
}

function isBackdrop(target: EventTarget | null): boolean {
  return target instanceof Element && target.hasAttribute('data-wd-backdrop');
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Server timestamps are UTC; values without a zone designator are read as UTC. */
function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const text = String(value).trim().replace(/(\.\d{3})\d+/, '$1');
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/.test(text) ? `${text}Z` : text;
  const time = Date.parse(normalized);
  return Number.isFinite(time) ? time : null;
}

function formatRelativeTime(time: number, now: number): string {
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const diff = Math.max(0, now - time);
  if (diff < minute) return 'Vừa xong';
  if (diff < hour) return `${Math.floor(diff / minute)} phút trước`;
  if (diff < day) return `${Math.floor(diff / hour)} giờ trước`;
  if (diff < 2 * day) return 'Hôm qua';
  if (diff < 7 * day) return `${Math.floor(diff / day)} ngày trước`;
  const date = new Date(time);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function isSameReply(server: Confirm, local: Confirm): boolean {
  const serverTime = parseTimestamp(server.timestamp);
  const localTime = parseTimestamp(local.timestamp);
  return (server.user ?? '').trim() === local.user
    && (server.letter ?? '').trim() === local.letter
    && serverTime !== null && localTime !== null
    && Math.abs(serverTime - localTime) < 10 * 60_000;
}

/** Reads this component's stored reply; also accepts the RSVPResponse shape other styles store under the same key. */
function parseStoredReply(raw: string | null): SentReply | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Record<string, unknown> | null;
    if (!data || typeof data !== 'object') return null;
    const text = (value: unknown) => (typeof value === 'string' ? value : '');
    const answer = data['answer'] === 'yes' || data['answer'] === 'no'
      ? data['answer']
      : typeof data['isAttending'] === 'boolean'
        ? (data['isAttending'] ? 'yes' : 'no')
        : null;
    return {
      name: text(data['name']) || text(data['guestName']),
      answer,
      message: text(data['message']) || text(data['wish']),
      at: text(data['at']) || text(data['timestamp'])
    };
  } catch {
    return null;
  }
}

function readErrorMessage(error: unknown): string {
  const body = (error as { error?: unknown } | null)?.error;
  const message = body && typeof body === 'object' ? (body as { message?: unknown }).message : null;
  return typeof message === 'string' ? message.trim() : '';
}
