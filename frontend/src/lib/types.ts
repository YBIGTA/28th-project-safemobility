export interface Stop {
  id: number;
  name: string;
  direction: '상행' | '하행';
}

/** { [stopId]: { [hour]: { [dow]: prediction } } } */
export type PredictionData = Record<string, Record<string, Record<string, number>>>;

export type Route = '606' | '420';

export type CongestionLevel = '여유' | '보통' | '혼잡' | '매우혼잡';

export interface PredictionResult {
  prediction: number;
  level: CongestionLevel;
  message: string;
  seatingProbability: string;
  seatingPercent: number;
  wheelchairAccessible: boolean;
  stopName: string;
}
