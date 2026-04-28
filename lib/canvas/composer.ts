import type { Card, CardLayoutBorder, CardLayoutContent, CardLayoutTextPanel, Project } from '@/lib/types'
import { parseCardLayout } from '@/lib/canvas/card-layout'

const CARD_WIDTH = 1080
const CARD_HEIGHT = 1350
const PAD_X = 52 // 텍스트 박스 좌우 내부 여백
const PAD_TOP = 44 // 텍스트 박스 상단 내부 여백
const PAD_BOT = 48 // 텍스트 박스 하단 내부 여백
const TITLE_BODY_GAP = 22 // 제목-본문 사이 간격

const DEFAULT_PANEL_OUTSET_X = 44
const DEFAULT_PANEL_OUTSET_Y = 40
const DEFAULT_PANEL_BORDER: CardLayoutBorder = { width: 2, color: '#111111' }
const DEFAULT_WATERMARK_BOTTOM = 24

const TITLE_FONT = `bold 58px Pretendard, "Noto Sans KR", sans-serif`
const BODY_FONT = `400 28px Pretendard, "Noto Sans KR", sans-serif`
const TITLE_LINE_H = 70
const BODY_LINE_H = 42

interface ComposerConfig {
  card: Card
  project: Project
  isCover?: boolean
  isEnding?: boolean
}

/** 짝수 카드 → 상단 (커버 0 제외), 홀수 → 하단 */
function isBoxOnTop(cardNumber: number): boolean {
  return cardNumber % 2 === 0 && cardNumber !== 0
}

function mergeContentBorder(c?: CardLayoutContent): CardLayoutBorder | null {
  if (c?.border === null) return null
  if (c?.border && c.border.width > 0) return c.border
  if (c?.border && c.border.width <= 0) return null
  return DEFAULT_PANEL_BORDER
}

function resolveTextPanelBorder(
  c: CardLayoutContent | undefined,
  tp: CardLayoutTextPanel
): CardLayoutBorder | null {
  if (tp.border !== undefined) {
    if (tp.border === null) return null
    if (tp.border.width > 0) return tp.border
    return null
  }
  return mergeContentBorder(c)
}

function isFullTextPanel(tp: CardLayoutTextPanel | undefined): tp is CardLayoutTextPanel {
  if (!tp) return false
  const { x, y, width, height } = tp
  return [x, y, width, height].every(
    n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && width > 0 && height > 0
  )
}

// 텍스트를 실제로 그리지 않고 높이만 측정
function measureWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  lineHeight: number
): number {
  const words = text.split(' ')
  let line = ''
  let lines = 1

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word
    if (ctx.measureText(testLine).width > maxWidth && line) {
      lines++
      line = word
    } else {
      line = testLine
    }
  }
  return lines * lineHeight
}

// 텍스트를 그리고 끝 Y를 반환
function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  align: 'left' | 'center' = 'left'
): number {
  const words = text.split(' ')
  let line = ''
  let currentY = y
  const drawX = align === 'center' ? x : x

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, drawX, currentY)
      line = word
      currentY += lineHeight
    } else {
      line = testLine
    }
  }
  if (line) {
    ctx.fillText(line, drawX, currentY)
    currentY += lineHeight
  }
  return currentY
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

export async function composeCard(config: ComposerConfig): Promise<Blob> {
  await document.fonts.ready

  const { card, project, isCover, isEnding } = config

  const canvas = document.createElement('canvas')
  canvas.width = CARD_WIDTH
  canvas.height = CARD_HEIGHT
  const ctx = canvas.getContext('2d')!

  // 배경 이미지 cover-fit
  if (card.image_url) {
    try {
      const img = await loadImage(card.image_url)
      const scale = Math.max(CARD_WIDTH / img.width, CARD_HEIGHT / img.height)
      const w = img.width * scale
      const h = img.height * scale
      ctx.drawImage(img, (CARD_WIDTH - w) / 2, (CARD_HEIGHT - h) / 2, w, h)
    } catch {
      ctx.fillStyle = '#2a1f14'
      ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)
    }
  } else {
    ctx.fillStyle = '#2a1f14'
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)
  }

  if (isCover) {
    drawCoverLayout(ctx, card, project)
  } else if (isEnding) {
    drawEndingLayout(ctx, card, project)
  } else {
    drawContentLayout(ctx, card, project)
  }

  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob!), 'image/jpeg', 0.92)
  })
}

