import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { regenerateSingleCard } from '@/lib/ai/gateway'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const { projectId, cardId, cardNumber } = await req.json()

    const supabase = createAdminClient()

    const { data: project } = await supabase
      .from('projects')
      .select('book_title')
      .eq('id', projectId)
      .single()

    if (!project) {
      return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 })
    }

    const { data: card } = await supabase
      .from('cards')
      .select('title, body')
      .eq('id', cardId)
      .single()

    if (!card) {
      return NextResponse.json({ error: '카드를 찾을 수 없습니다.' }, { status: 404 })
    }

    const newCard = await regenerateSingleCard(
      project.book_title,
      cardNumber,
      card.title,
      card.body
    )

    const { data: updated, error } = await supabase
      .from('cards')
      .update({
        title: newCard.title,
        body: newCard.body,
        image_prompt: newCard.image_prompt,
        confidence: newCard.confidence,
      })
      .eq('id', cardId)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ card: updated })
  } catch (err) {
    console.error('regenerate-card error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '카드 재생성 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
