'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { STYLE_OPTIONS } from '@/lib/types'
import { BookOpen, Sparkles } from 'lucide-react'

export default function HomePage() {
  const router = useRouter()
  const [bookTitle, setBookTitle] = useState('')
  const [style, setStyle] = useState('engraving')
  const [brandName, setBrandName] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!bookTitle.trim()) {
      toast.error('책 제목을 입력해주세요.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookTitle, style, brandName }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '텍스트 생성에 실패했습니다.')
      }

      toast.success('인사이트 추출 완료! 텍스트를 검수해주세요.')
      router.push(`/project/${data.projectId}/text`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '오류가 발생했습니다.')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-linear-to-br from-stone-950 via-stone-900 to-stone-800">
      <div className="w-full max-w-lg">
        {/* 헤더 */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-4">
            <BookOpen className="w-8 h-8 text-amber-400" />
            <h1 className="text-3xl font-bold text-white">BookCards</h1>
          </div>
          <p className="text-stone-400 text-lg">책 한 권을 15장 카드뉴스로, 자동으로.</p>
        </div>

        {/* 폼 */}
        <form
          onSubmit={handleGenerate}
          className="bg-stone-900/80 border border-stone-700 rounded-2xl p-8 space-y-6 shadow-xl backdrop-blur"
        >
          <div className="space-y-2">
            <Label htmlFor="bookTitle" className="text-stone-300 font-medium">
              책 제목 <span className="text-red-400">*</span>
            </Label>
            <Input
              id="bookTitle"
              value={bookTitle}
              onChange={e => setBookTitle(e.target.value)}
              placeholder="예: 그리스인 조르바, The Alchemist"
              className="bg-stone-800 border-stone-600 text-white placeholder:text-stone-500 focus:border-amber-400 focus:ring-amber-400/20 h-12 text-base"
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label className="text-stone-300 font-medium">이미지 스타일</Label>
            <Select value={style} onValueChange={(v) => setStyle(v ?? 'engraving')} disabled={loading}>
              <SelectTrigger className="bg-stone-800 border-stone-600 text-white h-12 focus:border-amber-400">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-stone-800 border-stone-600">
                {STYLE_OPTIONS.map(opt => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    className="text-stone-200 focus:bg-stone-700"
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="brandName" className="text-stone-300 font-medium">
              브랜드명 <span className="text-stone-500 font-normal text-sm">(선택)</span>
            </Label>
            <Input
              id="brandName"
              value={brandName}
              onChange={e => setBrandName(e.target.value)}
              placeholder="예: booklovers"
              className="bg-stone-800 border-stone-600 text-white placeholder:text-stone-500 focus:border-amber-400 h-12 text-base"
              disabled={loading}
            />
            <p className="text-stone-500 text-xs">카드 하단 워터마크 @브랜드명으로 표시됩니다</p>
          </div>

          <Button
            type="submit"
            disabled={loading || !bookTitle.trim()}
            className="w-full h-14 text-base font-semibold bg-amber-500 hover:bg-amber-400 text-stone-900 disabled:opacity-50 rounded-xl"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                AI가 인사이트를 추출하는 중… (약 30초)
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                카드뉴스 생성하기
              </span>
            )}
          </Button>
        </form>

        {/* 비용 안내 */}
        <div className="mt-6 text-center">
          <p className="text-stone-500 text-sm">
            건당 예상 비용: <span className="text-amber-400">~$0.25</span> &nbsp;·&nbsp; 생성 시간:{' '}
            <span className="text-amber-400">약 2~3분</span>
          </p>
        </div>
      </div>
    </main>
  )
}
