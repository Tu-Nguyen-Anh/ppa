import { Injectable } from '@angular/core';

/**
 * Preview stub for the app's toast/notification service. The letter component calls `showInfo`,
 * `showSuccess` and `showError`; here they just log so the flow can be exercised without any UI.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  showSuccess(message: string): void {
    console.log('[toast:success]', message);
  }

  showError(message: string): void {
    console.log('[toast:error]', message);
  }

  showInfo(message: string): void {
    console.log('[toast:info]', message);
  }

  show(message: string): void {
    console.log('[toast]', message);
  }
}
