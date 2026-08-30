# 채널톡 AI 자동응답 챗봇 (테스트)

고객이 채널톡으로 문의하면 → 웹훅으로 실시간 수신 → Claude가 `knowledge/` 지식베이스 기반으로 답변 생성 → 봇 명의로 자동 응답하는 프로토타입.

## 구조

```
채널톡 고객 메시지
  → 웹훅 POST /api/webhook (app/api/webhook/route.ts)
  → 대화 이력 조회 (lib/channeltalk.ts → fetchHistory)
  → Claude 답변 생성 (lib/ai.ts, knowledge/*.md 참고)
  → 봇 메시지 전송 (lib/channeltalk.ts → sendBotMessage)
  → 답변 불가/민감 사안이면 상담원 연결 (openUserChat)
```

## 실행 순서

1. `.env` 에 키 입력 (`.env.example` 참고)
   - `ANTHROPIC_API_KEY`, `CHANNELTALK_ACCESS_KEY/SECRET`
   - `CHANNELTALK_WEBHOOK_TOKEN` — 아무 랜덤 문자열
   - `TEST_USER_NAME` — 채널톡에 표시되는 본인 고객 이름 (이 이름에만 자동 응답)
2. 개발 서버: `npm run dev` (localhost:3000)
3. 터널: `cloudflared tunnel --url http://localhost:3000` → 출력된 `https://xxxx.trycloudflare.com` 복사
4. 웹훅 등록: `node --env-file=.env scripts/register-webhook.mjs https://xxxx.trycloudflare.com`
5. 채널톡 위젯/앱에서 본인 계정으로 문의 메시지 전송 → 봇 자동 응답 확인

## 안전장치

- `TEST_USER_NAME` 과 일치하는 고객에게만 응답 (운영 채널에서 고객 노출 차단)
- 웹훅 URL에 토큰 포함 — 토큰 불일치 요청은 401
- 메시지 ID 기반 중복 처리 방지
- AI가 답할 수 없는 문의는 `[[상담원연결]]` 마커 → 상담 미답변 큐로 전환

## 지식베이스

`knowledge/*.md` 에 FAQ/매뉴얼을 넣으면 AI가 답변 근거로 사용. 파일 수정 시 자동 반영.

## CX 대시보드

`/dashboard` — 구글시트 "CX_OB요청_관리_퍼포먼스_트래킹"과 30초마다 자동 동기화되는 실시간 대시보드.
일/주/월별 요청 추이, 문의유형·처리상태·담당자별 건수/비율, 담당자별 평균 응답속도·해결시간(KPI),
'확인 중' 상태 건의 메시지 링크를 확인할 수 있다.

- 시트를 **파일 > 공유 > 웹에 게시**로 CSV 게시해두면, `app/api/dashboard-data/route.ts`가 이를 폴링해서 대시보드 데이터를 만든다.
- 게시 링크가 바뀌면 `CX_TRACKING_SHEET_CSV_URL` 환경변수로 덮어쓸 수 있다 (`lib/sheetData.ts` 참고).
