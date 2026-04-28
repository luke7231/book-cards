'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { createClient } from '@/lib/supabase/client'
import { composeAllCards } from '@/lib/canvas/composer'
import {
  applyGlobalContentLayout,
  isContentLayoutCard,
  layoutFromCardsOrDefault,
} from '@/lib/canvas/card-layout'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Project, Card, CardLayout, CardLayoutContent } from '@/lib/types'
import {
  Download,
  Copy,
  RefreshCw,
  CheckCircle2,
  ImageIcon,
  BookOpen,
  LayoutTemplate,
} from 'lucide-react'

export default function FinalPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [project, setProject] = useState<Project | null>(null)
  const [cards, setCards] = useState<Card[]>([])
  const [composedBlobs, setComposedBlobs] = useState<Map<string, Blob>>(new Map())
  const [composeProgress, setComposeProgress] = useState(0)
  const [composing, setComposing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [regeneratingImage, setRegeneratingImage] = useState<string | null>(null)
  const [previewCard, setPreviewCard] = useState<Card | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [layoutDraft, setLayoutDraft] = useState<CardLayout | null>(null)
  const [debouncedLayout, setDebouncedLayout] = useState<CardLayout | null>(null)
  const [layoutSaving, setLayoutSaving] = useState(false)

  useEffect(() => {
    setLayoutDraft(null)
    setDebouncedLayout(null)
  }, [projectId])

  useEffect(() => {
    setLoading(true)
    setComposedBlobs(new Map())
    async function load() {
      const [{ data: proj }, { data: cardData }] = await Promise.all([
        supabase.from('projects').select('*').eq('id', projectId).single(),
        supabase.from('cards').select('*').eq('project_id', projectId).order('card_number'),
      ])

      if (!proj) {
        toast.error('프로젝트를 찾을 수 없습니다.')
        router.push('/')
        return
      }

      setProject(proj)
      setCards(cardData || [])
      setLoading(false)
    }
    load()
  }, [projectId])

  useEffect(() => {
    if (loading || cards.length === 0) return
    setLayoutDraft(prev => prev ?? layoutFromCardsOrDefault(cards))
  }, [loading, cards, projectId])

  useEffect(() => {
    if (!layoutDraft) {
      setDebouncedLayout(null)
      return
    }
    const id = window.setTimeout(() => setDebouncedLayout(layoutDraft), 320)
    return () => window.clearTimeout(id)
  }, [layoutDraft])

  const cardsForCompose = useMemo(() => {
    if (!debouncedLayout) return cards
    return applyGlobalContentLayout(cards, debouncedLayout)
  }, [cards, debouncedLayout])

  const composeKey = useMemo(
    () =>
      cardsForCompose
        .map(c => `${c.id}:${c.image_url ?? ''}:${JSON.stringify(c.layout_json ?? null)}`)
        .join('|'),
    [cardsForCompose]
  )

  useEffect(() => {
    if (loading || !project || cardsForCompose.length === 0) return
    let cancelled = false
    setComposing(true)
    setComposeProgress(0)
    composeAllCards(cardsForCompose, project, (done, total) => {
      if (!cancelled) setComposeProgress(Math.round((done / total) * 100))
    })
      .then(blobs => {
        if (!cancelled) setComposedBlobs(blobs)
      })
      .catch(err => {
        if (!cancelled)
          toast.error('합성 중 오류: ' + (err instanceof Error ? err.message : String(err)))
      })
      .finally(() => {
        if (!cancelled) setComposing(false)
      })

    return () => {
      cancelled = true
    }
  }, [composeKey, project, loading])

  function patchLayoutContent(patch: Partial<CardLayoutContent>) {
    setLayoutDraft(prev => {
      if (!prev) return prev
      const base = prev.content ?? {}
      return { ...prev, content: { ...base, ...patch } }
    })
  }

  async function handleSaveLayout() {
    if (!layoutDraft) return
    const contentCards = cards.filter(c => isContentLayoutCard(c.card_number))
    if (contentCards.length === 0) return
    setLayoutSaving(true)
    try {
      await Promise.all(
        contentCards.map(async c => {
          const res = await fetch(`/api/cards/${c.id}/layout`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ layout_json: layoutDraft }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || '저장 실패')
        })
      )
      setCards(prev => applyGlobalContentLayout(prev, layoutDraft))
      toast.success('레이아웃이 저장되었습니다.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setLayoutSaving(false)
    }
  }

  async function handleRegenerateImage(card: Card) {
    setRegeneratingImage(card.id)
    try {
      const res = await fetch('/api/regenerate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, cardId: card.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      const updatedCard: Card = { ...card, image_url: data.card.image_url }
      setCards(prev => prev.map(c => (c.id === card.id ? updatedCard : c)))

      toast.success('이미지 재생성 완료')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '이미지 재생성 실패')
    } finally {
      setRegeneratingImage(null)
    }
  }

  function handleCardClick(card: Card) {
    const blob = composedBlobs.get(card.id)
    if (blob) {
      const url = URL.createObjectURL(blob)
      setPreviewUrl(url)
      setPreviewCard(card)
    }
  }

  function closePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setPreviewCard(null)
  }

  async function handleDownload() {
    if (!project || composedBlobs.size === 0) return
    setDownloading(true)
    try {
      const zip = new JSZip()
      const sorted = [...cards].sort((a, b) => a.card_number - b.card_number)

      for (const card of sorted) {
        const blob = composedBlobs.get(card.id)
        if (blob) {
          const num = String(card.card_number + 1).padStart(2, '0')
          const label =
            card.card_number === 0
              ? 'cover'
              : card.card_number === 13
              ? 'ending'
              : `card${num}`
          zip.file(`${project.book_title}_${label}.jpg`, blob)
        }
      }

      const captionText = [
        project.hook_text || '',
        '',
        project.caption || '',
        '',
        project.hashtags || '',
      ].join('\n')
      zip.file('caption.txt', captionText)

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      saveAs(zipBlob, `${project.book_title}_BookCards.zip`)
      toast.success('다운로드 완료!')

      await supabase.from('projects').update({ status: 'completed' }).eq('id', projectId)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '다운로드 실패')
    } finally {
      setDownloading(false)
    }
  }

  async function handleCopyCaption() {
    if (!project) return
    const text = [project.caption || '', '', project.hashtags || ''].join('\n')
    await navigator.clipboard.writeText(text)
    toast.success('캡션이 클립보드에 복사되었습니다!')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <div className="text-stone-400 flex items-center gap-3">
          <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          불러오는 중…
        </div>
      </div>
    )
  }

  const sortedCards = [...cards].sort((a, b) => a.card_number - b.card_number)

  return (
    <div className="min-h-screen bg-stone-950 text-white">
      {/* 상단 네비게이션 */}
      <header className="sticky top-0 z-40 bg-stone-950/90 backdrop-blur border-b border-stone-800">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-amber-400" />
            <span className="font-semibold text-stone-200 truncate max-w-xs">
              {project?.book_title}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-stone-500 text-sm">Step 2 / 2</span>
            <Button
              onClick={handleCopyCaption}
              variant="outline"
              className="border-stone-600 text-stone-300 hover:bg-stone-800 gap-2"
            >
              <Copy className="w-4 h-4" />
              캡션 복사
            </Button>
            <Button
              onClick={handleDownload}
              disabled={downloading || composedBlobs.size === 0}
              className="bg-amber-500 hover:bg-amber-400 text-stone-900 font-semibold gap-2"
            >
              {downloading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  ZIP 생성 중…
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  ZIP 다운로드
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* 합성 진행바 */}
        {composing && (
          <div className="mb-8 bg-stone-900 border border-stone-700 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-stone-300 font-medium">카드 합성 중…</span>
              <span className="text-amber-400 font-mono">{composeProgress}%</span>
            </div>
            <div className="h-2 bg-stone-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all duration-300 rounded-full"
                style={{ width: `${composeProgress}%` }}
              />
            </div>
          </div>
        )}

        {layoutDraft && (
          <div className="mb-8 bg-stone-900 border border-stone-700 rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-stone-200 font-semibold">
                <LayoutTemplate className="w-5 h-5 text-amber-400" />
                본문 카드 레이아웃 (1–12장)
              </div>
              <Button
                type="button"
                onClick={handleSaveLayout}
                disabled={layoutSaving}
                className="bg-stone-700 hover:bg-stone-600 text-white"
              >
                {layoutSaving ? '저장 중…' : '레이아웃 저장'}
              </Button>
            </div>
            <p className="text-stone-500 text-sm">
              패널을 카드 가장자리에서 띄울 여백과 테두리입니다. 수정 후 약 0.3초 뒤 미리보기가 갱신됩니다.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label className="text-stone-400 text-xs">좌우 여백 (px)</Label>
                <Input
                  type="number"
                  min={16}
                  max={200}
                  value={layoutDraft.content?.panelOutsetX ?? 44}
                  onChange={e => patchLayoutContent({ panelOutsetX: Number(e.target.value) })}
                  className="bg-stone-800 border-stone-600 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-stone-400 text-xs">상·하단 여백 (px)</Label>
                <Input
                  type="number"
                  min={16}
                  max={200}
                  value={layoutDraft.content?.panelOutsetY ?? 40}
                  onChange={e => patchLayoutContent({ panelOutsetY: Number(e.target.value) })}
                  className="bg-stone-800 border-stone-600 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-stone-400 text-xs">테두리 두께 (0=없음)</Label>
                <Input
                  type="number"
                  min={0}
                  max={8}
                  value={
                    layoutDraft.content?.border === null
                      ? 0
                      : (layoutDraft.content?.border?.width ?? 2)
                  }
                  onChange={e => {
                    const w = Number(e.target.value)
                    if (!w) {
                      patchLayoutContent({ border: null })
                      return
                    }
                    const color =
                      layoutDraft.content?.border &&
                      layoutDraft.content.border.width > 0
                        ? layoutDraft.content.border.color
                        : '#111111'
                    patchLayoutContent({ border: { width: w, color } })
                  }}
                  className="bg-stone-800 border-stone-600 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-stone-400 text-xs">테두리 색</Label>
                <Input
                  type="text"
                  value={
                    layoutDraft.content?.border &&
                    layoutDraft.content.border !== null &&
                    layoutDraft.content.border.width > 0
                      ? layoutDraft.content.border.color
                      : '#111111'
                  }
                  onChange={e =>
                    patchLayoutContent({
                      border: {
                        width:
                          layoutDraft.content?.border &&
                          layoutDraft.content.border !== null &&
                          layoutDraft.content.border.width > 0
                            ? layoutDraft.content.border.width
                            : 2,
                        color: e.target.value,
                      },
                    })
                  }
                  className="bg-stone-800 border-stone-600 text-white font-mono text-sm"
                />
              </div>
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label className="text-stone-400 text-xs">워터마크 (하단에서 px)</Label>
                <Input
                  type="number"
                  min={8}
                  max={120}
                  value={layoutDraft.content?.watermarkBottom ?? 24}
                  onChange={e => patchLayoutContent({ watermarkBottom: Number(e.target.value) })}
                  className="bg-stone-800 border-stone-600 text-white"
                />
              </div>
            </div>
            <p className="text-stone-600 text-xs">
              고급: JSON으로 좌표를 덮어쓰려면 DB의 layout_json.textPanel을 설정하면 됩니다.
            </p>
          </div>
        )}

        {/* 카드 그리드 */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {sortedCards.map(card => (
            <CardGridItem
              key={card.id}
              card={card}
              blob={composedBlobs.get(card.id)}
              composing={composing}
              regenerating={regeneratingImage === card.id}
              onClick={() => handleCardClick(card)}
              onRegenerate={() => handleRegenerateImage(card)}
            />
          ))}
        </div>

        {/* 캡션 미리보기 */}
        {project?.caption && (
          <div className="bg-stone-900 border border-stone-700 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-stone-200">인스타그램 캡션</h3>
              <Button
                onClick={handleCopyCaption}
                variant="ghost"
                size="sm"
                className="text-stone-400 hover:text-white gap-2"
              >
                <Copy className="w-4 h-4" />
                복사
              </Button>
            </div>
            <pre className="text-stone-400 text-sm whitespace-pre-wrap leading-relaxed font-sans">
              {project.caption}
            </pre>
            <pre className="text-stone-500 text-sm font-mono whitespace-pre-wrap">
              {project.hashtags}
            </pre>
          </div>
        )}

        {/* 하단 다운로드 버튼 */}
        <div className="mt-6 flex gap-4">
          <Button
            onClick={handleDownload}
            disabled={downloading || composedBlobs.size === 0}
            className="flex-1 h-14 bg-amber-500 hover:bg-amber-400 text-stone-900 font-semibold text-base rounded-xl gap-2"
          >
            <Download className="w-5 h-5" />
            {downloading ? 'ZIP 생성 중…' : `15장 ZIP 다운로드`}
          </Button>
          <Button
            onClick={handleCopyCaption}
            variant="outline"
            className="h-14 px-8 border-stone-600 text-stone-300 hover:bg-stone-800 rounded-xl gap-2"
          >
            <Copy className="w-5 h-5" />
            캡션 복사
          </Button>
        </div>
      </div>

      {/* 풀사이즈 미리보기 모달 */}
      <Dialog open={!!previewCard} onOpenChange={open => !open && closePreview()}>
        <DialogContent className="max-w-2xl bg-stone-900 border-stone-700 p-0 overflow-hidden">
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={`카드 ${previewCard?.card_number}`}
              className="w-full h-auto"
            />
          )}
          {previewCard && (
            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="text-stone-400 text-xs mb-1">
                  카드 {previewCard.card_number + 1}
                </p>
                <p className="text-white font-semibold">{previewCard.title}</p>
              </div>
              <Button
                onClick={() => {
                  closePreview()
                  handleRegenerateImage(previewCard)
                }}
                variant="ghost"
                size="sm"
                disabled={regeneratingImage === previewCard.id}
                className="text-stone-400 hover:text-white gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                이미지 재생성
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface CardGridItemProps {
  card: Card
  blob?: Blob
  composing: boolean
  regenerating: boolean
  onClick: () => void
  onRegenerate: () => void
}

function CardGridItem({ card, blob, composing, regenerating, onClick, onRegenerate }: CardGridItemProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  useEffect(() => {
    if (blob) {
      const url = URL.createObjectURL(blob)
      setObjectUrl(url)
      return () => URL.revokeObjectURL(url)
    }
  }, [blob])

  return (
    <div className="group relative bg-stone-900 border border-stone-700 rounded-xl overflow-hidden aspect-4/5">
      {objectUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={objectUrl}
            alt={`카드 ${card.card_number + 1}`}
            className="w-full h-full object-cover cursor-pointer group-hover:opacity-90 transition-opacity"
            onClick={onClick}
          />
          {/* 호버 오버레이 */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
            <Button
              onClick={onClick}
              size="sm"
              className="bg-white/90 text-stone-900 hover:bg-white text-xs gap-1"
            >
              <CheckCircle2 className="w-3 h-3" />
              미리보기
            </Button>
            <Button
              onClick={e => { e.stopPropagation(); onRegenerate() }}
              disabled={regenerating}
              size="sm"
              variant="outline"
              className="border-white/50 text-white hover:bg-white/20 text-xs gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${regenerating ? 'animate-spin' : ''}`} />
              재생성
            </Button>
          </div>
        </>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-stone-600">
          {composing || regenerating ? (
            <svg className="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <ImageIcon className="w-8 h-8" />
          )}
          <span className="text-xs">{card.card_number + 1}장</span>
        </div>
      )}

      {/* 카드 번호 뱃지 */}
      <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm rounded-md px-2 py-0.5">
        <span className="text-white text-xs font-mono">
          {String(card.card_number + 1).padStart(2, '0')}
        </span>
      </div>
    </div>
  )
}
