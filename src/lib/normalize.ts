/** Normalisation used for duplicate detection and search. */

const ARABIC_DIACRITICS = /[\u064B-\u065F\u0670\u0640]/g; // tashkeel + tatweel
const EASTERN_DIGITS: Record<string, string> = {
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
  "۰": "0",
  "۱": "1",
  "۲": "2",
  "۳": "3",
  "۴": "4",
  "۵": "5",
  "۶": "6",
  "۷": "7",
  "۸": "8",
  "۹": "9",
};

export function toWesternDigits(s: string): string {
  return s.replace(/[٠-٩۰-۹]/g, (d) => EASTERN_DIGITS[d] ?? d);
}

export function normalizeName(s: string): string {
  return toWesternDigits(s)
    .normalize("NFKC")
    .replace(ARABIC_DIACRITICS, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Returns digits with an optional leading "+", or null if it cannot be a phone number. */
export function normalizePhone(s: string | null | undefined): string | null {
  if (!s) return null;
  let v = toWesternDigits(s).replace(/[\s\-().]/g, "");
  if (v.startsWith("00")) v = "+" + v.slice(2);
  if (!/^\+?\d{6,15}$/.test(v)) return null;
  return v;
}

export function normalizeEmail(s: string | null | undefined): string | null {
  if (!s) return null;
  const v = s.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null;
}
