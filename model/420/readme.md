# 420 Bus Congestion Model Handoff

## 1. 목적
이 폴더는 420번 버스 혼잡도(재차인원) 예측 산출물 모음입니다.
운영 권장 방식은 대용량 `pkl` 직접 배포 대신 `pred_table_420.csv` 룩업 방식입니다.

---

## 2. 파일 정리 (현재 폴더 기준)

### 2.1 배포 필수 (프론트/웹앱)
- `pred_table_420.csv`
- `readme.md` (이 문서)

### 2.2 재생성 필수 (ML/데이터팀 보관)
- `generate_pred_table_420.py`
- `bus_model_420_final.pkl`
- `features_420.pkl`
- `bus_standard_patterns_jan2026.csv`

### 2.3 참고용 (운영에 직접 불필요)
- `bus_model_420_final.csv` (feature importance)
- `features_420.csv` (피처 목록 가독화본)

---

## 3. 권장 운영 방식

### 3.1 왜 CSV 룩업 방식인가
- `bus_model_420_final.pkl` 용량이 매우 큼(약 283MB)
- 웹 정적 배포/클라이언트 번들에 부적합
- `pred_table_420.csv`는 약 232KB로 가볍고 조회 속도가 빠름

### 3.2 예측 정확도 관점
- 룩업 CSV를 소수점 값 그대로 사용하면 운영 품질 저하는 최소화됨
- 품질 저하는 주로 아래 케이스에서 발생
- 값 사전 반올림(정수화)
- 모델이 아닌 고정 패턴 가정(`bus_standard_patterns_jan2026.csv`) 자체의 한계

---

## 4. 개발팀 적용 방법 (실서비스)

### 4.1 입력/출력 정의
- 입력: `stopId`, `targetDateTime`
- 출력: 해당 시각의 예측 재차인원(`number`)

### 4.2 룩업 키
- CSV 컬럼: `정류장순번,dow,hour,pred`
- `dow`: 월=0, 화=1, ..., 일=6
- `hour`: 0~23

### 4.3 예측 로직
1. `targetDateTime`에서 `dow`, `hour`, `minute` 추출
2. `(stopId, dow, hour)`의 `pred_now` 조회
3. `(stopId, dow, (hour+1)%24)`의 `pred_next` 조회
4. 선형 보간: `pred = pred_now + (pred_next - pred_now) * (minute / 60)`
5. UI 표시 시에만 반올림 (내부 계산은 소수 유지)

### 4.4 JavaScript 예시
```javascript
function buildPredMap(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = `${Number(r["정류장순번"])}_${Number(r.dow)}_${Number(r.hour)}`;
    map.set(key, Number(r.pred));
  }
  return map;
}

function predict420(predMap, stopId, dt) {
  const dow = dt.getDay() === 0 ? 6 : dt.getDay() - 1; // JS: 일0~토6 -> 월0~일6
  const hour = dt.getHours();
  const minute = dt.getMinutes();

  const keyNow = `${stopId}_${dow}_${hour}`;
  const keyNext = `${stopId}_${dow}_${(hour + 1) % 24}`;
  const predNow = predMap.get(keyNow) ?? 0;
  const predNext = predMap.get(keyNext) ?? predNow;

  const w = minute / 60;
  const pred = predNow + (predNext - predNow) * w;
  return pred; // 표시 단계에서만 Math.round(pred)
}
```

---

## 5. 재생성 방법 (ML/데이터팀)

### 5.1 실행
```bash
python model/420/generate_pred_table_420.py
```

### 5.2 산출물
- `pred_table_420.csv` 재생성
- 총 행 수: `90 정류장 x 7요일 x 24시간 = 15120`

### 5.3 재생성 시점
- 모델(`.pkl`) 재학습/교체 시
- 패턴 CSV(`bus_standard_patterns_jan2026.csv`) 갱신 시

---

## 6. 성능 요약
- 평가 방식: Time-based 70/30 split (shuffle 없음)
- 반복: `random_state=0~9` 10회 평균
- 모델: `RandomForestRegressor(n_estimators=100, max_depth=15, n_jobs=-1)`
- 결과
- `MAE = 3.1176 ± 0.0007`
- `R^2 = 0.8470 ± 0.0001`

---

## 7. 개발팀 전달 체크리스트
- `pred_table_420.csv` 전달
- 프론트 `dow` 매핑 확인 (월0~일6)
- 내부 계산 소수 유지, UI에서만 반올림
- 인코딩 `utf-8-sig` 유지
