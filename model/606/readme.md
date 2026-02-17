# 606번 버스 혼잡도 예측 모델 (Bus Congestion Prediction v1.0)

---

## 1. 개요 (Overview)
본 모델은 **606번 버스의 정류장별 실시간 재차인원(탑승객 수)**을 예측하는 머신러닝 솔루션입니다.
**Random Forest Regressor**를 기반으로 요일, 공휴일, 그리고 **최근 혼잡도 패턴(Lag Features)**을 종합적으로 분석하여 미래의 혼잡도를 예측합니다.
- **v1 성능(운영 기준, Proxy Lag): MAE = 2.9768, R^2 = 0.8336**

### 모델 결과물
모델은 **예상 재차인원(명)** 숫자 하나를 반환합니다.
```
predict(stop_id=58, target_time="2026-02-17 08:15") → 29.3
```
"그 시간에 그 정류장을 지나는 버스에 약 29.3명이 타고 있을 것이다"

---

## 2. 배포 패키지 구성 (Files)
아래 3개 파일은 서버의 **동일한 디렉토리**에 위치해야 합니다.

| 파일명 | 유형 | 설명 | 비고 |
| :--- | :--- | :--- | :--- |
| **`bus_model_606_final.pkl`** | Model | 학습된 랜덤 포레스트 모델 본체 | 예측 엔진 |
| **`features_606.pkl`** | Config | 모델이 학습한 Feature 순서 리스트 (8개) | **수정/삭제 절대 금지** |
| **`bus_standard_patterns_jan2026.csv`** | Data | 과거 데이터 룩업 테이블 (Cold Start용) | 2026년 1월 최신 패턴, 21,000행 |

---

## 3. 모델링 원리 (Model Theory)

### 3.1. 예측 수식
본 모델의 예측 메커니즘은 다음과 같은 함수 관계로 정의됩니다.

$$\hat{y}_{t} = f_{RF} ( X_{context}, X_{history} )$$

* **$\hat{y}_{t}$**: $t$ 시점의 예측 재차인원
* **$f_{RF}$**: Random Forest Regression (비선형 앙상블 모델)
* **$X_{context}$**: 시공간적 맥락 (정류장ID, 시간, 요일, 공휴일 여부)
* **$X_{history}$**: 시계열적 패턴 (Lag Features - 어제/지난주 동시간대 인원)

### 3.2. 하이브리드 인퍼런스 (Hybrid Inference)
실시간 DB 부하를 줄이고 데이터가 없는 미래 시점 예측을 위해, **$X_{history}$ 변수를 고정된 룩업 테이블(CSV)로 대체**하는 전략을 사용합니다.
즉, 모델은 **"2026년 1월의 최신 혼잡 패턴이 유지된다"**는 가정 하에, 입력된 날짜(요일/공휴일)의 특성을 반영하여 최종 인원을 계산합니다.

### 3.3. 전체 흐름도

```
사용자 입력                        모델 내부                           최종 출력
─────────────                   ──────────                         ──────────
"정류장 58번,                   ┌─────────────────┐
 오후 2시 15분에               │ 1. Context 피처  │
 사람 몇 명?"                  │    hour=14       │
         │                     │    dow=1(화)     │
         │                     │    is_red=0      │
         ▼                     └────────┬────────┘
  ┌──────────────┐                      │
  │ predict()    │                      ▼
  │ (메인 함수)   │             ┌─────────────────┐
  └──────┬───────┘             │ 2. CSV 룩업     │
         │                     │  "58번 정류장,   │
         │                     │   14시, 화요일"  │──→ base_val = 25.3
         │                     └────────┬────────┘
         │                              │
         │                              ▼
         │                     ┌─────────────────┐
         │                     │ 3. 모델 예측     │
         │                     │  8개 피처 입력   │──→ 14시 예측값 = 27.1
         │                     │  → RF 계산      │    13시 예측값 = 22.4
         │                     └────────┬────────┘
         │                              │
         │                              ▼
         │                     ┌─────────────────┐
         ▼                     │ 4. 분단위 보간   │
   최종 결과                    │  13:30 ↔ 14:30  │──→ 24.8명
   "약 24.8명"                 │  사이를 선형보간  │
                               └─────────────────┘
```

---

## 4. 상세 로직 가이드 (Developer Guide)

### 4.1. 입력 변수
사용자로부터 다음 정보를 받습니다.
1.  **`stop_id` (int)**: 정류장 순번 (1~125). 상행 1~약66, 하행 약67~125
2.  **`target_time` (datetime)**: 예측하려는 날짜와 시간 (분 단위 포함)

> **정류장순번 참고**: 같은 물리적 정류장이라도 상행(가는 길)과 하행(돌아오는 길)에서 순번이 다릅니다. 예) 부인초교: 상행=2번, 하행=124번. UI에서 출발/도착 정류장을 받아 방향을 판단한 뒤 올바른 순번으로 변환하는 매핑 레이어가 필요합니다.

