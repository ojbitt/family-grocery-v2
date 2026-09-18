/** Lowercase and strip diacritics, so "cekla" matches "Cékla", "muzli" → "Müzli". */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}
