"""
다운로드한 전체 승하차 데이터에서 606번, 420번 노선만 필터링하여 저장
"""

import os
import pandas as pd
from glob import glob

RAW_DIR = os.path.join(os.path.dirname(__file__), "data", "raw")
FILTERED_DIR = os.path.join(os.path.dirname(__file__), "data", "filtered")
TARGET_ROUTES = ["606", "420"]


def filter_csv(filepath, route_col="노선번호"):
    """CSV에서 606/420번 노선만 필터링"""
    df = pd.read_csv(filepath, encoding="cp949", low_memory=False)
    df[route_col] = df[route_col].astype(str)
    filtered = df[df[route_col].isin(TARGET_ROUTES)]
    return filtered


def main():
    os.makedirs(FILTERED_DIR, exist_ok=True)

    # 1) 시간대별 승하차 데이터 필터링
    hourly_files = sorted(glob(os.path.join(RAW_DIR, "hourly_boarding_*.csv")))
    print(f"시간대별 파일 {len(hourly_files)}개 처리 중...")

    hourly_all = []
    for f in hourly_files:
        fname = os.path.basename(f)
        filtered = filter_csv(f)
        hourly_all.append(filtered)
        print(f"  {fname}: {len(filtered)}행")

    hourly_df = pd.concat(hourly_all, ignore_index=True)
    hourly_path = os.path.join(FILTERED_DIR, "hourly_boarding_606_420.csv")
    hourly_df.to_csv(hourly_path, index=False, encoding="utf-8-sig")
    print(f"  -> 저장 완료: {hourly_path} ({len(hourly_df)}행)")

    # 2) 일별 승하차 데이터 필터링
    daily_files = sorted(glob(os.path.join(RAW_DIR, "daily_boarding_*.csv")))
    print(f"\n일별 파일 {len(daily_files)}개 처리 중...")

    daily_all = []
    for f in daily_files:
        fname = os.path.basename(f)
        filtered = filter_csv(f)
        daily_all.append(filtered)
        print(f"  {fname}: {len(filtered)}행")

    daily_df = pd.concat(daily_all, ignore_index=True)
    daily_path = os.path.join(FILTERED_DIR, "daily_boarding_606_420.csv")
    daily_df.to_csv(daily_path, index=False, encoding="utf-8-sig")
    print(f"  -> 저장 완료: {daily_path} ({len(daily_df)}행)")

    # 3) 요약 출력
    print(f"\n{'='*50}")
    print("필터링 결과 요약")
    print(f"{'='*50}")
    for route in TARGET_ROUTES:
        h_count = len(hourly_df[hourly_df["노선번호"] == route])
        d_count = len(daily_df[daily_df["노선번호"] == route])
        print(f"  {route}번: 시간대별 {h_count}행, 일별 {d_count}행")

    print(f"\n기간: {hourly_df['사용년월'].min()} ~ {hourly_df['사용년월'].max()}")
    print(f"일별 기간: {daily_df['사용일자'].min()} ~ {daily_df['사용일자'].max()}")


if __name__ == "__main__":
    main()
