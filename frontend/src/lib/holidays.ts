/** 2026년 대한민국 공휴일 (법정공휴일 + 대체공휴일) */
const HOLIDAYS_2026: string[] = [
  '2026-01-01', // 신정
  '2026-01-28', // 설날 전날 (수)
  '2026-01-29', // 설날 (목)
  '2026-01-30', // 설날 다음날 (금)
  '2026-03-01', // 삼일절
  '2026-03-02', // 삼일절 대체공휴일
  '2026-05-05', // 어린이날
  '2026-05-24', // 부처님오신날
  '2026-05-25', // 부처님오신날 대체공휴일
  '2026-06-06', // 현충일
  '2026-08-15', // 광복절
  '2026-08-17', // 광복절 대체공휴일
  '2026-09-24', // 추석 전날
  '2026-09-25', // 추석
  '2026-09-26', // 추석 다음날
  '2026-10-03', // 개천절
  '2026-10-05', // 개천절 대체공휴일
  '2026-10-09', // 한글날
  '2026-12-25', // 크리스마스
];

const holidaySet = new Set(HOLIDAYS_2026);

export function isHoliday(dateStr: string): boolean {
  return holidaySet.has(dateStr);
}

/** 주말 또는 공휴일이면 true (is_red) */
export function isRedDay(date: Date): boolean {
  const dow = date.getDay(); // 0=Sun, 6=Sat
  if (dow === 0 || dow === 6) return true;
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return isHoliday(`${yyyy}-${mm}-${dd}`);
}
