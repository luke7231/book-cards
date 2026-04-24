'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import type { Project, Card } from '@/lib/types'
import {
  RefreshCw,
  ChevronRight,
  BookOpen,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
} from 'lucide-react'

const CONFIDENCE_COLORS: Record<string, string> = {
  상: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  중: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  하: 'bg-red-500/20 text-red-300 border-red-500/30',
}

export default function TextReviewPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [project, setProject] = useState<Project | null>(null)
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState(false)
  const [regeneratingCard, setRegeneratingCard] = useState<string | null>(null)

  // 편집 로컬 상태
  const [localCards, setLocalCards] = useState<Record<string, { title: string; body: string }>>({})
  const [caption, setCaption] = useState('')
  const [hashtags, setHashtags] = useState('')

  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
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
      setCaption(proj.caption || '')
      setHashtags(proj.hashtags || '')

      const localInit: Record<string, { title: string; body: string }> = {}
      for (const c of cardData || []) {
        localInit[c.id] = { title: c.title, body: c.body }
      }
      setLocalCards(localInit)
      setLoading(false)
    }
    load()
  }, [projectId])

  const debounceSave = useCallback(
    (cardId: string, field: 'title' | 'body', value: string) => {
      if (saveTimers.current[cardId]) clearTimeout(saveTimers.current[cardId])
      saveTimers.current[cardId] = setTimeout(async () => {
        await supabase.from('cards').update({ [field]: value }).eq('id', cardId)
      }, 800)
    },
    []
  )

  function handleCardChange(cardId: string, field: 'title' | 'body', value: string) {
    setLocalCards(prev => ({ ...prev, [cardId]: { ...prev[cardId], [field]: value } }))
    debounceSave(cardId, field, value)
  }

  async function handleRegenerateCard(card: Card) {
    setRegeneratingCard(card.id)
    try {
      const res = await fetch('/api/regenerate-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          cardId: card.id,
          cardNumber: card.card_number,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setCards(prev => prev.map(c => (c.id === card.id ? data.card : c)))
      setLocalCards(prev => ({
        ...prev,
        [card.id]: { title: data.card.title, body: data.card.body },
      }))
      toast.success(`카드 ${card.card_number + 1} 재생성 완료`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '재생성 실패')
    } finally {
      setRegeneratingCard(null)
    }
  }

  async function saveCaptionAndHashtags() {
    await supabase
      .from('projects')
      .update({ caption, hashtags })
      .eq('id', projectId)
  }

  async function handleApprove() {
    setApproving(true)
    try {
      // 진행 중인 debounce 저장 완료
      await Promise.all(
        Object.values(saveTimers.current).map(t => clearTimeout(t))
      )

      // 로컬 수정 일괄 저장
      await Promise.all(
        cards.map(card =>
          supabase
            .from('cards')
            .update(localCards[card.id] || {})
            .eq('id', card.id)
        )
      )

      await saveCaptionAndHashtags()

      await supabase
        .from('projects')
        .update({ status: 'text_approved' })
        .eq('id', projectId)

      toast.success('텍스트 승인 완료! 이미지를 생성합니다… (약 3~4분 소요)')

      // 이미지 생성 API 트리거
      const res = await fetch('/api/generate-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })

      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || '이미지 생성 실패')
      }

      router.push(`/project/${projectId}/final`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '승인 처리 중 오류 발생')
      setApproving(false)
    }
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

  const lowConfidenceCount = cards.filter(c => c.confidence === '하').length

  return (
    <div className="min-h-screen bg-stone-950 text-white">
      {/* 상단 네비게이션 */}
      <header className="sticky top-0 z-40 bg-stone-950/90 backdrop-blur border-b border-stone-800">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-amber-400" />
            <span className="font-semibold text-stone-200 truncate max-w-xs">
              {project?.book_title}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-stone-500 text-sm">Step 1 / 2</span>
            <Button
              onClick={handleApprove}
              disabled={approving}
              className="bg-amber-500 hover:bg-amber-400 text-stone-900 font-semibold px-6"
            >
              {approving ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  이미지 생성 중… (약 3~4분)
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  승인 후 이미지 생성
                  <ChevronRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* 경고 배너 */}
        {lowConfidenceCount > 0 && (
          <div className="flex items-center gap-3 bg-red-950/60 border border-red-800 rounded-xl p-4">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-red-300 text-sm">
              신뢰도 <strong>하</strong> 카드가 {lowConfidenceCount}개 있습니다. 내용을 꼭 검토해주세요.
            </p>
          </div>
        )}

        {/* 훅 (커버) */}
        {project?.hook_text && (
          <div className="bg-stone-900 border border-stone-700 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs">
                COVER
              </Badge>
              <span className="text-stone-400 text-sm">커버 훅 문구</span>
            </div>
            <p className="text-xl font-bold text-white">{project.hook_text}</p>
          </div>
        )}

        {/* 카드 리스트 */}
        {cards.map(card => (
          <CardEditorItem
            key={card.id}
            card={card}
            local={localCards[card.id] || { title: card.title, body: card.body }}
            regenerating={regeneratingCard === card.id}
            onTitleChange={v => handleCardChange(card.id, 'title', v)}
            onBodyChange={v => handleCardChange(card.id, 'body', v)}
            onRegenerate={() => handleRegenerateCard(card)}
          />
        ))}

        {/* 측버 / 해시태그 */}
        <div className="bg-stone-900 border border-stone-700 rounded-2xl p-6 space-y-4">
          <h3 className="font-semibold text-stone-200">인스타그램 캡션 & 해시태그</h3>
          <div className="space-y-2">
            <label className="text-stone-400 text-sm">캡션</label>
            <Textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              onBlur={saveCaptionAndHashtags}
              rows={5}
              className="bg-stone-800 border-stone-600 text-stone-200 resize-none focus:border-amber-400"
            />
          </div>
          <div className="space-y-2">
            <label className="text-stone-400 text-sm">해시태그 (줄바꿈으로 구분)</label>
            <Textarea
              value={hashtags}
              onChange={e => setHashtags(e.target.value)}
              onBlur={saveCaptionAndHashtags}
              rows={4}
              className="bg-stone-800 border-stone-600 text-stone-200 resize-none focus:border-amber-400 font-mono text-sm"
            />
          </div>
        </div>

        {/* 하단 승인 버튼 */}
        <Button
          onClick={handleApprove}
          disabled={approving}
          className="w-full h-14 bg-amber-500 hover:bg-amber-400 text-stone-900 font-semibold text-base rounded-xl"
        >
          {approving ? '이미지 생성 중…' : '텍스트 승인 → 이미지 생성 시작'}
        </Button>
      </div>
    </div>
  )
}

