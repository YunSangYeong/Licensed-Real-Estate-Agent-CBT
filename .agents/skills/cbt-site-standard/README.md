# 다른 자격증 CBT용 표준 스킬

현재 전기기능사 CBT의 최종 구현을 표준으로 재사용하는 **CBT 전용 스킬 v1.4.0**이다. 기존 `verified-web-project`가 개발 절차 중심이었다면 이 스킬은 화면·기능·키보드·저장·문제은행·검증·요청받은 배포 진행 인수 기준까지 정한다.

- 기준 앱 커밋: `b9a682ccff1b460334b78d5bfad9375b7ec4fbb6` (2026-10-19)
- 문제은행 표준: 중복 제거 후 검수 완료 **1,000문항**. 사용자 명시 수량이 없으면 적용하며, 한 회 시험 문항 수와 구별한다. 검증 대기·개인 로컬 등록분은 제외하고 미달 수를 공개한다.
- 상단 안내 정책: 비공식·검증 대기·잠정 규칙 상시 배너를 만들지 않는다. 안내는 푸터·문제은행/출처 문서에 두고 실제 저장 오류 경고는 유지한다.
- 핵심 스킬: [SKILL.md](SKILL.md)
- 고정 기준: [references/reference-baseline.md](references/reference-baseline.md)
- 자격증 설정: [references/qualification-profile.template.json](references/qualification-profile.template.json)
- 검증 체크리스트: [references/acceptance-checklist.md](references/acceptance-checklist.md)
- AGENTS 연결: [references/AGENTS.template.md](references/AGENTS.template.md)
- 새 클라우드 프로젝트 요청: [references/new-project-prompt.md](references/new-project-prompt.md)

새 프로젝트에서는 이 폴더 전체를 `.agents/skills/cbt-site-standard/`에 복사하고 기존 AGENTS.md에 연결한다. 필요한 파일을 저장소에서 읽어 적용하는 방식이므로 로컬 다운로드나 계정 전체 스킬 등록이 필수는 아니다. 이 작업으로 계정 공통 스킬 설치나 새 클라우드 작업의 자동 인식을 검증한 것은 아니다.

표준은 학습 기준 드롭다운 없는 최종 화면, 두 모드 Space 이동, 타이머·복원·채점·해설·오답·북마크·통계·문제 관리·Pages 배포 준비를 포함한다. 배포까지 요청받으면 에이전트가 Git 반영과 배포를 진행하고, 사용자는 최초 Pages 설정·필수 승인만 지원한다. 원래 main push → 검증 → Pages 자동 배포 흐름을 사용하며 첫 차단/실패 뒤 재시도하지 않고 사용자에게 알린다. 배포 요청이 없거나 금지/수동 전용 지시가 있으면 실행하지 않는다. 문서/스킬만 바꿀 때나 제외된 다른 프로젝트도 수정·재배포하지 않는다. [이전 방식 재현 절차](references/deployment-workflow.md)를 따른다. 자격증별 규칙·문항은 따로 확인하며, 900개 전기 문제를 다른 분야에 그대로 복사하거나 900개 기출이 확보된 것처럼 표현하지 않는다. 스킬은 다른 자격증의 정답 정확성이나 자동으로 동일한 산출물이 만들어짐을 보증하지 않는다.

정책 변경 시 스킬 버전과 인수 명세를 갱신한다. 앱 코드 기준을 변경할 때만 기준 커밋도 갱신한다. 원본 사이트의 과거 배포·테스트 결과는 새 프로젝트의 증거가 아니다.

모바일 고정 메뉴는 작은 화면에서도 독립적으로 위·아래 스크롤되어야 한다. [필수 구현과 회귀 검증](references/mobile-menu-scroll.md)에 따라 390×480, 짧은 가로 화면, 글자 확대 및 실제 터치 입력을 확인하고 자동 검사를 남긴다.
