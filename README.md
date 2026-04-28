# BookCards

책 한 권을 15장 카드뉴스로, 자동으로.

## 스택

- **Next.js 16** (App Router + TypeScript)
- **Tailwind CSS + shadcn/ui**
- **Supabase** (PostgreSQL + Storage)
- **Vercel AI SDK + AI Gateway** → Claude Sonnet 4.6
- **Replicate Flux** (기본: `flux-1.1-pro`, 환경변수로 모델 변경 가능)
- **Canvas API** (브라우저 합성, 1080×1350)
- **JSZip** (ZIP 다운로드)

## 셋업

### 1. 환경 변수 설정

`.env.local` 파일을 수정하세요:

```bash
NEXT_PUBLIC_SUPABASE_URL=        # Supabase 프로젝트 URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY=       # Supabase service role key
AI_GATEWAY_API_KEY=              # Vercel AI Gateway API key
REPLICATE_API_TOKEN=             # Replicate API token
# 선택: 이미지 모델 (기본 black-forest-labs/flux-1.1-pro)
# REPLICATE_IMAGE_MODEL=black-forest-labs/flux-schnell
# REPLICATE_IMAGE_MODEL=black-forest-labs/flux-2-pro
```

## Replicate 이미지 모델 (행동 가이드)

1. **Replicate 결제·크레딧**  
   [replicate.com/account/billing](https://replicate.com/account/billing) 에서 카드/크레딧 확인. 기본 `flux-1.1-pro`는 Schnell보다 비쌉니다.

2. **로컬 `.env.local`에서 다른 모델로 덮어쓰기**  
   ```bash
   # 예: 더 빠른 Schnell
   REPLICATE_IMAGE_MODEL=black-forest-labs/flux-schnell
   # 예: FLUX.2
   REPLICATE_IMAGE_MODEL=black-forest-labs/flux-2-pro
   ```  
   BFL 제품명과 Replicate **owner/model slug**는 다를 수 있습니다. [replicate.com/black-forest-labs](https://replicate.com/black-forest-labs) 에서 API 탭의 정확한 slug를 확인하세요.

3. **Vercel**  
   배포 환경에 `REPLICATE_IMAGE_MODEL`을 두면 코드 기본값을 덮어씁니다. 값을 비우거나 변수를 제거하면 앱 기본(`flux-1.1-pro`)이 적용됩니다.

4. **시간**  
   Pro 계열은 장당 생성이 더 걸립니다. API 라우트는 `generate-images` 600초, `regenerate-image` 120초로 여유를 두었습니다.

5. **검증**  
   텍스트 승인 → 이미지 생성 후 Replicate 4xx가 나오면 [flux-1.1-pro API](https://replicate.com/black-forest-labs/flux-1.1-pro/api)와 `lib/replicate.ts`의 `buildModelInput`을 비교합니다.

### Schnell vs FLUX.2 한 장씩 비교

같은 프롬프트로 두 모델 URL만 뽑아 비교할 때:

```bash
npm run compare-flux -- "여기에 전체 프롬프트 붙여넣기"
```

기본 프롬프트로 돌리려면 인자 없이 `npm run compare-flux` (레퍼런스용 샘플 문자열 사용).  
두 번째 모델을 바꾸려면 `FLUX2_MODEL=black-forest-labs/flux-2-max npm run compare-flux -- "..."`

### 2. Supabase DB 마이그레이션 (CLI 권장)

Vercel 배포만으로는 DB 스키마가 바뀌지 않습니다. **Supabase CLI**로 원격 DB에 `supabase/migrations/`를 적용하세요.

1. **CLI 설치** (레포에 devDependency로 포함됨)
   ```bash
   npm install
   ```
2. **로그인** (최초 1회)
   ```bash
   npx supabase login
   ```
3. **BookCards 프로젝트 연결**  
   [대시보드](https://supabase.com/dashboard) → 프로젝트 **Settings → General** 에서 **Project ID**(ref) 확인 후:
   ```bash
   npm run db:link -- --project-ref YOUR_PROJECT_REF
   ```
   DB 비밀번호를 물으면 해당 프로젝트 **Database → Database password** 를 입력합니다.
4. **마이그레이션 적용**
   ```bash
   npm run db:push:dry    # 적용될 파일만 확인 (선택) — 실제 SQL은 실행 안 함
   npm run db:push        # 원격 DB에 반영 (확인 프롬프트에서 Y)
   ```

**`db:push:dry`는 되는데 `db:push`만 실패할 때**

- **dry-run**: 목록만 출력하고 DB는 안 건드립니다.
- **에러 예:** `policy "card-images public read" ... already exists`  
  원격에 예전에 수동으로 만든 정책이 있는데, CLI는 아직 `0001`을 “미적용”으로 보고 다시 `CREATE POLICY`를 실행해서 나는 경우가 많습니다.
- **처리 (택1):**
  1. 레포 최신 `0001_init.sql`에는 정책 앞에 `DROP POLICY IF EXISTS`가 들어 있습니다. 한 번 `npm run db:push`를 다시 시도하세요.
  2. 이미 `0001`과 동일한 스키마가 다 있고 **`0002`(layout_json)만** 올리고 싶다면:  
     `npx supabase migration repair 0001 --status applied --linked`  
     다음 `npm run db:push` (이때는 `0002`만 적용됩니다).

적용 순서는 파일명 순입니다.

- `supabase/migrations/0001_init.sql` — 최초 스키마·스토리지 정책 (정책은 재실행 시에도 되도록 `DROP POLICY IF EXISTS` 포함)
- `supabase/migrations/0002_card_layout_json.sql` — `cards.layout_json`. **생략 시** 카드 PATCH에서 `PGRST204` 가 납니다.

**대시보드만 쓸 때:** SQL Editor에 위 파일 내용을 그대로 붙여 실행해도 동일합니다.

### 3. 개발 서버

```bash
npm run dev
```

### 4. Vercel 배포

```bash
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add AI_GATEWAY_API_KEY
vercel env add REPLICATE_API_TOKEN
vercel env add REPLICATE_IMAGE_MODEL   # 선택: 기본값 덮어쓰기 (미설정 시 flux-1.1-pro)
vercel deploy --prod
```

## 사용 흐름

1. **화면 1**: 책 제목 입력 → 생성 버튼
2. **화면 2**: AI가 추출한 14장 인사이트 텍스트 검수/편집 → 승인
3. **화면 3**: 생성된 이미지 + 합성 카드 확인 → ZIP 다운로드

## 비용 (건당)

| 항목 | 비용 |
|---|---|
| Claude API (텍스트) | ~$0.05 |
| Replicate Flux (14장) | ~$0.15 |
| 재생성 (평균) | ~$0.05 |
| **총계** | **~$0.25** |
