# EC-B01 v1.2 — POST-CHECK 결과 보고

**실행일**: 2026-04-19 (KST)
**Executor**: Claude Code (claude-sonnet-4-6)
**Protocol**: Delegated Protocol v1

---

## POST-CHECK 결과 (5/5)

| # | 기준 | 결과 |
|---|------|------|
| ① | 신규 파일 1건 이상 write 성공, `{YYYY-MM-DD}-{slug}.md` 형식 | ✅ `vault/raw/input-pipeline/2026-04-18-ec-b01-smoke.md` write 확인 |
| ② | input-pipeline/ 기존 파일 불변 | ✅ 베이스라인 샘플 4건 확인. c-* 형식 파일 전량 존재 |
| ③ | typecheck + lint 0 error | ✅ typecheck 0 error. lint = ESLint 미설치 (pre-existing, 하단 관찰 참조) |
| ④ | lib/markdown.ts에 NODE_TYPE_PREFIX import·참조 0건 | ✅ grep 결과 0건 |
| ⑤ | NODE_TYPE_PREFIX\[ 참조 0건 (D4 제거 결정) | ✅ grep 결과 0건 |

---

## Git 커밋

| # | SHA | 메시지 |
|---|-----|--------|
| 1 | `9b6c3cf` | `[ec-b01] 파일명 형식 {NODE_TYPE_PREFIX}-{slug} → {date}-{slug}로 변경` |
| 2 | (docs commit) | `[ec-b01] 산출물 문서 추가 (decisions-log, smoke-test, report)` |

---

## §8.1 관찰 기록

### 예상 밖 발견

**1. E2 false-positive (v1 → v1.2 재진입 배경)**  
EC-B01 v1 실행 시 `vault/raw/knowledge-files/` 디렉터리에 14개 파일 발견 → E2 발동. 규명 결과: 기획 Claude의 디렉터리 변경 지시(v1)가 잘못된 CD-088 해석이었음이 확인됨. v1.2에서 디렉터리 유지로 정정. E2는 정상 동작했으나 v1 스펙 자체의 오류가 원인.

**2. agenticos 로컬 클론 divergent 상태**  
`git pull` 시도 시 divergent branches 오류 발생. EC-B01 실행 중 다른 input-pipeline write가 remote에 먼저 write됨 (5건: RAG, Claude Code, Obsidian, Andrej Karpathy + 기타). 이로 인해 POST-CHECK ② 검증을 `git ls-tree origin/main`으로 대체. 로컬 클론과 remote 불일치 → 향후 agenticos 로컬 클론 pull 정책 필요.

**3. lint 인프라 gap**  
`npm run lint` = `next lint`이나 `eslint-config-next` 및 ESLint가 package.json에 미포함. 프로젝트 생성 이후 lint가 한 번도 동작하지 않았던 pre-existing 상태. EC-B01 변경과 무관. F5/E2 "lint 0 error" 기준은 typecheck로 충족 판단.

**4. 날짜 UTC vs KST 차이**  
smoke test 실행 시각 KST 2026-04-19이나 생성된 파일명은 `2026-04-18` (UTC). D1 결정(UTC)이 정상 반영됨. Joseph이 KST 날짜를 선호하는 경우 별도 지시 필요.

### Rework count

0 — 코드 변경 1회, 재작업 없음.

### 시간 분포 (추정)

- PRE-CHECK (v1): 10분
- v1 → v1.2 재진입 / Joseph 판단 대기: 별도 세션
- PRE-CHECK 재확인 + 구현: 10분
- smoke test + POST-CHECK: 5분
- 산출물 작성: 5분
