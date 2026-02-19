from __future__ import annotations

from pathlib import Path

import joblib
import numpy as np
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "bus_model_420_final.pkl"
FEATURES_PATH = BASE_DIR / "features_420.pkl"
PATTERN_PATH = BASE_DIR / "bus_standard_patterns_jan2026.csv"
OUTPUT_PATH = BASE_DIR / "pred_table_420.csv"


def main() -> None:
    model = joblib.load(MODEL_PATH)
    features = joblib.load(FEATURES_PATH)
    pattern_df = pd.read_csv(PATTERN_PATH)

    stop_col = pattern_df.columns[0]

    # Create full key space for stable lookup on the web client.
    stops = sorted(pattern_df[stop_col].dropna().astype(int).unique().tolist())
    dows = list(range(7))
    hours = list(range(24))

    key_df = pd.MultiIndex.from_product(
        [stops, dows, hours],
        names=[stop_col, "dow", "hour"],
    ).to_frame(index=False)

    merged = key_df.merge(
        pattern_df[[stop_col, "dow", "hour", "재차인원"]],
        on=[stop_col, "dow", "hour"],
        how="left",
    )

    fallback_by_stop_hour = (
        pattern_df.groupby([stop_col, "hour"], as_index=False)["재차인원"].mean()
        .rename(columns={"재차인원": "fallback_stop_hour"})
    )

    merged = merged.merge(
        fallback_by_stop_hour,
        on=[stop_col, "hour"],
        how="left",
    )

    merged["base_val"] = merged["재차인원"].fillna(merged["fallback_stop_hour"]).fillna(0.0)

    input_df = pd.DataFrame(
        {
            "정류장순번": merged[stop_col].astype(int),
            "hour": merged["hour"].astype(int),
            "dow": merged["dow"].astype(int),
            "is_red": (merged["dow"] >= 5).astype(int),
            "lag1": merged["base_val"],
            "lag7": merged["base_val"],
            "rolling_mean_7d": merged["base_val"],
            "station_hour_mean": merged["base_val"],
        }
    )

    preds = model.predict(input_df[features])
    preds = np.maximum(0, preds)

    out_df = pd.DataFrame(
        {
            stop_col: merged[stop_col].astype(int),
            "dow": merged["dow"].astype(int),
            "hour": merged["hour"].astype(int),
            "pred": np.round(preds, 4),
        }
    ).sort_values([stop_col, "dow", "hour"])

    out_df.to_csv(OUTPUT_PATH, index=False, encoding="utf-8-sig")
    print(f"WROTE: {OUTPUT_PATH}")
    print(f"ROWS: {len(out_df)}")


if __name__ == "__main__":
    main()
