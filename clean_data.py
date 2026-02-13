"""
2-1: 결측치/이상치 처리
3개 데이터셋(승하차 시간대별, 승하차 일별, 날씨)을 정제하여 data/processed/에 저장
"""

import os
import numpy as np
import pandas as pd

BASE_DIR = os.path.dirname(__file__)
FILTERED_DIR = os.path.join(BASE_DIR, "data", "filtered")
RAW_DIR = os.path.join(BASE_DIR, "data", "raw")
PROCESSED_DIR = os.path.join(BASE_DIR, "data", "processed")


def detect_outliers_iqr(series, multiplier=3.0):
    """IQR 방법으로 이상치 인덱스 반환 (0이 아닌 값 대상)"""
    nonzero = series[series > 0]
    if len(nonzero) == 0:
        return pd.Series(dtype=bool)
    q1 = nonzero.quantile(0.25)
    q3 = nonzero.quantile(0.75)
    iqr = q3 - q1
    upper_bound = q3 + multiplier * iqr
    return series > upper_bound


def clean_hourly_boarding():
    """시간대별 승하차 데이터 정제"""
    print("=== 1. 시간대별 승하차 데이터 정제 ===")
    df = pd.read_csv(os.path.join(FILTERED_DIR, "hourly_boarding_606_420.csv"))

    # 승하차 컬럼 추출
    board_cols = [c for c in df.columns if "승차총승객수" in c or "하차총승객수" in c]

    # 결측치 → 0
    null_count = df[board_cols].isnull().sum().sum()
    print(f"  결측치: {null_count}개 → 0으로 처리")
    df[board_cols] = df[board_cols].fillna(0).astype(int)

    # 이상치 탐지 (IQR × 3)
    outlier_count = 0
    for col in board_cols:
        outliers = detect_outliers_iqr(df[col])
        if outliers.any():
            upper = df[col][~outliers].max()
            cnt = outliers.sum()
            outlier_count += cnt
            df.loc[outliers, col] = int(upper)

    print(f"  이상치: {outlier_count}개 → 상한값으로 보정(capping)")

    # 불필요 컬럼 제거
    drop_cols = ["교통수단타입코드", "교통수단타입명", "등록일자"]
    df = df.drop(columns=[c for c in drop_cols if c in df.columns])

    print(f"  정제 후 shape: {df.shape}")
    return df


def clean_daily_boarding():
    """일별 승하차 데이터 정제"""
    print("\n=== 2. 일별 승하차 데이터 정제 ===")
    df = pd.read_csv(os.path.join(FILTERED_DIR, "daily_boarding_606_420.csv"))

    board_cols = ["승차총승객수", "하차총승객수"]

    # 결측치 → 0
    null_count = df[board_cols].isnull().sum().sum()
    print(f"  결측치: {null_count}개 → 0으로 처리")
    df[board_cols] = df[board_cols].fillna(0).astype(int)

    # 이상치 탐지 — 노선별로 수행
    outlier_count = 0
    for route in df["노선번호"].unique():
        mask = df["노선번호"] == route
        for col in board_cols:
            outliers = detect_outliers_iqr(df.loc[mask, col])
            if outliers.any():
                upper = df.loc[mask, col][~outliers].max()
                cnt = outliers.sum()
                outlier_count += cnt
                df.loc[mask & outliers, col] = int(upper)

    print(f"  이상치: {outlier_count}개 → 상한값으로 보정(capping)")

    # 날짜 형식 변환
    df["사용일자"] = pd.to_datetime(df["사용일자"].astype(str), format="%Y%m%d")

    # 불필요 컬럼 제거
    df = df.drop(columns=[c for c in ["등록일자"] if c in df.columns])

    print(f"  정제 후 shape: {df.shape}")
    return df


def clean_weather():
    """날씨 데이터 정제"""
    print("\n=== 3. 날씨 데이터 정제 ===")
    df = pd.read_csv(os.path.join(RAW_DIR, "weather_hourly.csv"), encoding="cp949")

    # 필요 컬럼만 선택
    df = df[["일시", "기온(°C)", "강수량(mm)", "풍속(m/s)", "적설(cm)"]].copy()

    # 컬럼명 정리
    df.columns = ["datetime", "temperature", "precipitation", "wind_speed", "snow"]

    # 결측치 처리
    precip_null = df["precipitation"].isnull().sum()
    snow_null = df["snow"].isnull().sum()
    df["precipitation"] = df["precipitation"].fillna(0)
    df["snow"] = df["snow"].fillna(0)
    print(f"  강수량 NaN {precip_null}개 → 0 (비 안 온 시간)")
    print(f"  적설 NaN {snow_null}개 → 0")

    # 기온/풍속 결측 확인
    temp_null = df["temperature"].isnull().sum()
    wind_null = df["wind_speed"].isnull().sum()
    if temp_null > 0:
        df["temperature"] = df["temperature"].interpolate(method="linear")
        print(f"  기온 NaN {temp_null}개 → 선형 보간")
    if wind_null > 0:
        df["wind_speed"] = df["wind_speed"].interpolate(method="linear")
        print(f"  풍속 NaN {wind_null}개 → 선형 보간")

    # 날짜 파싱
    df["datetime"] = pd.to_datetime(df["datetime"])

    # 이상치 확인 (기온은 서울 기준 -20~40 범위)
    temp_outliers = (df["temperature"] < -20) | (df["temperature"] > 40)
    wind_outliers = df["wind_speed"] > 30
    if temp_outliers.any():
        print(f"  기온 이상치 {temp_outliers.sum()}개 제거")
        df.loc[temp_outliers, "temperature"] = np.nan
        df["temperature"] = df["temperature"].interpolate(method="linear")
    if wind_outliers.any():
        print(f"  풍속 이상치 {wind_outliers.sum()}개 제거")
        df.loc[wind_outliers, "wind_speed"] = np.nan
        df["wind_speed"] = df["wind_speed"].interpolate(method="linear")

    print(f"  최종 결측치: {df.isnull().sum().sum()}개")
    print(f"  정제 후 shape: {df.shape}")
    return df


def main():
    os.makedirs(PROCESSED_DIR, exist_ok=True)

    # 1) 시간대별 승하차
    hourly = clean_hourly_boarding()
    hourly_path = os.path.join(PROCESSED_DIR, "hourly_boarding_clean.csv")
    hourly.to_csv(hourly_path, index=False, encoding="utf-8-sig")
    print(f"  → 저장: {hourly_path}")

    # 2) 일별 승하차
    daily = clean_daily_boarding()
    daily_path = os.path.join(PROCESSED_DIR, "daily_boarding_clean.csv")
    daily.to_csv(daily_path, index=False, encoding="utf-8-sig")
    print(f"  → 저장: {daily_path}")

    # 3) 날씨
    weather = clean_weather()
    weather_path = os.path.join(PROCESSED_DIR, "weather_clean.csv")
    weather.to_csv(weather_path, index=False, encoding="utf-8-sig")
    print(f"  → 저장: {weather_path}")

    # 요약
    print(f"\n{'='*50}")
    print("정제 완료 요약")
    print(f"{'='*50}")
    print(f"  시간대별 승하차: {hourly.shape}")
    print(f"  일별 승하차: {daily.shape}")
    print(f"  날씨: {weather.shape}")
    print(f"  저장 위치: {PROCESSED_DIR}")


if __name__ == "__main__":
    main()
