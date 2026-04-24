import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateImage } from '@/lib/replicate'
import { STYLE_PREFIXES } from '@/lib/ai/prompts'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { projectId, cardId } = await req.json()

    const supabase = createAdminClient()

    const { data: project } = await supabase
      .from('projects')
      .select('style')
      .eq('id', projectId)
      .single()

    if (!project) {
      return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 })
    }

    const { data: card } = await supabase
      .from('cards')
      .select('card_number, image_prompt')
      .eq('id', cardId)
      .single()

    if (!card) {
      return NextResponse.json({ error: '카드를 찾을 수 없습니다.' }, { status: 404 })
    }

    const stylePrefix = STYLE_PREFIXES[project.style] || STYLE_PREFIXES.engraving
    const fullPrompt = stylePrefix + card.image_prompt

    const imageUrl = await generateImage(fullPrompt)

    const imageRes = await fetch(imageUrl)
    const arrayBuffer = await imageRes.arrayBuffer()

    const storagePath = `${projectId}/${card.card_number}.jpg`
    const { error: uploadError } = await supabase.storage
      .from('card-images')
      .upload(storagePath, arrayBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      })

    if (uploadError) throw uploadError

    const { data: urlData } = supabase.storage
      .from('card-images')
      .getPublicUrl(storagePath)

    const cacheBustedUrl = `${urlData.publicUrl}?t=${Date.now()}`

    const { data: updated, error: updateError } = await supabase
      .from('cards')
      .update({ image_url: cacheBustedUrl })
      .eq('id', cardId)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json({ card: updated })
  } catch (err) {
    console.error('regenerate-image error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '이미지 재생성 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
