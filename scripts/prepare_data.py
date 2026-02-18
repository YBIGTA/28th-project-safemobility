"""
bus_standard_patterns_jan2026.csv + 정류장명 → frontend JSON 변환 스크립트

출력:
  frontend/public/data/predictions_606.json
  frontend/public/data/predictions_420.json
  frontend/public/data/stops_606.json
  frontend/public/data/stops_420.json

사용법:
  python scripts/prepare_data.py

NOTE: 현재는 CSV 패턴값을 그대로 예측값으로 사용.
      실제 모델 예측 CSV가 준비되면 pattern_csv 경로만 교체하면 됨.
"""

import csv
import json
import os
from collections import defaultdict

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(BASE_DIR, "frontend", "public", "data")


def load_patterns(csv_path: str) -> dict:
    """
    CSV(정류장순번, hour, dow, 재차인원) → nested dict
    { stopId: { hour: { dow: prediction } } }
    """
    preds = defaultdict(lambda: defaultdict(dict))
    with open(csv_path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            stop = int(row["정류장순번"])
            hour = int(row["hour"])
            dow = int(row["dow"])
            val = round(float(row["재차인원"]), 2)
            preds[stop][hour][dow] = val
    # Convert defaultdicts to regular dicts for JSON
    return {str(s): {str(h): d for h, d in hours.items()} for s, hours in preds.items()}


def load_stops(csv_path: str, route: str) -> list:
    """
    final_bus_data CSV에서 (정류장순번, 정류장명) 유니크 쌍 추출 + 방향 구분
    """
    stops_map = {}
    with open(csv_path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            seq = int(row["정류장순번"])
            name = row["정류장명"]
            if seq not in stops_map:
                stops_map[seq] = name

    max_seq = max(stops_map.keys())
    mid = max_seq // 2  # 대략 절반 기준으로 상행/하행 분리

    stops = []
    for seq in sorted(stops_map.keys()):
        direction = "상행" if seq <= mid else "하행"
        stops.append({"id": seq, "name": stops_map[seq], "direction": direction})

    return stops


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    for route in ["606", "420"]:
        pattern_csv = os.path.join(
            BASE_DIR, "model", route, "bus_standard_patterns_jan2026.csv"
        )
        data_csv = os.path.join(
            BASE_DIR, "data", "processed", f"final_bus_data_{route}_merged_sorted.csv"
        )

        # Predictions JSON
        preds = load_patterns(pattern_csv)
        pred_path = os.path.join(OUT_DIR, f"predictions_{route}.json")
        with open(pred_path, "w", encoding="utf-8") as f:
            json.dump(preds, f, ensure_ascii=False)
        print(f"  {pred_path} ({len(preds)} stops)")

        # Stops JSON
        stops = load_stops(data_csv, route)
        stop_path = os.path.join(OUT_DIR, f"stops_{route}.json")
        with open(stop_path, "w", encoding="utf-8") as f:
            json.dump(stops, f, ensure_ascii=False, indent=2)
        print(f"  {stop_path} ({len(stops)} stops)")


if __name__ == "__main__":
    main()
