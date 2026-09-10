## 운영 서비스 보호 — 2026-09-10 장애 후 사용자 지시

- Ledger 작업에서 HeyBilly 코드, GAS, Vercel 배포, 업무 데이터, DB 권한, 공유 인증 설정을 변경하지 않는다.
- Supabase `village-ai` (`tedffwpijiylklfuzkua`)는 HeyBilly 운영 자원이다. Ledger 작업 재개/배포 요청은
  이 프로젝트의 설정 변경 허가가 아니다. Ledger 전용 표·함수도 임의로 추가·삭제하거나 다시 배포하지 않는다.
- 원복한 Google 공급자와 Ledger 반환 주소를 재활성화하지 않는다. 새 분리 구성은 사용자 승인 후 진행한다.
- 다른 기존 앱의 중지된 프로젝트도 빈 자원으로 취급하지 않는다. 새 조직·프로젝트 생성과 비용은 사전 확인한다.
- Ledger 로그아웃은 반드시 현재 세션만 종료한다(`scope: 'local'`). 기본 global 호출은 금지한다.
- 인증/동기화 설정 누락 시 HeyBilly 프로젝트로 자동 연결하는 기본값을 배포하지 않는다.
- 승인된 Ledger 전용 프로젝트는 `mbypanaxjuliucxsujea`(Free 조직 `yemqwfrlkuzojvjniolk`)다.
  모든 백엔드 변경 전 이 식별자를 확인한다. 2026-09-10 사용자는 「렛저 전용 사진 함수에만
  기본 JWT 검사를 끄고, 함수 내부의 서명·사용자 인증을 유지하는 배포」 승인 질문에 「ㄱㄱ」로 승인했다.
  이 승인은 위 전용 프로젝트의 `ledger-photos` 배포만 포함한다. Google 콜백 HMAC state 검증과
  모든 POST의 `auth.getUser(bearer)` 검증을 유지한다. 자동 심사에서 다시 거부되면 우회하지 않는다.
- 실제 글·사진 왕복과 새로고침 후 보존을 확인하기 전 동기화 완료라고 하지 않는다.
  390px/1280px 화면 확인과 물리적 두 기기 검증을 구별해 보고한다.

<!-- BEGIN OBSIDIAN CONTROL TOWER -->
## Obsidian Control Tower

이 프로젝트는 Obsidian 컨트롤 타워와 연결된다.

작업 시작 트리거:
- "작업 시작 하자"
- "작업 시작 하자."
- "지금 어디까지 했지?"
- "다음 뭐 할 차례야?"

작업 시작 시:
1. 이 프로젝트의 로컬 지침 파일을 읽는다.
2. `/Users/choijaehyeong/Documents/🧠 My_AI_Brain(Obsidian+RAG)/control-tower/projects.yml`에서 이 repo path에 맞는 프로젝트를 찾는다.
3. 등록된 프로젝트면 해당 `Wiki/Work` 페이지와 최근 session logs를 확인한다.
4. 등록되지 않은 git repo면 fallback 프로젝트로 취급하고, 종료 시 최소 `Wiki/Work/<project-slug>.md` 페이지를 생성할 준비를 한다.
5. git branch/status/latest commit을 확인한다.
6. Obsidian 상태와 git 상태가 다르면 차이를 보고한다.
7. 현재 상태, 다음 액션, 위험 신호를 짧게 말한다.

작업 종료 트리거:
- "작업 정리 하고 종료하자"
- "작업 정리 하고 종료하자."
- "옵시디언에 정리하고 끝내줘"

작업 종료 시:
1. git status와 최근 커밋을 확인한다.
2. 이번 세션의 작업, 검증, 결정, 다음 액션, 블로커를 정리한다.
3. 등록 여부와 무관하게 `Raw/Work/session-logs/<project-slug>/`에 session log를 남긴다.
4. 같은 종료 루틴에서 `Wiki/Work` 현재 상태와 활동 로그를 즉시 갱신한다.
5. 등록되지 않은 repo면 최소 `Wiki/Work/<project-slug>.md` 페이지를 생성한다.
6. 시크릿 값은 절대 기록하지 않고 위치만 남긴다.
<!-- END OBSIDIAN CONTROL TOWER -->
