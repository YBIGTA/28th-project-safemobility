import type { PredictionResult } from '../lib/types';
import CongestionGauge from './CongestionGauge';
import { getCongestionColor, getCongestionPercent } from '../lib/congestion';

interface Props {
  result: PredictionResult;
  travelTip: { offsetMinutes: number; prediction: number } | null;
}

export default function ResultSection({ result, travelTip }: Props) {
  const color = getCongestionColor(result.level);
  const percent = getCongestionPercent(result.prediction);

  return (
    <div className="space-y-4">
      {/* 카드 1: 혼잡도 요약 - 텍스트 왼쪽 + 게이지 오른쪽 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-semibold text-slate-700 leading-snug">
            {result.message}
          </p>
          <CongestionGauge prediction={result.prediction} size={120} />
        </div>
      </div>

      {/* 카드 2+3: 좌우 2열 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 왼쪽: 착석 확률 + 추천 이동 코스 */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          {/* 착석 확률 */}
          <div className="p-4 flex items-center gap-3 flex-1">
            <div className="flex-1">
              <p className="text-sm text-slate-500 leading-tight">바로 출발할 경우</p>
              <p className="text-sm text-slate-500 leading-tight">앉아서 이동할 확률</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1 h-10 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-2xl font-extrabold" style={{ color }}>
                {result.seatingPercent}%
              </span>
            </div>
            <SeatIcon className="w-7 h-7 text-slate-400 shrink-0" />
          </div>

          {/* 추천 이동 코스 */}
          <div className="border-t border-slate-100">
            <div className="p-4">
              <p className="text-xs font-bold text-slate-500 mb-2">추천 이동 코스</p>
              {travelTip ? (
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-sm text-slate-700">
                    <span className="font-bold text-red-500">{travelTip.offsetMinutes}분</span> 뒤 출발하시면
                  </p>
                  <p className="text-sm text-slate-700">
                    출발하시면 평균 혼잡도가{' '}
                    <span className="font-bold">
                      {Math.round(((result.prediction - travelTip.prediction) / result.prediction) * 100)}%
                    </span>{' '}
                    낮아집니다!
                  </p>
                </div>
              ) : (
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-sm text-slate-600">지금이 가장 여유로운 시간이에요!</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 오른쪽: 교통약자 맞춤 정보 */}
        <div className="bg-green-50 rounded-2xl border border-green-200 shadow-sm overflow-hidden">
          <div className="p-4 space-y-3">
            <p className="text-sm font-bold text-slate-700">교통약자 맞춤 정보</p>

            {/* 배려석 */}
            <div className="bg-white rounded-xl p-3 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-green-700">배려석</p>
                <p className="text-xs text-slate-500">예상 점유율</p>
              </div>
              <MiniGauge percent={percent} color={color} />
              <SeatIcon className="w-6 h-6 text-slate-400 shrink-0" />
            </div>

            {/* 휠체어석 */}
            <div className="bg-white rounded-xl p-3 flex items-center gap-2">
              <div className="shrink-0">
                <p className="text-sm font-semibold text-green-700">휠체어석</p>
                <p className="text-xs text-slate-500">예상 점유율</p>
              </div>
              <p className={`text-xs leading-snug ml-auto text-right ${result.wheelchairAccessible ? 'text-green-600' : 'text-red-500'}`}>
                {result.wheelchairAccessible
                  ? '탑승 가능합니다'
                  : '버스 내부가 혼잡하여\n탑승이 어려울 확률이 높습니다.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* 미니 반원 게이지 */
function MiniGauge({ percent, color }: { percent: number; color: string }) {
  const r = 18;
  const cx = 26;
  const cy = 24;
  const sweep = (Math.min(percent, 100) / 100) * 180;
  const bgPath = arcPath(cx, cy, r, -180, 0);
  const valPath = sweep > 0 ? arcPath(cx, cy, r, -180, -180 + sweep) : '';

  return (
    <div className="flex flex-col items-center shrink-0">
      <svg width="52" height="30" viewBox="0 0 52 30">
        <path d={bgPath} fill="none" stroke="#e2e8f0" strokeWidth="5" strokeLinecap="round" />
        {valPath && <path d={valPath} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" />}
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize="9" fontWeight="700" fill={color}>
          {percent}%
        </text>
      </svg>
      <span className="text-[9px] font-semibold leading-none" style={{ color }}>
        {percent <= 40 ? '여유' : percent <= 70 ? '보통' : '혼잡'}
      </span>
    </div>
  );
}

function SeatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M7 18v-2a4 4 0 014-4h2a4 4 0 014 4v2" />
      <circle cx="12" cy="7" r="3" />
      <rect x="6" y="18" width="12" height="3" rx="1.5" />
    </svg>
  );
}

function polarToCart(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, s: number, e: number) {
  const start = polarToCart(cx, cy, r, s);
  const end = polarToCart(cx, cy, r, e);
  const large = Math.abs(e - s) > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`;
}
