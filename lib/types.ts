export interface Project {
  id: string
  book_title: string
  style: string
  brand_name?: string
  status: 'draft' | 'text_approved' | 'images_generated' | 'completed'
  hook_text?: string
  caption?: string
  hashtags?: string
  created_at: string
}

export interface Card {
  id: string
  project_id: string
  card_number: number
  title: string
  body: string
  image_prompt: string
  confidence: '상' | '중' | '하'
  image_url?: string
  composed_url?: string
  created_at: string
}

export const STYLE_OPTIONS = [
  { value: 'engraving', label: '판화풍 (기본)' },
  { value: 'watercolor', label: '수채화풍' },
  { value: 'monochrome', label: '모노크롬' },
] as const
