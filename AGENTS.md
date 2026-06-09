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
