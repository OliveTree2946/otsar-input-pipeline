# EC-B01 Smoke Test 결과

**실행일**: 2026-04-19 (KST) / 2026-04-18 (UTC)
**범위**: D5 결정 — concept 1건 (대표)

## 테스트 요청

```json
{
  "sourceType": "memo",
  "sourceUrl": "test://ec-b01-smoke",
  "parseResult": {
    "importance": 3,
    "summary": "EC-B01 smoke test — 파일명 형식 검증",
    "nodes": [{
      "id": "concept-ec-b01-smoke",
      "type": "concept",
      "label": "EC-B01 smoke test",
      "description": "파일명 형식 YYYY-MM-DD-{slug}.md 검증용 테스트 노드",
      "tags": ["ec-b01", "smoke-test"]
    }],
    "edges": []
  }
}
```

## 결과

| 항목 | 값 |
|------|-----|
| HTTP 상태 | 200 OK |
| 생성 경로 | `vault/raw/input-pipeline/2026-04-18-ec-b01-smoke.md` |
| GitHub URL | https://github.com/OliveTree2946/agenticos/blob/main/vault/raw/input-pipeline/2026-04-18-ec-b01-smoke.md |
| 파일명 형식 | `{YYYY-MM-DD}-{slug}.md` ✅ |
| 디렉터리 | `vault/raw/input-pipeline/` (변경 없음) ✅ |
| skipped | false (신규 write) ✅ |

## 파일 내용 확인

```markdown
---
id: concept-ec-b01-smoke
type: concept
source_type: memo
created: 2026-04-18
importance: 3
source_url: test://ec-b01-smoke
pipeline_version: 1
---
# EC-B01 smoke test

파일명 형식 YYYY-MM-DD-{slug}.md 검증용 테스트 노드

tags: #ec-b01 #smoke-test
```

## 판정

✅ PASS — 신규 파일명 형식 `{YYYY-MM-DD}-{slug}.md` 정상 동작 확인
