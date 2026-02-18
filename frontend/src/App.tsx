import { useState } from 'react';
import InputSection from './components/InputSection';
import ResultSection from './components/ResultSection';
import { calculateCongestion, findBestDepartureTime } from './lib/predictor';
import { buildResult } from './lib/congestion';
import type { PredictionResult, Route } from './lib/types';

function App() {
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [travelTip, setTravelTip] = useState<{ offsetMinutes: number; prediction: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (params: {
    route: Route;
    stopId: number;
    stopName: string;
    destStopId: number | null;
    destStopName: string | null;
    date: string;
    time: string;
  }) => {
    setLoading(true);
    try {
      const [year, month, day] = params.date.split('-').map(Number);
      const [hour, minute] = params.time.split(':').map(Number);
      const targetTime = new Date(year, month - 1, day, hour, minute);

      const pred = await calculateCongestion(params.stopId, targetTime, params.route);
      setResult(buildResult(pred, params.stopName));

      const tip = await findBestDepartureTime(params.stopId, targetTime, params.route);
      setTravelTip(tip);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-6 px-4">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* 헤더 */}
        <header className="bg-slate-700 text-white rounded-2xl px-6 py-4">
          <h1 className="text-xl font-bold">미리버스</h1>
          <p className="text-sm text-slate-300 mt-0.5">버스 혼잡도, 미리 알고 타세요</p>
        </header>

        {/* 입력 */}
        <InputSection onSubmit={handleSubmit} loading={loading} />

        {/* 결과 */}
        {result && <ResultSection result={result} travelTip={travelTip} />}
      </div>
    </div>
  );
}

export default App;
