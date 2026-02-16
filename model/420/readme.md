# 🚌 420번 버스 혼잡도 예측 모델 (Bus Congestion Prediction v1.0)

---

## 1. 개요 (Overview)
본 모델은 **420번 버스의 정류장별 실시간 재차인원(탑승객 수)**을 예측하는 머신러닝 솔루션입니다.  
단순한 통계가 아닌, **Random Forest Regressor**를 기반으로 요일, 공휴일, 그리고 **최근 혼잡도 패턴(Lag Features)**을 종합적으로 분석하여 미래의 혼잡도를 예측합니다.
- **v1 성능(운영 기준, Proxy Lag): MAE = 2.9807, R^2 = 0.8169**

---

## 2. 배포 패키지 구성 (Files)
아래 3개 파일은 서버의 **동일한 디렉토리**에 위치해야 합니다.

| 파일명 | 유형 | 설명 | 비고 |
| :--- | :--- | :--- | :--- |
| **`bus_model_v1_final.pkl`** | Model | 학습된 랜덤 포레스트 모델 본체 | 예측 엔진 |
| **`features_v1.pkl`** | Config | 모델이 학습한 Feature 순서 리스트 | **수정/삭제 절대 금지** |
| **`bus_standard_patterns_jan2026.csv`** | Data | 과거 데이터 룩업 테이블 (Cold Start용) | 2026년 1월 최신 패턴 |

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

---

## 4. 상세 로직 가이드 (Developer Guide)

### 4.1. 입력 변수 ($X$)
사용자로부터 다음 정보를 받습니다.
1.  **`stop_id` (int)**: 정류장 순번 (예: 20)
2.  **`target_time` (datetime)**: 예측하려는 날짜와 시간 (분 단위 포함)

### 4.2. 처리 프로세스 (Pipeline)
1.  **Context Feature 생성**: 입력된 시간에서 `hour`, `dow`(요일), `is_red`(공휴일) 추출.
2.  **History Feature 매핑**: `bus_standard_patterns_jan2026.csv`에서 해당 정류장/시간/요일의 평균값을 조회하여 `lag1`, `lag7` 등 4개 변수에 할당.
3.  **Model Prediction**: 모델을 통해 **'시간 단위(Hour)'** 예측값 생성.
4.  **Minute Interpolation**: 분 단위 입력을 처리하기 위해 선형 보간법 적용.

---

## 5. Python 구현 코드 (Copy & Paste)

서버에 이 클래스를 그대로 이식하여 사용하십시오.

```python
import pandas as pd
import numpy as np
import joblib
import holidays

class BusCongestionPredictor:
    def __init__(self, model_dir='./'):
        print(f"Loading Bus Model from {model_dir}...")
        self.model = joblib.load(f'{model_dir}bus_model_v1_final.pkl')
        self.features = joblib.load(f'{model_dir}features_v1.pkl')
        self.pattern_df = pd.read_csv(f'{model_dir}bus_standard_patterns_jan2026.csv')
        self.kr_holidays = holidays.KR(years=[2026])

    def _get_history_val(self, stop_id, hour, dow):
        """CSV 룩업 테이블에서 과거 패턴값 조회"""
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
        
        # 모델 입력 데이터 구성 (순서 중요)
        input_data = pd.DataFrame([{
            '정류장순번': stop_id, 'hour': hour, 'dow': dow, 'is_red': is_red,
            'lag1': base_val, 'lag7': base_val, 
            'rolling_mean_7d': base_val, 'station_hour_mean': base_val
        }])
        
        pred = self.model.predict(input_data[self.features])[0]
        return max(0, pred) # 음수 방지

    def predict(self, stop_id, target_time):
        """
        [Main API] 분 단위 보간법이 적용된 최종 예측 함수
        """
        # 1. 현재 시간대(H) 예측
        pred_now = self._predict_hourly(stop_id, target_time)
        
        # 2. 다음 시간대(H+1) 예측
        next_time = target_time + pd.Timedelta(hours=1)
        pred_next = self._predict_hourly(stop_id, next_time)
        
        # 3. 선형 보간 (Linear Interpolation)
        # 8시 30분이면 8시값과 9시값의 딱 중간값 도출
        weight = target_time.minute / 60.0
        final_pred = pred_now + (pred_next - pred_now) * weight
        
        return round(final_pred, 1)
```

---

## 6. 활용 가이드 (Business Logic)


### 혼잡도 레벨 (UI 텍스트)
*기준 : 일반 시내버스 좌석 25, 총 정원 50으로 잡음 

| 단계 | 예측 인원 범위 | 사용자 메시지 예시 |
| 기준 |  | :일반 시내버스 정원 |
| **여유**  | **0 ~ 20** | "앉아서 갈 수 있어요!" |
| **보통** | **21 ~ 35** | "빈 자리가 조금 있어요(서서 갈 확률 높음)" |
| **혼잡**  | **36 ~ 45** | "서서 가야 해요." |
| **매우 혼잡** ?? | **46~** | "꽉 찼습니다. 다음 차 추천!!" |

### 기타 확률들

휠체어석 탑승가능성 : 예상 재차인원 < 35면 가능, >35면 불가 

착석 확률 
pred<=20 : 앉아갈 확률 80% 이상

20<pred<=28 : 운좋으면 착석 가능

pred>28 : 서서 갈 확률 높음 

이 정도로 하면 될 것 같습니다!

