import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateImagesParallel } from '@/lib/replicate'
import { STYLE_PREFIXES } from '@/lib/ai/prompts'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const { projectId } = await req.json()

    const supabase = createAdminClient()

    const { data: project } = await supabase
      .from('projects')
      .select('style')
      .eq('id', projectId)
      .single()

    if (!project) {
      return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 })
    }

    const { data: cards } = await supabase
      .from('cards')
      .select('id, card_number, image_prompt')
      .eq('project_id', projectId)
      .order('card_number', { ascending: true })

    if (!cards || cards.length === 0) {
      return NextResponse.json({ error: '카드를 찾을 수 없습니다.' }, { status: 404 })
    }

    const stylePrefix = STYLE_PREFIXES[project.style] || STYLE_PREFIXES.engraving
    const prompts = cards.map(c => stylePrefix + c.image_prompt)

    const results = await generateImagesParallel(prompts)

    const updates = await Promise.allSettled(
      results.map(async result => {
        if (!result.url) return { cardId: cards[result.index].id, success: false, error: result.error }

        const card = cards[result.index]
        const imageRes = await fetch(result.url)
        const imageBlob = await imageRes.blob()
        const arrayBuffer = await imageBlob.arrayBuffer()

        const { error: uploadError } = await supabase.storage
          .from('card-images')
          .upload(`${projectId}/${card.card_number}.jpg`, arrayBuffer, {
            contentType: 'image/jpeg',
            upsert: true,
          })

        if (uploadError) return { cardId: card.id, success: false, error: uploadError.message }

        const { data: urlData } = supabase.storage
          .from('card-images')
          .getPublicUrl(`${projectId}/${card.card_number}.jpg`)

        const { error: updateError } = await supabase
          .from('cards')
          .update({ image_url: urlData.publicUrl })
          .eq('id', card.id)

        if (updateError) return { cardId: card.id, success: false, error: updateError.message }

        return { cardId: card.id, success: true, imageUrl: urlData.publicUrl }
      })
    )

    await supabase
      .from('projects')
      .update({ status: 'images_generated' })
      .eq('id', projectId)

    const summary = updates.map(u =>
      u.status === 'fulfilled' ? u.value : { success: false, error: String(u.reason) }
    )

    const { data: updatedCards } = await supabase
      .from('cards')
      .select('*')
      .eq('project_id', projectId)
      .order('card_number', { ascending: true })

    return NextResponse.json({ cards: updatedCards, summary })
  } catch (err) {
    console.error('generate-images error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '이미지 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
