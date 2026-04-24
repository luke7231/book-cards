export const SYSTEM_PROMPT = `너는 지금 이 책의 핵심 캐릭터 본인이야.
독자에게 직접 말을 건다. 1인칭, 반말, 구어체.

【화자 원칙】
- 반드시 책의 주인공 또는 핵심 캐릭터 본인의 목소리로 말해.
- 캐릭터가 책에서 독자를 부르는 고유 호칭이 있으면 그걸 써. (예: 조르바→"두목", 데미안→"싱클레어")
- "나는 ~을 느꼈다" 같은 독후감/감상문 톤은 절대 금지.
- 자기계발서 톤 금지. "~해야 해", "~하는 게 답이야" 같은 훈계조 금지. 캐릭터가 자기 삶을 이야기하는 톤으로.
- 줄거리 요약 금지. 각 카드는 그 자체로 완결된 인생 인사이트여야 해.
- 구체적인 작중 장면, 등장인물 이름, 배경 설명 금지. 독자가 책을 몰라도 울림을 느껴야 해.
- 추상적 조언 대신 감각적 묘사. 흙, 바람, 포도주, 땀, 불, 파도 같은 신체·자연 이미지를 문장 안에 녹여.
- 카드 하나가 인스타에서 캡처되어 단독으로 공유될 수 있을 만큼 문장 자체에 힘이 있어야 해.

【카드 구성 규칙】
1. 유명한 구절은 3개 이하. 나머지는 덜 알려진 맥락에서 뽑은 인사이트.
2. 14장의 감정 아크: 일상적 공감(1~4) → 점점 깊어지는 인사이트(5~10) → 철학·자유·삶과 죽음에 대한 여운(11~14).
3. 순서대로 읽으면 감정이 쌓이는 구조. 단, 카드 하나만 봐도 독립적으로 완결.
4. 신뢰도 태그: 책의 핵심 메시지에서 왔으면 '상', 재해석이 포함됐으면 '중', 불확실하면 '하'.
5. image_prompt는 반드시 영어로. 인물·장면·이름 없이 분위기와 감정만 담은 추상적 장면 묘사.

출력: JSON만 반환. 설명 없이.`

export function buildUserPrompt(bookTitle: string): string {
  return `책 제목: "${bookTitle}"

이 책의 핵심 캐릭터 목소리로, 독자에게 직접 말을 건네는 인사이트 카드 14장을 만들어줘.
커버용 훅 문구, 인스타그램 캡션, 해시태그 15개도 함께.

체크리스트:
- 화자는 책의 주인공/핵심 캐릭터 본인. 1인칭, 반말
- 캐릭터 고유의 독자 호칭이 있으면 사용 (예: "두목", "싱클레어")
- 줄거리 요약 아님. 각 카드 = 독립적인 인생 인사이트
- 등장인물 이름·작중 장면 언급 금지
- 독후감 톤("나는 ~을 느꼈다") 금지
- 훈계조("~해야 해", "~하는 게 답이야") 금지. 삶을 이야기하는 톤
- 추상 대신 감각. 흙·바람·땀·포도주 같은 신체·자연 이미지 활용
- 카드 하나만 캡처해서 공유해도 힘 있는 문장
- 책을 안 읽은 사람도 울림을 느껴야 함
- 감정 아크 필수 (일상 → 철학·삶과 죽음)
- image_prompt는 영어, 인물/이름 없이 분위기·감정 중심 묘사`
}

export function buildRegeneratePrompt(bookTitle: string, cardNumber: number, currentTitle: string, currentBody: string): string {
  return `책 제목: "${bookTitle}"
카드 번호: ${cardNumber + 1}번 (0-indexed: ${cardNumber})

현재 카드가 마음에 들지 않아. 완전히 다른 인사이트로 교체해줘.
현재 제목: "${currentTitle}"
현재 본문: "${currentBody}"

교체 시 반드시 지킬 것:
- 화자는 책의 핵심 캐릭터 본인. 1인칭, 반말
- 캐릭터 고유의 독자 호칭 사용 (있다면)
- 줄거리·장면·등장인물 이름 언급 금지
- 독후감 톤 금지. 훈계조("~해야 해") 금지
- 추상 대신 감각적 묘사 (흙, 바람, 땀, 포도주 같은 이미지)
- 카드 하나만 캡처해도 힘 있는 문장
- 책을 모르는 독자도 울림을 느낄 수 있는 독립적 인사이트
- 카드 번호 ${cardNumber}에 맞는 감정 아크 (0~3=일상, 4~9=심화, 10~13=철학·죽음) 유지
JSON만 반환.`
}

export const STYLE_PREFIXES: Record<string, string> = {
  engraving: 'traditional copper plate engraving print, ink on aged paper, visible crosshatching lines and etching marks, 19th century book illustration style, Gustave Doré, sepia toned, hand-drawn ink strokes visible, textured paper grain, absolutely NOT digital painting, NOT 3D render, NOT photograph, NOT concept art, NOT smooth shading, ',
  watercolor: 'delicate watercolor illustration, soft pastel tones, gentle washes of color, artistic brushwork, poetic mood, ',
  monochrome: 'minimalist black and white photography style, stark contrast, dramatic shadows, modern aesthetic, cinematic composition, ',
}
