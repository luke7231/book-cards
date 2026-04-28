export const CARD_LAYOUT_VERSION = 1 as const

export interface CardLayoutBorder {
  width: number
  color: string
}

/** 고정 패널 직사각형 (에디터·고급 오버라이드) */
export interface CardLayoutTextPanel {
  x: number
  y: number
  width: number
  height: number
  background?: string
  border?: CardLayoutBorder | null
}

export interface CardLayoutContent {
  /** 카드 가장자리 ↔ 패널 사이 가로 여백 */
  panelOutsetX?: number
  /** 카드 가장자리 ↔ 패널 사이 세로 여백(상단·하단 앵커 모두) */
  panelOutsetY?: number
  /**
   * 테두리. `null`이면 테두리 없음. 생략 시 컴포저 기본(얇은 검정선).
   */
  border?: CardLayoutBorder | null
  /** 워터마크 baseline: 캔버스 하단에서 위로 px */
  watermarkBottom?: number
  /** 지정 시 inset 대신 이 사각형 사용(높이는 내용보다 작으면 내용 높이로 확장) */
  textPanel?: CardLayoutTextPanel
}

export interface CardLayout {
  version: typeof CARD_LAYOUT_VERSION
  content?: CardLayoutContent
}

export interface Project {
  id: string
  book_title: string
  style: string
  brand_name?: string
  status: 'draft' | 'text_approved' | 'images_generated' | 'completed'
  hook_text?: string
  caption?: string
  hashtags?: string
  created_at: string
}

export interface Card {
  id: string
  project_id: string
  card_number: number
  title: string
  body: string
  image_prompt: string
  confidence: '상' | '중' | '하'
  image_url?: string
  composed_url?: string
  /** 합성 레이아웃 오버라이드 (본문 카드 1–12) */
  layout_json?: CardLayout | null
  created_at: string
}

export const STYLE_OPTIONS = [
  { value: 'engraving', label: '판화풍 (기본)' },
  { value: 'watercolor', label: '수채화풍' },
  { value: 'monochrome', label: '모노크롬' },
] as const
