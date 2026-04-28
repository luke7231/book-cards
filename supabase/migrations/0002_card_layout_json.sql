-- 본문 카드 합성 레이아웃 오버라이드 (클라이언트 Canvas용 JSON)
alter table cards
  add column if not exists layout_json jsonb;