### 4.2. 8개 피처 (Feature) 상세

모델에 입력되는 8개 피처는 두 그룹으로 나뉩니다.

**[A] 사용자 입력에서 직접 계산 (Context Features, 4개)**

| 피처명 | 출처 | 의미 | 예시 |
| :--- | :--- | :--- | :--- |
| `정류장순번` | 사용자 선택 | 노선의 몇 번째 정류장 | `58` (이대부고 상행) |
| `hour` | `target_time.hour` | 시간대 (0~23) | `8` (오전 8시) |
| `dow` | `target_time.weekday()` | 요일 (0=월 ~ 6=일) | `0` (월요일) |
| `is_red` | dow + 공휴일 달력 | 쉬는 날 여부 (0=평일, 1=주말/공휴일) | `0` (평일) |

**[B] CSV 룩업에서 가져오는 과거 패턴 (History Features, 4개)**

| 피처명 | 학습 때 원래 의미 | 예측 때 | 중요도 |
| :--- | :--- | :--- | :--- |
| `station_hour_mean` | 해당 정류장+시간의 전체 기간 평균 | base_val | **78.05%** |
| `lag7` | 7일 전 동시간 동정류장 재차인원 | base_val | 6.69% |
| `rolling_mean_7d` | 최근 7일 동시간 이동평균 | base_val | 4.73% |
| `lag1` | 전일 동시간 동정류장 재차인원 | base_val | 3.05% |

> **base_val 이란?**: `bus_standard_patterns_jan2026.csv`에서 `(정류장순번, hour, dow)`로 조회한 2026년 1월 평균 재차인원입니다. 미래 예측 시 실제 lag 데이터가 없으므로, 4개 History Feature를 모두 이 값으로 대체합니다 (Proxy Lag 전략).

### 4.3. 처리 프로세스 (Pipeline)
1.  **Context Feature 생성**: 입력된 시간에서 `hour`, `dow`(요일), `is_red`(공휴일) 추출.
2.  **History Feature 매핑**: `bus_standard_patterns_jan2026.csv`에서 해당 정류장/시간/요일의 평균값(base_val)을 조회하여 lag1, lag7, rolling_mean_7d, station_hour_mean에 할당.
3.  **Hourly Prediction**: 8개 피처를 모델에 입력하여 시간 단위 예측값 생성.
4.  **Minute Interpolation (중심점 보간법)**:
    * 모델의 예측값은 해당 시간대의 **최대 혼잡도(Max)**를 의미합니다.
    * 통계적 대표성을 위해 **매 시 30분(Center Point)**을 해당 혼잡도의 기준점으로 설정합니다.
    * 분 단위 입력에 따라 **이전 시간대 30분** 혹은 **다음 시간대 30분** 사이를 선형 보간하여 연결합니다.

### 4.4. 함수 호출 순서

```
사용자 호출
    │
    ▼
predict(stop_id=58, target_time=14:15)          ← 메인 진입점
    │
    ├─► _predict_hourly(58, 13:15)               ← 이전 시간 예측
    │       └─► _get_history_val(58, 13, 월)      ← CSV 조회 → base_val
    │           └─► model.predict([8개 피처])      ← RF 모델 실행 → p_prev
    │
    ├─► _predict_hourly(58, 14:15)               ← 현재 시간 예측
    │       └─► _get_history_val(58, 14, 월)      ← CSV 조회 → base_val
    │           └─► model.predict([8개 피처])      ← RF 모델 실행 → p_curr
    │
    └─► 선형 보간: p_prev + (p_curr - p_prev) × weight
        └─► return 25.9  (반올림된 최종 예측 인원수)
```

---

## 5. Python 구현 코드 (Copy & Paste)

서버에 이 클래스를 그대로 이식하여 사용하십시오. **(중심점 보간법 적용됨)**

