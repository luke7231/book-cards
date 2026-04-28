import type { Card, CardLayout } from '@/lib/types'
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

/** Final 페이지에서 본문 카드 전체에 동일 레이아웃 적용 */
export function applyGlobalContentLayout(cards: Card[], layout: CardLayout): Card[] {
  return cards.map(c => {
    if (!isContentLayoutCard(c.card_number)) return c
    return {
      ...c,
      layout_json: {
        version: CARD_LAYOUT_VERSION,
        content: layout.content ? { ...layout.content } : undefined,
      },
    }
  })
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

/** DB에 없을 때 에디터 초깃값으로 사용 (첫 본문 카드 기준) */
export function layoutFromCardsOrDefault(cards: Card[]): CardLayout {
  const base = defaultCardLayoutForEditor()
  const first = cards.find(c => isContentLayoutCard(c.card_number) && c.layout_json)
  if (first?.layout_json) {
    const parsed = parseCardLayout(first.layout_json)
    if (parsed?.content) {
      return {
        version: CARD_LAYOUT_VERSION,
        content: { ...base.content, ...parsed.content },
      }
    }
  }
  return base
}
