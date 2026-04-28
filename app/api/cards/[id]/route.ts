import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CARD_LAYOUT_VERSION } from '@/lib/types'

function layoutJsonError(layoutJson: unknown): string | null {
  if (layoutJson === null) return null
  if (typeof layoutJson !== 'object' || layoutJson === null) {
    return 'layout_json 형식이 올바르지 않습니다.'
  }
  const v = (layoutJson as { version?: unknown }).version
  if (v !== CARD_LAYOUT_VERSION) {
    return `layout_json.version은 ${CARD_LAYOUT_VERSION} 이어야 합니다.`
  }
  return null
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()

    const update: Record<string, unknown> = {}
    if (typeof body.title === 'string') update.title = body.title
    if (typeof body.body === 'string') update.body = body.body

    if ('layout_json' in body) {
      const err = layoutJsonError(body.layout_json as unknown)
      if (err) return NextResponse.json({ error: err }, { status: 400 })
      update.layout_json = body.layout_json
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: '수정할 필드가 없습니다.' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase.from('cards').update(update).eq('id', id).select().single()

    if (error) {
      if (error.code === 'PGRST204' && String(error.message).includes('layout_json')) {
        return NextResponse.json(
          {
            error:
              'DB에 cards.layout_json 컬럼이 없습니다. Supabase SQL Editor에서 supabase/migrations/0002_card_layout_json.sql 내용을 실행한 뒤 다시 시도하세요.',
          },
          { status: 503 }
        )
      }
      throw error
    }
    if (!data) {
      return NextResponse.json({ error: '카드를 찾을 수 없습니다.' }, { status: 404 })
    }

    return NextResponse.json({ card: data })
  } catch (err) {
    console.error('PATCH cards/[id] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '카드 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
