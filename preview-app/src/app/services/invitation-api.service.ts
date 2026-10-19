import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';

/** Payload sent when a guest submits an RSVP from the letter. */
export interface ConfirmPayload {
  slugOrId: string;
  user: string;
  letter: string;
  isConfirm: boolean;
}

/** Shape the letter component expects back from a confirm call. */
export interface ConfirmResponse {
  success: boolean;
  message?: string;
}

/**
 * Preview stub for the real invitation API. The letter component pipes this through `timeout(...)` and
 * reads `res.success` / `res.message`, so the stub returns a success-shaped payload after a short delay.
 */
@Injectable({ providedIn: 'root' })
export class InvitationApiService {
  confirm(payload: ConfirmPayload): Observable<ConfirmResponse> {
    console.log('[InvitationApiService] confirm (stub)', payload);
    return of<ConfirmResponse>({ success: true, message: 'Đã nhận hồi âm.' }).pipe(delay(600));
  }
}