interface CardEditorItemProps {
  card: Card
  local: { title: string; body: string }
  regenerating: boolean
  onTitleChange: (v: string) => void
  onBodyChange: (v: string) => void
  onRegenerate: () => void
}

function CardEditorItem({
  card,
  local,
  regenerating,
  onTitleChange,
  onBodyChange,
  onRegenerate,
}: CardEditorItemProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const text = `${local.title}\n\n${local.body}`
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className={`bg-stone-900 border rounded-2xl p-6 space-y-4 transition-colors ${
        card.confidence === '하'
          ? 'border-red-800/60'
          : 'border-stone-700'
      }`}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-stone-500 text-sm font-mono">
            {String(card.card_number + 1).padStart(2, '0')}
          </span>
          <Badge className={`text-xs border ${CONFIDENCE_COLORS[card.confidence]}`}>
            신뢰도 {card.confidence}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="text-stone-400 hover:text-white hover:bg-stone-800 gap-1.5 text-xs"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            {copied ? '복사됨' : '복사'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRegenerate}
            disabled={regenerating}
            className="text-stone-400 hover:text-white hover:bg-stone-800 gap-1.5 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
            {regenerating ? '재생성 중…' : '재생성'}
          </Button>
        </div>
      </div>

      {/* 제목 */}
      <Textarea
        value={local.title}
        onChange={e => onTitleChange(e.target.value)}
        rows={2}
        className="bg-stone-800 border-stone-600 text-white font-bold text-lg resize-none focus:border-amber-400 leading-snug"
        placeholder="카드 제목"
      />

      {/* 본문 */}
      <Textarea
        value={local.body}
        onChange={e => onBodyChange(e.target.value)}
        rows={4}
        className="bg-stone-800 border-stone-600 text-stone-300 resize-none focus:border-amber-400 text-sm leading-relaxed"
        placeholder="카드 본문"
      />
    </div>
  )
}
