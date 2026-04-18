# EC-B01 v1.2 — Decisions Log

## D1. {date} 생성 시점과 타임존

**OBSERVED**: `app/api/save/route.ts:30` — `createdISODate = new Date().toISOString().slice(0, 10)` 이미 UTC 기반 YYYY-MM-DD 형식으로 존재. `timestampSuffix()`도 `getUTC*()` 메서드 사용 (UTC 기반).

**OPTIONS**:
- (a) UTC — `new Date().toISOString().slice(0, 10)` 그대로 사용
- (b) KST — UTC+9 오프셋 계산 후 slice

**DECIDED**: UTC (a)

**REASON**: `timestampSuffix()`와 `createdISODate` 모두 이미 UTC 기반. 일관성 유지. KST 전환 시 오프셋 계산 추가 복잡도 발생하며, 기존 frontmatter `created:` 필드도 UTC ISO string 사용 중.

---

## D2. 동일 {date}-{slug} 충돌 처리

**OBSERVED**: `lib/github.ts:130` — `existing.kind === "exists"` 시 `altPathIfExists`로 폴백. `route.ts:47` — `altPath = vaultPathForNode(node, createdISODate, suffix)` where suffix = `timestampSuffix()`.

**OPTIONS**:
- (a) 기존 write-alt 메커니즘 그대로 사용 — alt path가 `{date}-{slug}-{timestampSuffix}.md`
- (b) 별도 충돌 감지 로직 추가

**DECIDED**: 기존 write-alt 메커니즘 그대로 유지 (a)

**REASON**: v1.2 변경 후에도 primaryPath=`{date}-{slug}.md`, altPath=`{date}-{slug}-{timestampSuffix}.md` 패턴이 자연스럽게 성립. github.ts 수정 불필요. F3(suffix 파라미터 보존) 준수.

---

## D3. vaultPathForNode 시그니처 변경 방식

**OBSERVED**: `vaultPathForNode` 호출부: `app/api/save/route.ts` 2곳 (line 46, 47). `lib/claude-parser.ts`는 호출 없음.

**OPTIONS**:
- (a) `date: string` 파라미터 추가 → `vaultPathForNode(node, date, suffix?)`
- (b) `ctx: RenderContext` 통째로 받기 → `vaultPathForNode(node, ctx, suffix?)`

**DECIDED**: Option (a) — date 파라미터 추가

**REASON**: 호출부 2곳만 존재. `vaultPathForNode`는 경로 생성 순수 함수 — RenderContext 전체 의존성 주입은 과잉. `createdISODate`는 route.ts 스코프에 이미 존재하므로 전달 단순.

---

## D4. NODE_TYPE_PREFIX 테이블 제거 여부

**OBSERVED**: PRE-CHECK 결과 — `NODE_TYPE_PREFIX` 참조: `lib/markdown.ts` 내 `vaultPathForNode`에서만 사용. 타 파일 참조 없음. `lib/types.ts:45-51`에 정의.

**OPTIONS**:
- (a) 제거 — `lib/types.ts`에서 상수 삭제, `lib/markdown.ts`에서 import 삭제
- (b) 유지 — 미래 사용 가능성 보존

**DECIDED**: 제거 (a)

**REASON**: vaultPathForNode에서 더 이상 사용 안 함. 다른 참조 없음. 미사용 상수 보존은 코드 오해 유발. `NodeType` 타입은 `NODE_TYPES` 배열에서 derived되므로 별도 유지.

---

## D5. 수동 smoke test 범위

**OBSERVED**: NodeType = concept / person / tool / idea / event. 개발 서버 로컬 실행 필요.

**OPTIONS**:
- (a) 대표 1건 (concept) — 경로 형식 검증에 충분
- (b) 5 NodeType 각 1건 — 전체 커버리지

**DECIDED**: 대표 1건 concept (a)

**REASON**: 파일명 형식 변경은 NodeType 독립적 (`slugifyId` 로직 동일). concept 1건으로 `{date}-{slug}.md` 형식 검증 충분. 5건 반복은 추가 정보 없음.
