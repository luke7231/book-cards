import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CARD_LAYOUT_VERSION } from '@/lib/types'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const layout_json = body.layout_json as unknown

    if (layout_json === null || layout_json === undefined) {
      const supabase = createAdminClient()
      const { data, error } = await supabase.from('cards').update({ layout_json: null }).eq('id', id).select().single()
      if (error) throw error
      return NextResponse.json({ card: data })
    }

    if (typeof layout_json !== 'object' || layout_json === null) {
      return NextResponse.json({ error: 'layout_json 형식이 올바르지 않습니다.' }, { status: 400 })
    }
    const v = (layout_json as { version?: unknown }).version
    if (v !== CARD_LAYOUT_VERSION) {
      return NextResponse.json(
        { error: `layout_json.version은 ${CARD_LAYOUT_VERSION} 이어야 합니다.` },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('cards')
      .update({ layout_json })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    if (!data) {
      return NextResponse.json({ error: '카드를 찾을 수 없습니다.' }, { status: 404 })
    }

    return NextResponse.json({ card: data })
  } catch (err) {
    console.error('PATCH cards layout error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '레이아웃 저장 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
