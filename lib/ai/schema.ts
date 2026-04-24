import { z } from 'zod'

export const cardSchema = z.object({
  number: z.number().int().min(0).max(13).describe('카드 번호 (0-13, 0=커버훅용 이미지 프롬프트)'),
  title: z.string().describe('카드 제목 - 구어체 헤드라인, 반말'),
  body: z.string().describe('카드 본문 - 2~3문장, 구어체, 반말'),
  image_prompt: z
    .string()
    .describe(
      'English only. One concrete figurative scene for 19th-c book-style engraving: visible figure(s) or silhouette, clear action, props, setting (sea, cliff, table, fire, etc.). Must visually echo this card’s theme. NOT abstract mood-only. NO proper names or place names from the book; use generic nouns only.'
    ),
  confidence: z.enum(['상', '중', '하']).describe('인사이트 신뢰도 - 상: 확실히 책 내용, 중: 대체로 맞음, 하: 재확인 필요'),
})

export const insightSchema = z.object({
  hook: z.string().describe('커버 훅 문구 - 도발적·호기심 자극, 예: "그리스인 조르바, 아직도 안읽었어요?"'),
  cards: z.array(cardSchema).length(14).describe('인사이트 카드 14장 (card_number 0~13)'),
  caption: z.string().describe('인스타그램 캡션 - 200~300자, 여운 남기는 마무리'),
  hashtags: z.array(z.string()).length(15).describe('해시태그 15개, # 포함'),
})

export type InsightOutput = z.infer<typeof insightSchema>
export type CardOutput = z.infer<typeof cardSchema>
