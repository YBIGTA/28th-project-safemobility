import { getCongestionColor, getCongestionLevel, getCongestionPercent } from '../lib/congestion';

interface Props {
  prediction: number;
  size?: number;
}

export default function CongestionGauge({ prediction, size = 180 }: Props) {
  const level = getCongestionLevel(prediction);
  const color = getCongestionColor(level);
  const percent = getCongestionPercent(prediction);

  const ratio = Math.min(percent / 100, 1);
  const sweepAngle = Math.max(ratio * 180, 0);

  // 고정 좌표계로 계산 (viewBox 기준)
  const sw = 14; // strokeWidth
  const pad = sw / 2 + 2; // stroke가 잘리지 않도록 패딩
  const r = 50 - pad; // 반지름
  const cx = 50;
  const cy = 50;

  const bgPath = describeArc(cx, cy, r, -180, 0);
  const valuePath = sweepAngle > 1 ? describeArc(cx, cy, r, -180, -180 + sweepAngle) : '';

  // viewBox: 위쪽 반원 + 아래 텍스트 공간
  const vbW = 100;
  const vbH = 62;

  // 실제 렌더링 크기
  const renderW = size;
  const renderH = size * (vbH / vbW);

  return (
    <div className="flex flex-col items-center shrink-0">
      <svg width={renderW} height={renderH} viewBox={`0 0 ${vbW} ${vbH}`}>
        {/* 배경 호 */}
        <path d={bgPath} fill="none" stroke="#e2e8f0" strokeWidth={sw} strokeLinecap="round" />
        {/* 값 호 */}
        {valuePath && (
          <path d={valuePath} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        )}
        {/* 퍼센트 텍스트 */}
        <text x={cx} y={cy + 2} textAnchor="middle" fontSize="16" fontWeight="800" fill={color}>
          {percent}%
        </text>
      </svg>
    </div>
  );
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polarToCartesian(cx, cy, r, startDeg);
  const end = polarToCartesian(cx, cy, r, endDeg);
  const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}