// ─── 본문 카드: 텍스트 높이 측정 → 박스 동적 결정 ─────────────
function drawContentLayout(ctx: CanvasRenderingContext2D, card: Card, project: Project) {
  const onTop = isBoxOnTop(card.card_number)
  const layout = parseCardLayout(card.layout_json ?? null)
  const c = layout?.content

  const titleText = `${card.card_number}. ${card.title}`

  let panelX: number
  let panelY: number
  let panelW: number
  let panelH: number
  let textMaxW: number
  let panelBorder: CardLayoutBorder | null
  const tp = c?.textPanel

  if (isFullTextPanel(tp)) {
    panelX = tp!.x
    panelW = tp!.width
    textMaxW = Math.max(8, panelW - PAD_X * 2)
    ctx.font = TITLE_FONT
    const titleH = measureWrappedText(ctx, titleText, textMaxW, TITLE_LINE_H)
    ctx.font = BODY_FONT
    const bodyH = measureWrappedText(ctx, card.body, textMaxW, BODY_LINE_H)
    const contentH = PAD_TOP + titleH + TITLE_BODY_GAP + bodyH + PAD_BOT
    panelH = Math.max(tp!.height, contentH)
    panelY = tp!.y
    panelBorder = resolveTextPanelBorder(c, tp!)
  } else {
    const outsetX = c?.panelOutsetX ?? DEFAULT_PANEL_OUTSET_X
    const outsetY = c?.panelOutsetY ?? DEFAULT_PANEL_OUTSET_Y
    panelX = outsetX
    panelW = CARD_WIDTH - 2 * outsetX
    textMaxW = Math.max(8, panelW - PAD_X * 2)
    ctx.font = TITLE_FONT
    const titleH = measureWrappedText(ctx, titleText, textMaxW, TITLE_LINE_H)
    ctx.font = BODY_FONT
    const bodyH = measureWrappedText(ctx, card.body, textMaxW, BODY_LINE_H)
    panelH = PAD_TOP + titleH + TITLE_BODY_GAP + bodyH + PAD_BOT
    panelY = onTop ? outsetY : CARD_HEIGHT - panelH - outsetY
    panelBorder = mergeContentBorder(c)
  }

  const bg =
    isFullTextPanel(tp) && tp!.background !== undefined ? tp!.background! : '#ffffff'
  ctx.fillStyle = bg
  ctx.fillRect(panelX, panelY, panelW, panelH)

  if (panelBorder) {
    ctx.strokeStyle = panelBorder.color
    ctx.lineWidth = panelBorder.width
    ctx.strokeRect(
      panelX + panelBorder.width / 2,
      panelY + panelBorder.width / 2,
      panelW - panelBorder.width,
      panelH - panelBorder.width
    )
  }

  const textLeft = panelX + PAD_X
  const textTop = panelY + PAD_TOP

  ctx.font = TITLE_FONT
  ctx.fillStyle = '#111111'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  const titleEndY = drawWrappedText(ctx, titleText, textLeft, textTop, textMaxW, TITLE_LINE_H)

  ctx.font = BODY_FONT
  ctx.fillStyle = '#444444'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  drawWrappedText(ctx, card.body, textLeft, titleEndY + TITLE_BODY_GAP, textMaxW, BODY_LINE_H)

  const wmBottom = c?.watermarkBottom ?? DEFAULT_WATERMARK_BOTTOM
  drawWatermark(ctx, project, onTop, wmBottom, panelY, panelH)
}

