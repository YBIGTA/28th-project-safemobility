"""
1-1: 노선 기본 정보 파악
606번, 420번 버스의 노선 정보 및 정류장 목록을 API로 조회하여 JSON 저장
"""

import os
import json
import requests
import xml.etree.ElementTree as ET
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("SEOUL_BUS_API_KEY")
BASE_URL = "http://ws.bus.go.kr/api/rest/busRouteInfo"


def parse_xml_items(xml_text):
    """XML 응답에서 itemList 요소들을 딕셔너리 리스트로 파싱"""
    root = ET.fromstring(xml_text)

    # 에러 체크
    header_cd = root.findtext(".//headerCd")
    header_msg = root.findtext(".//headerMsg")
    if header_cd != "0":
        raise Exception(f"API 에러: [{header_cd}] {header_msg}")

    items = []
    for item in root.iter("itemList"):
        row = {}
        for child in item:
            row[child.tag] = child.text
        items.append(row)
    return items


def get_bus_route_list(route_name):
    """노선 번호로 검색하여 노선 목록 반환"""
    url = f"{BASE_URL}/getBusRouteList"
    params = {"serviceKey": API_KEY, "strSrch": route_name}
    resp = requests.get(url, params=params, timeout=10)
    resp.raise_for_status()
    return parse_xml_items(resp.text)


def get_route_info(bus_route_id):
    """노선 ID로 상세 정보 조회"""
    url = f"{BASE_URL}/getRouteInfo"
    params = {"serviceKey": API_KEY, "busRouteId": bus_route_id}
    resp = requests.get(url, params=params, timeout=10)
    resp.raise_for_status()
    items = parse_xml_items(resp.text)
    return items[0] if items else None


def get_stations_by_route(bus_route_id):
    """노선 ID로 정류장 목록 조회"""
    url = f"{BASE_URL}/getStaionByRoute"
    params = {"serviceKey": API_KEY, "busRouteId": bus_route_id}
    resp = requests.get(url, params=params, timeout=10)
    resp.raise_for_status()
    return parse_xml_items(resp.text)


def format_time(raw_time):
    """API 시간 포맷(예: 20210704041000000)에서 HH:MM 추출"""
    if raw_time and len(raw_time) >= 12:
        return f"{raw_time[8:10]}:{raw_time[10:12]}"
    return raw_time


def find_exact_route(route_name):
    """검색 결과에서 정확히 일치하는 노선 찾기"""
    routes = get_bus_route_list(route_name)
    for route in routes:
        if route.get("busRouteNm") == route_name:
            return route
    # 정확한 매칭이 없으면 첫 번째 결과 반환
    if routes:
        print(f"  정확한 매칭 없음. 첫 번째 결과 사용: {routes[0].get('busRouteNm')}")
        return routes[0]
    return None


def collect_route_info(route_name):
    """노선 정보 + 정류장 목록을 수집하여 딕셔너리로 반환"""
    print(f"\n{'='*50}")
    print(f" {route_name}번 버스 정보 수집 시작")
    print(f"{'='*50}")

    # 1) 노선 검색
    print(f"[1/3] 노선 검색 중... ('{route_name}')")
    route = find_exact_route(route_name)
    if not route:
        print(f"  ERROR: '{route_name}' 노선을 찾을 수 없습니다.")
        return None

    bus_route_id = route.get("busRouteId") or route.get("busrouteid")
    print(f"  노선 ID: {bus_route_id}")

    # 2) 노선 상세 정보
    print(f"[2/3] 노선 상세 정보 조회 중...")
    detail = get_route_info(bus_route_id)

    first_time = format_time(detail.get("firstBusTm", "")) if detail else ""
    last_time = format_time(detail.get("lastBusTm", "")) if detail else ""
    term = detail.get("term", "") if detail else ""

    print(f"  첫차: {first_time}, 막차: {last_time}, 배차간격: {term}분")

    # 3) 정류장 목록
    print(f"[3/3] 정류장 목록 조회 중...")
    stations = get_stations_by_route(bus_route_id)
    print(f"  총 {len(stations)}개 정류장")

    # 결과 구성
    result = {
        "route_name": route_name,
        "bus_route_id": bus_route_id,
        "route_type": detail.get("routeType", "") if detail else "",
        "first_bus_time": first_time,
        "last_bus_time": last_time,
        "dispatch_interval_min": term,
        "corporation": detail.get("corpNm", "") if detail else "",
        "total_stations": len(stations),
        "stations": [
            {
                "seq": int(s.get("seq", 0)),
                "station_id": s.get("station", ""),
                "station_name": s.get("stationNm", ""),
                "station_no": s.get("stationNo", ""),
                "ars_id": s.get("arsId", ""),
                "gps_x": s.get("gpsX", ""),
                "gps_y": s.get("gpsY", ""),
                "direction": s.get("direction", ""),
            }
            for s in sorted(stations, key=lambda x: int(x.get("seq", 0)))
        ],
    }

    return result


def save_json(data, filename):
    """JSON 파일 저장"""
    filepath = os.path.join(os.path.dirname(__file__), "data", filename)
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"  저장 완료: {filepath}")


def main():
    routes = ["606", "420"]

    for route_name in routes:
        result = collect_route_info(route_name)
        if result:
            save_json(result, f"route_info_{route_name}.json")
            print(f"\n  {route_name}번 버스: {result['total_stations']}개 정류장")
            print(f"  첫차 {result['first_bus_time']} / 막차 {result['last_bus_time']}")
            print(f"  배차간격: {result['dispatch_interval_min']}분")

    print(f"\n{'='*50}")
    print(" 모든 노선 정보 수집 완료!")
    print(f"{'='*50}")


if __name__ == "__main__":
    main()
