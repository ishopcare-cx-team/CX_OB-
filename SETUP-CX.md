# CX팀 인수·셋업 가이드

이 봇을 **CX팀이 자체적으로 운영**하기 위한 셋업 문서입니다.
태림님(원 운영자)의 Vercel·키·시트와 **완전히 분리**해서, 비용·장애·책임이 CX팀 쪽에만 격리되도록 구성합니다.

> 핵심 원칙: zip이 아니라 **git 저장소**로 받고, **계정·키는 전부 CX팀 명의로 새로 발급**합니다.
> 태림님 키/Vercel은 절대 재사용하지 않습니다 (재사용 시 비용이 태림님에게 청구되고, 유출 책임도 태림님에게 남습니다).

---

## 0. 사전 준비물 (CX팀이 만들 계정)

| 계정 | 용도 | 비용 |
|------|------|------|
| **GitHub** | 코드 저장소 | 무료 |
| **Vercel** | 봇 호스팅·배포 | 무료 플랜 가능 (트래픽 늘면 유료) |
| **Anthropic Console** | AI 응답 | **쓴 만큼 과금** (지출 한도 설정 필수) |
| **채널톡** | 고객 메시지 웹훅 | 채널톡 요금제에 따름 |
| **구글 계정** | 템플릿 시트 + Apps Script | 무료 |

> ⚠️ **개발 리소스 전제**: 코드(Next.js/TypeScript) 수정은 AI 도구(Claude Code 등)나 개발자가 필요합니다.
> 단순 "답변 문구"만 바꿀 거면 코드는 손댈 필요 없고 **3번(구글시트)만** 쓰면 됩니다.

---

## 1. 코드 받기 (GitHub)

1. 태림님이 만든 GitHub 저장소를 CX팀 계정으로 **이관(Transfer)** 받거나 **Fork** 합니다.
2. `.env`는 저장소에 **포함되지 않습니다**(`.gitignore` 처리). 키는 아래 4번에서 Vercel에 직접 입력합니다.

---

## 2. AI·채널톡 키 발급 (전부 CX팀 명의)

### Anthropic API 키
1. https://console.anthropic.com 에서 **CX팀 계정 생성 + 결제카드 등록**
2. **Billing → Limits 에서 월 지출 한도(spend limit) 반드시 설정** ← 비용 폭탄 방지
3. API Keys 에서 키 발급 → `ANTHROPIC_API_KEY` 로 사용

### 채널톡 키
1. 채널톡 관리자 → 개발자 → API 관리에서 `ACCESS_KEY` / `ACCESS_SECRET` 발급
2. 봇 표시 이름(`CHANNELTALK_BOT_NAME`) 정하기

### 자체 생성 토큰 (아무 랜덤 문자열)
- `CHANNELTALK_WEBHOOK_TOKEN` — 웹훅 URL 검증용
- `SYNC_TOKEN` — 구글시트 [챗봇 배포] 버튼 인증용

---

## 3. Vercel 배포 (CX팀 계정)

1. Vercel 에서 **CX팀 팀(team) 생성**
2. New Project → 1번의 GitHub 저장소 import
3. **Environment Variables**에 키 입력 (`.env.example` 항목 전체):
   - `ANTHROPIC_API_KEY`, `CHANNELTALK_ACCESS_KEY`, `CHANNELTALK_ACCESS_SECRET`
   - `CHANNELTALK_BOT_NAME`, `CHANNELTALK_WEBHOOK_TOKEN`, `SYNC_TOKEN`
   - `TEST_USER_NAME` — **처음엔 반드시 테스트용 이름으로 설정** (실고객 노출 차단). 충분히 검증 후 비웁니다.
4. **Storage → Blob 스토어 생성·연결** (지식베이스 저장용. 연결 시 `BLOB_READ_WRITE_TOKEN` 자동 주입)
5. Deploy → 배포 주소 확인 (예: `https://cx-chatbot.vercel.app`)

> 이후 CX팀이 코드를 고치고 `git push` 하면 **Vercel이 자동 배포**합니다.

---

## 4. 채널톡 웹훅 연결

배포 주소가 나오면 웹훅을 등록합니다.

```
node --env-file=.env scripts/register-webhook.mjs https://<CX팀_배포주소>
```

또는 채널톡 관리자에서 웹훅 URL을 직접 등록:
`https://<CX팀_배포주소>/api/webhook?token=<CHANNELTALK_WEBHOOK_TOKEN>`

---

## 5. 구글시트(답변 템플릿) 연결 — 답변 수정의 핵심

봇이 하는 **말(답변 문구)**은 전부 이 시트에서 나옵니다. 코드 수정 없이 CX팀이 직접 바꾸는 부분입니다.

1. CX팀 구글시트 생성. 컬럼 구조:
   `A=No, B=대분류, C=중분류, D=소분류, E=템플릿명, F=내용, G=링크, H=비고, I=개별규칙, J=공통규칙, K=태그`
2. `scripts/apps-script-챗봇배포.js` 를 시트의 **확장 프로그램 → Apps Script**에 붙여넣기
3. 파일 상단 3개 값을 CX팀 환경으로 교체:
   - `SYNC_URL` 의 `<배포도메인>` → CX팀 Vercel 주소
   - `SYNC_URL` 의 `<SYNC_TOKEN>` → 3번에서 넣은 `SYNC_TOKEN` 과 동일하게
   - `SPREADSHEET_ID`, `SHEET_GID` → CX팀 시트 URL에서 확인 (`/d/`와 `/edit` 사이 = ID, URL 끝 `gid=` = GID)
4. 저장 → 시트 새로고침 → 상단 `[🤖 챗봇]` 메뉴 생성
5. 시트 수정 후 `[🤖 챗봇 → 템플릿 배포]` 클릭 → **1분 내 봇에 반영**

### 시트 사용 규칙 (CX 운영자용)
- **F열(내용)** = 봇이 실제로 하는 말. 여기를 고치면 답변이 바뀝니다.
- **셀에 취소선(삭선)** = 그 템플릿/링크 자동 제외 (지우지 않고 잠깐 끄기)
- 전화번호·금액·URL은 **시트에 적힌 글자 그대로만** 봇이 사용 → 오타 = 그대로 오안내, 주의

---

## 6. 운영 시 주의 (CX팀 책임 영역)

- **비용**: AI는 호출당 과금. Anthropic 지출 한도 + 모델 선택(`AI_MODEL`을 `claude-sonnet-4-6`으로 낮추면 비용↓)으로 관리.
- **장애**: 코드를 잘못 고쳐 배포하면 봇이 멈춰 **고객 응대 전체가 중단**됩니다. 배포 전 Vercel **Preview(미리보기) 배포**에서 먼저 확인 후 Production 반영을 권장합니다.
- **롤백**: 문제가 생기면 Vercel 대시보드에서 직전 정상 배포로 **Instant Rollback** 가능.
- **키 관리**: 키는 코드/시트에 절대 적지 말고 **Vercel 환경변수에만**. 유출 의심 시 즉시 재발급.

---

## 분리 체크리스트 (인수 완료 기준)

- [ ] GitHub 저장소가 CX팀 소유
- [ ] Vercel 프로젝트가 CX팀 팀(team)에 있음
- [ ] `ANTHROPIC_API_KEY`가 CX팀 계정 + 지출 한도 설정됨
- [ ] 채널톡 키가 CX팀 채널 것
- [ ] 구글시트가 CX팀 것이고 Apps Script 3개 값 교체 완료
- [ ] 태림님 키/Vercel/시트는 하나도 재사용하지 않음
