import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateInsights } from '@/lib/ai/gateway'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { bookTitle, style = 'engraving', brandName } = await req.json()

    if (!bookTitle?.trim()) {
      return NextResponse.json({ error: '책 제목을 입력해주세요.' }, { status: 400 })
    }

    const insights = await generateInsights(bookTitle.trim())

    const supabase = createAdminClient()

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        book_title: bookTitle.trim(),
        style,
        brand_name: brandName?.trim() || null,
        status: 'draft',
        hook_text: insights.hook,
        caption: insights.caption,
        hashtags: insights.hashtags.join('\n'),
      })
      .select()
      .single()

    if (projectError) throw projectError

    const cardRows = insights.cards.map(card => ({
      project_id: project.id,
      card_number: card.number,
      title: card.title,
      body: card.body,
      image_prompt: card.image_prompt,
      confidence: card.confidence,
    }))

    const { error: cardsError } = await supabase.from('cards').insert(cardRows)
    if (cardsError) throw cardsError

    return NextResponse.json({ projectId: project.id })
  } catch (err) {
    console.error('generate-text error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '텍스트 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
