/**
 * Small localStorage helper used with static methods by the letter component
 * (`StorageUtil.getItem` / `StorageUtil.setItem`). Guarded so it is safe during SSR / prerender where
 * `localStorage` is undefined, and tolerant of private-mode quota errors.
 */
export class StorageUtil {
  private static get store(): Storage | null {
    try {
      return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch {
      return null;
    }
  }

  static getItem(key: string): string | null {
    try {
      return StorageUtil.store?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  static setItem(key: string, value: string): void {
    try {
      StorageUtil.store?.setItem(key, value);
    } catch {
      // Storage unavailable or full (private mode): ignore.
    }
  }

  static removeItem(key: string): void {
    try {
      StorageUtil.store?.removeItem(key);
    } catch {
      // Ignore.
    }
  }
}
