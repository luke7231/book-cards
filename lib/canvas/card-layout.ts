import type { Card, CardLayout, CardLayoutContent } from '@/lib/types'
import { CARD_LAYOUT_VERSION } from '@/lib/types'

export { CARD_LAYOUT_VERSION }

export function isContentLayoutCard(cardNumber: number): boolean {
  return cardNumber >= 1 && cardNumber <= 12
}

export function parseCardLayout(raw: unknown): CardLayout | null {
  if (raw == null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.version !== CARD_LAYOUT_VERSION) return null
  return raw as CardLayout
}

/** 전역 레이아웃 편집기에서 쓰는 필드만 (textPanel 제외) */
export function pickGlobalLayoutFields(
  content: CardLayoutContent | undefined
): Partial<CardLayoutContent> {
  if (!content) return {}
  const out: Partial<CardLayoutContent> = {}
  if (content.panelOutsetX !== undefined) out.panelOutsetX = content.panelOutsetX
  if (content.panelOutsetY !== undefined) out.panelOutsetY = content.panelOutsetY
  if (content.border !== undefined) out.border = content.border
  if (content.watermarkBottom !== undefined) out.watermarkBottom = content.watermarkBottom
  return out
}

/**
 * DB에 저장할 때: 전역(여백·테두리·워터마크)은 덮어쓰고, 카드별 textPanel은 유지
 */
export function mergeGlobalLayoutForPersist(
  global: CardLayout,
  existingLayout: CardLayout | null
): CardLayout {
  const ex = existingLayout?.content ? { ...existingLayout.content } : {}
  const g = pickGlobalLayoutFields(global.content)
  const textPanel = ex.textPanel
  return {
    version: CARD_LAYOUT_VERSION,
    content: {
      ...ex,
      ...g,
      textPanel,
    },
  }
}

/** 합성용: 카드 한 장에 전역 + 해당 카드 layout_json 병합 */
export function mergeCardWithGlobalLayout(global: CardLayout | null, card: Card): Card {
  if (!global || !isContentLayoutCard(card.card_number)) return card
  const merged = mergeGlobalLayoutForPersist(global, parseCardLayout(card.layout_json))
  return { ...card, layout_json: merged }
}

export function defaultCardLayoutForEditor(): CardLayout {
  return {
    version: CARD_LAYOUT_VERSION,
    content: {
      panelOutsetX: 44,
      panelOutsetY: 40,
      border: { width: 2, color: '#111111' },
      watermarkBottom: 24,
    },
  }
}

/** DB에 없을 때 에디터 초깃값 (첫 본문 카드에서 가져올 때 textPanel은 제외) */
export function layoutFromCardsOrDefault(cards: Card[]): CardLayout {
  const base = defaultCardLayoutForEditor()
  const first = cards.find(c => isContentLayoutCard(c.card_number) && c.layout_json)
  if (first?.layout_json) {
    const parsed = parseCardLayout(first.layout_json)
    if (parsed?.content) {
      const { textPanel: _tp, ...rest } = parsed.content
      return {
        version: CARD_LAYOUT_VERSION,
        content: { ...base.content, ...rest },
      }
    }
  }
  return base
}
