import type { PredictionData, Route } from './types';

const cache: Record<string, PredictionData> = {};

async function loadPredictions(route: Route): Promise<PredictionData> {
  if (cache[route]) return cache[route];
  const base = import.meta.env.BASE_URL;
  const res = await fetch(`${base}data/pred_table_${route}.csv`);
  const text = await res.text();

  // CSV 형식: 정류장순번,dow,hour,pred
  const data: PredictionData = {};
  const lines = text.trim().split('\n').slice(1); // 헤더 제외
  for (const line of lines) {
    const [stopStr, dowStr, hourStr, predStr] = line.split(',');
    const stopId = stopStr.trim();
    const hour = hourStr.trim();
    const dow = dowStr.trim();
    const pred = parseFloat(predStr.trim());
    if (!data[stopId]) data[stopId] = {};
    if (!data[stopId][hour]) data[stopId][hour] = {};
    data[stopId][hour][dow] = pred;
  }

  cache[route] = data;
  return data;
}

function lookupHourly(data: PredictionData, stopId: number, hour: number, dow: number): number {
  const stopData = data[String(stopId)];
  if (!stopData) return 0;

  // Wrap hour to 0-23
  const h = ((hour % 24) + 24) % 24;
  const hourData = stopData[String(h)];
  if (!hourData) return 0;

  const val = hourData[String(dow)];
  if (val !== undefined) return val;

  // Fallback: average across all dow for this stop+hour
  const vals = Object.values(hourData);
  return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

/**
 * Center-point interpolation.
 * 모델 예측값은 매 시 30분(center)에 대응.
 * minute < 30: (H-1):30 ~ H:30 사이 보간
 * minute >= 30: H:30 ~ (H+1):30 사이 보간
 */
export async function calculateCongestion(
  stopId: number,
  targetTime: Date,
  route: Route,
): Promise<number> {
  const data = await loadPredictions(route);
  const hour = targetTime.getHours();
  const minute = targetTime.getMinutes();
  // JS getDay(): 0=Sun → Python weekday: Mon=0
  const jsDay = targetTime.getDay();
  const dow = jsDay === 0 ? 6 : jsDay - 1;

  if (minute < 30) {
    const pPrev = lookupHourly(data, stopId, hour - 1, dow);
    const pCurr = lookupHourly(data, stopId, hour, dow);
    const weight = (minute + 30) / 60;
    return Math.max(0, pPrev + (pCurr - pPrev) * weight);
  } else {
    const pCurr = lookupHourly(data, stopId, hour, dow);
    const pNext = lookupHourly(data, stopId, hour + 1, dow);
    const weight = (minute - 30) / 60;
    return Math.max(0, pCurr + (pNext - pCurr) * weight);
  }
}

/** 추천 출발 시간 탐색: 현재~60분 뒤까지 10분 간격으로 최소 혼잡도 시점 */
export async function findBestDepartureTime(
  stopId: number,
  baseTime: Date,
  route: Route,
): Promise<{ offsetMinutes: number; prediction: number } | null> {
  const basePred = await calculateCongestion(stopId, baseTime, route);
  let bestOffset = 0;
  let bestPred = basePred;

  for (let offset = 10; offset <= 60; offset += 10) {
    const t = new Date(baseTime.getTime() + offset * 60_000);
    const pred = await calculateCongestion(stopId, t, route);
    if (pred < bestPred) {
      bestPred = pred;
      bestOffset = offset;
    }
  }

  if (bestOffset === 0) return null;
  const improvement = basePred - bestPred;
  if (improvement < 1) return null;

  return { offsetMinutes: bestOffset, prediction: Math.round(bestPred * 10) / 10 };
}
