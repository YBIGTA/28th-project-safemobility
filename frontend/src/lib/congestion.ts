import type { CongestionLevel, PredictionResult } from './types';

const BUS_CAPACITY = 50;

export function getCongestionLevel(pred: number): CongestionLevel {
  if (pred <= 20) return '여유';
  if (pred <= 35) return '보통';
  if (pred <= 45) return '혼잡';
  return '매우혼잡';
}

/** 혼잡도를 퍼센트(0~100)로 변환 (정원 50명 기준) */
export function getCongestionPercent(pred: number): number {
  return Math.min(Math.round((pred / BUS_CAPACITY) * 100), 100);
}

export function getCongestionMessage(level: CongestionLevel, stopName: string): string {
  switch (level) {
    case '여유': return `${stopName}은(는) 여유로워요!`;
    case '보통': return `${stopName}은(는) 조금 붐벼요`;
    case '혼잡': return `${stopName}은(는) 많이 붐벼요`;
    case '매우혼잡': return `${stopName}은(는) 광장히 혼잡할 확률이 높습니다!`;
  }
}

export function getSeatingInfo(pred: number): { text: string; percent: number } {
  if (pred <= 20) return { text: '앉아서 이동할 수 있어요', percent: 80 };
  if (pred <= 28) return { text: '운 좋으면 착석 가능', percent: 50 };
  if (pred <= 35) return { text: '서서 갈 확률이 높아요', percent: 20 };
  return { text: '착석이 어려워요', percent: 5 };
}

export function isWheelchairAccessible(pred: number): boolean {
  return pred < 35;
}

export function getCongestionColor(level: CongestionLevel): string {
  switch (level) {
    case '여유': return '#22c55e';
    case '보통': return '#eab308';
    case '혼잡': return '#f97316';
    case '매우혼잡': return '#ef4444';
  }
}

export function buildResult(pred: number, stopName: string): PredictionResult {
  const level = getCongestionLevel(pred);
  const seating = getSeatingInfo(pred);
  return {
    prediction: Math.round(pred * 10) / 10,
    level,
    message: getCongestionMessage(level, stopName),
    seatingProbability: seating.text,
    seatingPercent: seating.percent,
    wheelchairAccessible: isWheelchairAccessible(pred),
    stopName,
  };
}