```python
import pandas as pd
import numpy as np
import joblib
import holidays

class BusCongestionPredictor606:
    def __init__(self, model_dir='./'):
        print(f"Loading Bus 606 Model from {model_dir}...")
        self.model = joblib.load(f'{model_dir}bus_model_606_final.pkl')
        self.features = joblib.load(f'{model_dir}features_606.pkl')
        self.pattern_df = pd.read_csv(f'{model_dir}bus_standard_patterns_jan2026.csv')
        self.kr_holidays = holidays.KR(years=[2026])

    def _get_history_val(self, stop_id, hour, dow):
        """CSV 룩업 테이블에서 과거 패턴값(base_val) 조회"""
        row = self.pattern_df[
            (self.pattern_df['정류장순번'] == stop_id) &
            (self.pattern_df['hour'] == hour) &
            (self.pattern_df['dow'] == dow)
        ]
        if not row.empty: return row['재차인원'].values[0]

        # Fallback: 요일 무관 평균
        fallback = self.pattern_df[(self.pattern_df['정류장순번'] == stop_id) & (self.pattern_df['hour'] == hour)]
        return fallback['재차인원'].mean() if not fallback.empty else 0.0

    def _predict_hourly(self, stop_id, dt):
        """내부 함수: 특정 시간(Hour)의 예측값 계산"""
        hour = dt.hour
        dow = dt.weekday()
        is_red = 1 if (dow >= 5 or dt in self.kr_holidays) else 0

        # CSV에서 과거 패턴값 매핑
        base_val = self._get_history_val(stop_id, hour, dow)

        # 모델 입력 데이터 구성 (순서 중요 - features_606.pkl 순서 따름)
        input_data = pd.DataFrame([{
            '정류장순번': stop_id, 'hour': hour, 'dow': dow, 'is_red': is_red,
            'lag1': base_val, 'lag7': base_val,
            'rolling_mean_7d': base_val, 'station_hour_mean': base_val
        }])

        pred = self.model.predict(input_data[self.features])[0]
        return max(0, pred) # 음수 방지

    def predict(self, stop_id, target_time):
        """
        [Main API] 중심점 보간법(Center-Point Interpolation)이 적용된 최종 함수
        가정: 모델 예측값(Max Load)은 해당 시간대의 중심인 '30분'에 발생한다.
        """
        minute = target_time.minute

        # Case 1: 0분 ~ 29분 (이전 시간대 30분 ~ 현재 시간대 30분 사이)
        if minute < 30:
            # 이전 시간(H-1) 예측값 (Anchor: H-1시 30분)
            prev_time = target_time - pd.Timedelta(hours=1)
            p_prev = self._predict_hourly(stop_id, prev_time)

            # 현재 시간(H) 예측값 (Anchor: H시 30분)
            p_curr = self._predict_hourly(stop_id, target_time)

            # 가중치 계산 (총 60분 간격)
            # 예: 15분 -> (15 + 30) / 60 = 0.75 지점
            weight = (minute + 30) / 60.0
            final_pred = p_prev + (p_curr - p_prev) * weight

        # Case 2: 30분 ~ 59분 (현재 시간대 30분 ~ 다음 시간대 30분 사이)
        else:
            # 현재 시간(H) 예측값 (Anchor: H시 30분)
            p_curr = self._predict_hourly(stop_id, target_time)

            # 다음 시간(H+1) 예측값 (Anchor: H+1시 30분)
            next_time = target_time + pd.Timedelta(hours=1)
            p_next = self._predict_hourly(stop_id, next_time)

            # 가중치 계산
            # 예: 45분 -> (45 - 30) / 60 = 0.25 지점
            weight = (minute - 30) / 60.0
            final_pred = p_curr + (p_next - p_curr) * weight

        return round(final_pred, 1)
```

---

## 6. 활용 가이드 (Business Logic)

### 혼잡도 레벨 (UI 텍스트)
*기준 : 일반 시내버스 좌석 25, 총 정원 50으로 잡음

| 단계 | 예측 인원 범위 | 사용자 메시지 예시 |
| :--- | :--- | :--- |
| **여유** | **0 ~ 20** | "앉아서 갈 수 있어요!" |
| **보통** | **21 ~ 35** | "빈 자리가 조금 있어요(서서 갈 확률 높음)" |
| **혼잡** | **36 ~ 45** | "서서 가야 해요." |
| **매우 혼잡** | **46~** | "꽉 찼습니다. 다음 차 추천!!" |

### 기타 확률들

휠체어석 탑승가능성 : 예상 재차인원 < 35면 가능, >35면 불가

착석 확률
pred<=20 : 앉아갈 확률 80% 이상

20<pred<=28 : 운좋으면 착석 가능

pred>28 : 서서 갈 확률 높음

---

## 7. 학습 정보

- **데이터**: 606번 버스 승차 데이터 (2025-01 ~ 2026-01, 125개 정류장)
- **Train 기간**: 2025-01-01 ~ 2025-10-04 (70%)
- **Test 기간**: 2025-10-04 ~ 2026-01-31 (30%)
- **데이터 수**: Train 825,300행 / Test 353,700행
- **알고리즘**: RandomForestRegressor (n_estimators=100, max_depth=15, min_samples_split=2, min_samples_leaf=1, random_state=42)
- **성능**: MAE=2.9768, RMSE=4.7686, R²=0.8336

### Feature Importance (피처 중요도)

| 순위 | 피처 | 중요도 | 설명 |
| :--- | :--- | :--- | :--- |
| 1 | `station_hour_mean` | 85.06% | 정류장+시간 전체 평균 |
| 2 | `lag7` | 5.78% | 7일 전 동시간 재차인원 |
| 3 | `rolling_mean_7d` | 2.43% | 최근 7일 이동평균 |
| 4 | `hour` | 1.98% | 시간대 (0~23) |
| 5 | `is_red` | 1.53% | 주말/공휴일 여부 |
| 6 | `lag1` | 1.34% | 전일 동시간 재차인원 |
| 7 | `정류장순번` | 1.07% | 정류장 위치 |
| 8 | `dow` | 0.80% | 요일 |
