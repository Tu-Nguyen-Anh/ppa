/**
 * Minimal stand-ins for the real invitation model, derived from how the 20/10 "Women's Day" bouquet
 * and letter components read these shapes. Only the fields the components touch are modelled; everything
 * is optional so partially-filled sample data still type-checks.
 */

/** A single guest reply shown under the letter and created locally after a successful RSVP. */
export interface Confirm {
  /** Guest display name (letter component reads `reply.user`). */
  user?: string;
  /** The guest's written message / wish (letter component reads `reply.letter`). */
  letter?: string;
  /** Whether the guest answered "yes" to the RSVP question. */
  isConfirm?: boolean;
  /** ISO-ish timestamp string; parsed as UTC when no zone is given. */
  timestamp?: string;

  // Tolerated aliases that other card styles may store under the same key (not required by this card).
  name?: string;
  guestName?: string;
  message?: string;
}

/** The invitation / greeting-card payload fed to the bouquet component via its `invitationData` input. */
export interface Thiep {
  /** Identifier (preview ids are detected by `isWomenDayPreviewId`). */
  id?: string | null;
  /** Person sending the card. */
  senderName?: string;
  /** Person the card is addressed to. */
  receiverName?: string;
  /**
   * Free-form content blob parsed by `parseWomenDayContent` into letter text, sky wishes and the RSVP
   * question. May be plain letter text or a small JSON object `{ letter, wishes, rsvpQuestion }`.
   */
  description?: string | null;
  /** Photo URLs/paths. `getWomenDayPhotos` splits these across the bouquet, sky and letter. */
  photos?: string[];
  /** Whether received replies are listed under the letter. */
  isShowConfirm?: boolean;
  /** Replies received so far. */
  confirms?: Confirm[];
}
