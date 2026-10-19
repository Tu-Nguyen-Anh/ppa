/**
 * Content helpers for the 20/10 "Women's Day" bouquet card. These derive the envelope copy, the photos,
 * the falling sky wishes and the letter body from a {@link Thiep}. The real app parses a richer payload;
 * this stub keeps the same public surface and ships populated Vietnamese defaults so the card renders fully.
 */
import { Thiep } from './thiep.model';

const ASSET_DIR = '/images/women-day/bouquet/';

/** The three lines printed on the envelope (flap top line, big headline, pocket bottom line). */
export interface WomenDayEnvelope {
  topLine: string;
  headline: string;
  bottomLine: string;
}

/** Parsed view of {@link Thiep.description} consumed by the bouquet component and the sky scene. */
export interface WomenDayContent {
  /** Full letter body (greeting + paragraphs), later split by {@link splitWomenDayLetter}. */
  letter: string;
  /** Optional RSVP question; empty string means "no question, ask for a message instead". */
  rsvpQuestion: string;
  /** Short wishes that fall through the starry sky. */
  wishes: string[];
}

/** The letter body split into a greeting line and its paragraphs. */
export interface WomenDayLetter {
  greeting: string;
  paragraphs: string[];
}

/** Photos split by where they appear in the experience. */
export interface WomenDayPhotos {
  /** Up to six cards blooming out of the bouquet roses. */
  bouquet: string[];
  /** Up to ten photos falling through the sky. */
  sky: string[];
  /** A single keepsake photo shown inside the letter (or null). */
  letter: string | null;
}

/** Character limits for the reply form. */
export const WOMEN_DAY_LIMITS = {
  replyNameLength: 60,
  replyMessageLength: 500
} as const;

/** Labels for the two RSVP answers. */
export const WOMEN_DAY_RSVP_ANSWERS: { readonly yes: string; readonly no: string } = {
  yes: 'Có, nhất định rồi',
  no: 'Xin lỗi, lần này mình bận'
};

/** Short wishes shown when the card has none of its own. */
export const WOMEN_DAY_DEFAULT_WISHES: string[] = [
  'Chúc mừng ngày Phụ nữ Việt Nam 20/10',
  'Luôn xinh đẹp và rạng rỡ',
  'Mãi dịu dàng và hạnh phúc',
  'Bình an trong từng khoảnh khắc',
  'Nụ cười luôn nở trên môi',
  'Được yêu thương thật nhiều',
  'Mọi điều ước đều thành hiện thực',
  'Sức khỏe dồi dào mỗi ngày',
  'Thành công và an nhiên',
  'Tỏa sáng theo cách của riêng mình'
];

const DEFAULT_ENVELOPE: WomenDayEnvelope = {
  topLine: 'Thân gửi người phụ nữ tuyệt vời',
  headline: 'Mừng ngày 20/10',
  bottomLine: 'Gửi trọn yêu thương'
};

const DEFAULT_LETTER = [
  'Gửi Phương Anh,',
  '',
  'Nhân ngày 20/10, tớ chúc Phương Anh thật nhiều sức khỏe, lúc nào cũng xinh xắn, rạng rỡ và vui vẻ nhé.',
  '',
  'Mong những điều dễ thương nhất sẽ luôn đến với Phương Anh. Chúc những điều tốt đẹp nhất sẽ đến với cậu.'
].join('\n');

/** Photo paths that make the demo card look populated when a Thiep provides none. */
const SAMPLE_PHOTOS: string[] = [
  `${ASSET_DIR}rose-pink-a.webp`,
  `${ASSET_DIR}rose-cream-a.webp`,
  `${ASSET_DIR}rose-pink-c.webp`,
  `${ASSET_DIR}rose-cream-b.webp`,
  `${ASSET_DIR}rose-pink-d.webp`,
  `${ASSET_DIR}rose-pink-b.webp`
];

const MAX_BOUQUET_PHOTOS = 6;
const MAX_SKY_PHOTOS = 10;
const MAX_SKY_WISHES = 24;

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
}

/**
 * Parses {@link Thiep.description}. Accepts either a small JSON object
 * `{ letter, wishes, rsvpQuestion }` or plain letter text. Always returns a fully-populated content object
 * (falling back to the Vietnamese defaults) so the card never looks empty.
 */
