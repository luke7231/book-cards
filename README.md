# BookCards

책 한 권을 15장 카드뉴스로, 자동으로.

## 스택

- **Next.js 16** (App Router + TypeScript)
- **Tailwind CSS + shadcn/ui**
- **Supabase** (PostgreSQL + Storage)
- **Vercel AI SDK + AI Gateway** → Claude Sonnet 4.6
- **Replicate Flux Schnell** (이미지 생성)
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
```

### 2. Supabase DB 마이그레이션

Supabase 대시보드 SQL Editor에서 `supabase/migrations/0001_init.sql` 내용을 실행하세요.

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
