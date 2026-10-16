const FONT_KEY = 'wechurch-devotion-font-size';
// The existing daily devotional reader owns the same browser preference.
export function groupReadingFontSize() {
  try {
    const value = Number(localStorage.getItem(FONT_KEY));
    return Number.isInteger(value) && value >= 16 && value <= 26 ? value : 20;
  } catch { return 20; }
}
export function saveGroupReadingFontSize(value: number) {
  try { localStorage.setItem(FONT_KEY, String(value)); } catch { /* Reading works without storage. */ }
}