export function parseWomenDayContent(description?: string | null): WomenDayContent {
  const raw = (description ?? '').trim();

  let letter = '';
  let rsvpQuestion = '';
  let wishes: string[] = [];

  if (raw.startsWith('{')) {
    try {
      const data = JSON.parse(raw) as Record<string, unknown>;
      if (data && typeof data === 'object') {
        if (typeof data['letter'] === 'string') letter = data['letter'].trim();
        if (typeof data['rsvpQuestion'] === 'string') rsvpQuestion = data['rsvpQuestion'].trim();
        wishes = toStringArray(data['wishes']);
      }
    } catch {
      // Not JSON after all: treat the whole thing as the letter body.
      letter = raw;
    }
  } else if (raw) {
    letter = raw;
  }

  return {
    letter: letter || DEFAULT_LETTER,
    rsvpQuestion: rsvpQuestion || 'Bạn có thể ghé chung vui cùng chúng mình không?',
    wishes: wishes.length ? wishes : [...WOMEN_DAY_DEFAULT_WISHES]
  };
}

/** The wishes that fall through the sky, de-duplicated and capped. */
export function getWomenDaySkyWishes(content: WomenDayContent): string[] {
  const source = content.wishes.length ? content.wishes : WOMEN_DAY_DEFAULT_WISHES;
  const seen = new Set<string>();
  const result: string[] = [];
  for (const wish of source) {
    const text = (wish ?? '').replace(/\s+/g, ' ').trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= MAX_SKY_WISHES) break;
  }
  return result.length ? result : [...WOMEN_DAY_DEFAULT_WISHES];
}

/** Builds the envelope copy. Uses the receiver's name in the top line when available. */
export function getWomenDayEnvelope(data: Thiep | null): WomenDayEnvelope {
  const receiver = data?.receiverName?.trim();
  return {
    topLine: receiver ? `Thân gửi ${receiver}` : DEFAULT_ENVELOPE.topLine,
    headline: DEFAULT_ENVELOPE.headline,
    bottomLine: DEFAULT_ENVELOPE.bottomLine
  };
}

/** Splits the card's photos across the bouquet, the sky and the letter. */
export function getWomenDayPhotos(data: Thiep | null): WomenDayPhotos {
  const photos = toStringArray(data?.photos);
  const list = photos.length ? photos : SAMPLE_PHOTOS;
  return {
    bouquet: list.slice(0, MAX_BOUQUET_PHOTOS),
    sky: list.slice(0, MAX_SKY_PHOTOS),
    letter: list[0] ?? null
  };
}

/**
 * Splits the letter body into a greeting line and its paragraphs. A leading line that opens with a
 * salutation ("Gửi", "Thân gửi", "Thương gửi") becomes the greeting; the rest are blank-line-separated
 * paragraphs. When there is no explicit greeting, `greeting` is '' and the component supplies a default.
 */
export function splitWomenDayLetter(letterText: string): WomenDayLetter {
  const normalized = (letterText ?? '').replace(/\r\n/g, '\n').trim();
  if (!normalized) return { greeting: '', paragraphs: [] };

  const blocks = normalized
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean);
  if (!blocks.length) return { greeting: '', paragraphs: [] };

  const greetingPattern = /^(thân gửi|thương gửi|gửi|kính gửi)\b/i;
  let greeting = '';
  let paragraphs = blocks;

  const firstLines = blocks[0].split('\n').map(line => line.trim());
  if (greetingPattern.test(firstLines[0]) && firstLines[0].length <= 80) {
    greeting = firstLines[0];
    const rest = firstLines.slice(1).join('\n').trim();
    paragraphs = rest ? [rest, ...blocks.slice(1)] : blocks.slice(1);
  }

  return { greeting, paragraphs };
}

/** Preview ids used by the create page so a demo RSVP is never actually submitted. */
export function isWomenDayPreviewId(id: string | null | undefined): boolean {
  const value = (id ?? '').trim().toLowerCase();
  if (!value) return true;
  return value === 'preview' || value.startsWith('preview') || value.startsWith('demo');
}
