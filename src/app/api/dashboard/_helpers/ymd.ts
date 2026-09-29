// R158-4 (R159-b): 'YYYY-MM-DD' + n dni → 'YYYY-MM-DD'.
// Čisti koledarski add/sub po vzorcu ljubljanaYesterdayStr /
// briefing addDaysToYmd — DST-varno (brez start-24h), deluje na YMD
// stringih ljubljanskega poslovnega dne (P2-08 kanon).
export function addDaysToYmd(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}
