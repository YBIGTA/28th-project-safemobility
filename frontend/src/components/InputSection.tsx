import { useState, useEffect } from 'react';
import type { Stop, Route } from '../lib/types';

interface Props {
  onSubmit: (params: {
    route: Route;
    stopId: number;
    stopName: string;
    destStopId: number | null;
    destStopName: string | null;
    date: string;
    time: string;
  }) => void;
  loading: boolean;
}

const stopsCache: Record<string, Stop[]> = {};

async function loadStops(route: Route): Promise<Stop[]> {
  if (stopsCache[route]) return stopsCache[route];
  const base = import.meta.env.BASE_URL;
  const res = await fetch(`${base}data/stops_${route}.json`);
  const data: Stop[] = await res.json();
  stopsCache[route] = data;
  return data;
}

export default function InputSection({ onSubmit, loading }: Props) {
  const [route, setRoute] = useState<Route>('606');
  const [stops, setStops] = useState<Stop[]>([]);
  const [stopId, setStopId] = useState<number>(0);
  const [destStopId, setDestStopId] = useState<number>(0);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  const today = new Date();
  const minDate = fmtDate(today);
  const maxDate = fmtDate(new Date(today.getTime() + 7 * 86400_000));

  useEffect(() => {
    const now = new Date();
    setDate(fmtDate(now));
    setTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
  }, []);

  useEffect(() => {
    loadStops(route).then((s) => {
      setStops(s);
      if (s.length > 0) {
        setStopId(s[0].id);
        setDestStopId(s[Math.min(5, s.length - 1)].id);
      }
    });
  }, [route]);

  const selectedStop = stops.find((s) => s.id === stopId);
  const destStops = selectedStop
    ? stops.filter((s) => s.direction === selectedStop.direction && s.id > stopId)
    : [];

  const upStops = stops.filter((s) => s.direction === '상행');
  const downStops = stops.filter((s) => s.direction === '하행');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStop) return;
    const dest = stops.find((s) => s.id === destStopId);
    onSubmit({
      route,
      stopId,
      stopName: selectedStop.name,
      destStopId: dest ? dest.id : null,
      destStopName: dest ? dest.name : null,
      date,
      time,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
      {/* 출발 일시 + 노선 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">출발 일시</label>
          <div className="flex gap-2">
            <input
              type="date"
              value={date}
              min={minDate}
              max={maxDate}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1 border border-slate-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-24 border border-slate-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <p className="text-[10px] text-slate-400">* 예측은 최대 일주일까지만 제공합니다.</p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">버스 노선 선택</label>
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            {(['420', '606'] as Route[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRoute(r)}
                className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${
                  route === r
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {r}번 버스
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 출발 / 도착 정류장 + 버튼 */}
      <div className="flex flex-col md:flex-row items-stretch md:items-end gap-2">
        <div className="flex-1">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">출발 정류장</label>
          <select
            value={stopId}
            onChange={(e) => {
              const newId = Number(e.target.value);
              setStopId(newId);
              const newStop = stops.find((s) => s.id === newId);
              if (newStop) {
                const nextStops = stops.filter((s) => s.direction === newStop.direction && s.id > newId);
                if (nextStops.length > 0) setDestStopId(nextStops[0].id);
              }
            }}
            className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {upStops.length > 0 && (
              <optgroup label="상행">
                {upStops.map((s) => <option key={s.id} value={s.id}>{s.id}. {s.name}</option>)}
              </optgroup>
            )}
            {downStops.length > 0 && (
              <optgroup label="하행">
                {downStops.map((s) => <option key={s.id} value={s.id}>{s.id}. {s.name}</option>)}
              </optgroup>
            )}
          </select>
        </div>

        <div className="text-slate-400 text-xl font-bold text-center md:pb-2">
          <span className="hidden md:inline">&rarr;</span>
          <span className="md:hidden">&darr;</span>
        </div>

        <div className="flex-1">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">도착 정류장</label>
          <select
            value={destStopId}
            onChange={(e) => setDestStopId(Number(e.target.value))}
            className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {destStops.map((s) => <option key={s.id} value={s.id}>{s.id}. {s.name}</option>)}
            {destStops.length === 0 && <option value={0}>-</option>}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading || !stopId}
          className="w-full md:w-auto whitespace-nowrap px-5 py-2.5 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white font-bold rounded-lg text-sm transition-colors"
        >
          {loading ? '분석 중...' : '혼잡도 확인'}
        </button>
      </div>
    </form>
  );
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
