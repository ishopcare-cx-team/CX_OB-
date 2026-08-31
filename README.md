# CX OB 요청 트래킹 대시보드

구글시트 "CX_OB요청_관리_퍼포먼스_트래킹"과 30초마다 자동으로 동기화되는 실시간 대시보드.

## 구조

```
구글시트 (웹에 게시된 CSV)
  ← 30초마다 폴링 GET /api/dashboard-data (app/api/dashboard-data/route.ts)
  ← 파싱·정규화 (lib/sheetData.ts)
  → 화면 렌더 (app/page.tsx, lib/dashboardStats.ts, components/dashboard/*)
```

## 실행 순서

1. 의존성 설치: `npm install`
2. 개발 서버: `npm run dev` → `http://localhost:3000`

시트가 바뀌었거나 다른 시트를 연결해야 하면 `CX_TRACKING_SHEET_CSV_URL` 환경변수로 CSV 게시 링크를 지정한다 (미설정 시 `lib/sheetData.ts`의 기본값 사용). 시트는 **파일 > 공유 > 웹에 게시**로 CSV 게시해둬야 한다.

## 화면 구성

- 상단 KPI: 총 요청, 완료율, 미해결, 평균 응답속도, 평균 해결시간, 담당자 수
- 요청 건수 추이 (일/주/월별 토글) + 처리상태 분포
- "확인 중" 상태 건의 메시지 링크 목록
- **문의유형별 분석** 탭: 유형별 건수·비율, 유형×상태 교차표, 유형별 평균 응답속도/해결시간
- **CX 담당자별 처리 현황** 탭: 담당자별 건수·비율, 상세 테이블, 담당자별 평균 응답속도/해결시간
- 최근 요청 목록 (기본 10건, 펼치기 가능)
- 기간(프리셋/직접 지정)·문의유형·상태·담당자·검색어 필터

## 배포

Vercel 권장. 저장소를 import 하고 별도 환경변수 설정 없이 바로 배포 가능 (시트 CSV 링크가 코드에 기본값으로 들어 있음). 다른 시트를 쓰려면 `CX_TRACKING_SHEET_CSV_URL`만 추가하면 된다.