// ─── 커버 카드 ────────────────────────────────────────────────
function drawCoverLayout(ctx: CanvasRenderingContext2D, card: Card, project: Project) {
  ctx.fillStyle = 'rgba(0,0,0,0.38)'
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

  const centerX = CARD_WIDTH / 2
  const hookText = project.hook_text || card.title
  const textMaxW = CARD_WIDTH - PAD_X * 2

  // 박스 높이 동적 측정
  ctx.font = `bold 64px Pretendard, "Noto Sans KR", sans-serif`
  const hookH = measureWrappedText(ctx, hookText, textMaxW, 80)
  const boxH = PAD_TOP + hookH + PAD_BOT
  const boxY = Math.round((CARD_HEIGHT - boxH) / 2)

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, boxY, CARD_WIDTH, boxH)

  ctx.fillStyle = '#111111'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  drawWrappedText(ctx, hookText, centerX, boxY + PAD_TOP, textMaxW, 80, 'center')

  // 책 제목 하단
  ctx.font = '500 34px Pretendard, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillText(`『${project.book_title}』`, centerX, CARD_HEIGHT - 72)

  // 브랜드명 상단
  if (project.brand_name) {
    ctx.font = '400 28px Pretendard, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(`@${project.brand_name}`, centerX, 64)
  }
}

// ─── 마무리 카드 ──────────────────────────────────────────────
function drawEndingLayout(ctx: CanvasRenderingContext2D, card: Card, project: Project) {
  ctx.fillStyle = 'rgba(0,0,0,0.38)'
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

  const centerX = CARD_WIDTH / 2
  const textMaxW = CARD_WIDTH - PAD_X * 2

  // 박스 높이 동적 측정
  ctx.font = TITLE_FONT
  const titleH = measureWrappedText(ctx, card.title, textMaxW, TITLE_LINE_H)
  ctx.font = BODY_FONT
  const bodyH = measureWrappedText(ctx, card.body, textMaxW, BODY_LINE_H)

  const boxH = PAD_TOP + titleH + TITLE_BODY_GAP + bodyH + PAD_BOT
  // 마무리는 항상 하단 배치
  const boxY = CARD_HEIGHT - boxH

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, boxY, CARD_WIDTH, boxH)

  ctx.font = TITLE_FONT
  ctx.fillStyle = '#111111'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  const titleEndY = drawWrappedText(ctx, card.title, centerX, boxY + PAD_TOP, textMaxW, TITLE_LINE_H, 'center')

  ctx.font = BODY_FONT
  ctx.fillStyle = '#444444'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  drawWrappedText(ctx, card.body, centerX, titleEndY + TITLE_BODY_GAP, textMaxW, BODY_LINE_H, 'center')

  // CTA (이미지 영역 하단)
  ctx.font = '500 24px Pretendard, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillText('저장하고 나중에 다시 읽어봐 →', centerX, boxY - 24)
}

/** 워터마크: 이미지 영역 안쪽 (본문 카드). 하단 박스와 겹치면 위로 올림 */
function drawWatermark(
  ctx: CanvasRenderingContext2D,
  project: Project,
  boxOnTop: boolean,
  bottomFromEdge: number,
  panelY: number,
  panelH: number
) {
  if (!project.brand_name) return

  ctx.font = '400 22px Pretendard, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.65)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'

  const textRoughH = 28
  let y = CARD_HEIGHT - bottomFromEdge

  if (!boxOnTop) {
    const panelTop = panelY
    const gap = 8
    const maxY = panelTop - gap
    if (y > maxY) y = maxY
  } else {
    const panelBottom = panelY + panelH
    const gap = 8
    const minY = panelBottom + gap + textRoughH
    if (y < minY) y = minY
    if (y > CARD_HEIGHT - 8) y = CARD_HEIGHT - 8
  }

  ctx.fillText(`@${project.brand_name}`, CARD_WIDTH / 2, y)
}

export async function composeAllCards(
  cards: Card[],
  project: Project,
  onProgress?: (done: number, total: number) => void
): Promise<Map<string, Blob>> {
  const sorted = [...cards].sort((a, b) => a.card_number - b.card_number)
  const result = new Map<string, Blob>()
  let done = 0

  await Promise.all(
    sorted.map(async card => {
      const blob = await composeCard({
        card,
        project,
        isCover: card.card_number === 0,
        isEnding: card.card_number === 13,
      })
      result.set(card.id, blob)
      done++
      onProgress?.(done, sorted.length)
    })
  )

  return result
}
