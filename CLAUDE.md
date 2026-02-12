# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

저상버스 혼잡도 예측 서비스 (Low-Floor Bus Congestion Prediction Service). Predicts boarding probability (0–1 continuous value) at bus stops for routes 606 and 420 using historical congestion and real-time data.

## Tech Stack

- **Language**: Python
- **Data**: pandas, numpy
- **ML**: XGBoost (or LightGBM), scikit-learn, SHAP
- **Visualization**: matplotlib, seaborn, plotly
- **Scheduling**: APScheduler
- **Database**: PostgreSQL or SQLite
- **Model serialization**: pickle (.pkl) + JSON metadata

## Data Sources

- 서울시 버스 API: real-time bus arrival info (includes low-floor bus flag)
- 서울시 열린데이터광장: stop-level boarding/alighting stats by route, stop, and time
- 기상청 API: weather data (precipitation, temperature, wind speed)

## Architecture

- **Separate models per route**: Route 606 and Route 420 each get their own XGBoost regression model
- **Target variable**: Congestion index normalized 0–1 (boarding count / stop max boarding count)
- **Train/test split**: Time-series aware 70/30 split (no random shuffle)
- **Key features**: hour (0–23), day-of-week (0–6), month, rush-hour flags (AM 7–9, PM 18–20), weekend/holiday, weather (precipitation, temp, wind), stop sequence number, rolling average congestion (1h, 1d, 1w)
- **Evaluation metrics**: MAE, RMSE, R²

## Project Phases

1. **Phase 1** — Data collection: route info JSON, API validation scripts, historical CSVs (606_data.csv, 420_data.csv, weather_data.csv), real-time collection pipeline with APScheduler
2. **Phase 2** — Data cleaning & analysis: missing/outlier handling, congestion index calculation, EDA visualizations, feature engineering
3. **Phase 3** — ML model: XGBoost training, hyperparameter tuning (GridSearchCV/RandomizedSearchCV), evaluation, model versioning (pkl + JSON metadata)

## Conventions

- Historical data period: Nov 2025 – Jan 2026 (3 months)
- Model versions follow v1.0, v1.1 naming
- Each model version stores metadata: training date, version string, performance metrics
