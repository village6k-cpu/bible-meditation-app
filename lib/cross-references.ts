export interface CrossReference {
  ref: string;
  text: string;
}

export interface OriginalWord {
  original: string;
  transliteration: string;
  meaning: string;
}

export interface VerseAnnotation {
  commentary: string;
  crossRefs: CrossReference[];
  originalWords: OriginalWord[];
}

// 예시 데이터 — Phase 2에서 Book-RAG 시스템으로 대체 예정
const annotations: Record<string, VerseAnnotation> = {
  '43:3:16': {
    commentary:
      '이 구절은 복음의 핵심을 한 문장으로 압축합니다. 하나님의 사랑은 조건 없이 세상 전체를 향하며, 그 사랑의 방식은 독생자를 "주심"이었습니다. 믿음은 이 선물을 받아들이는 통로이고, 그 결과는 영원한 생명입니다.',
    crossRefs: [
      { ref: '롬 5:8', text: '우리가 아직 죄인 되었을 때에 그리스도께서 우리를 위하여 죽으심으로' },
      { ref: '요일 4:9', text: '하나님의 사랑이 우리에게 이렇게 나타난 바 되었으니' },
      { ref: '롬 6:23', text: '하나님의 은사는 그리스도 예수 우리 주 안에 있는 영생이니라' },
    ],
    originalWords: [
      { original: 'ἀγαπάω', transliteration: 'agapaō', meaning: '아가페 사랑 — 조건 없는 자기희생적 사랑' },
      { original: 'μονογενής', transliteration: 'monogenēs', meaning: '독생 — 유일하게 나신, 하나뿐인' },
      { original: 'πιστεύω', transliteration: 'pisteuō', meaning: '믿다 — 신뢰하고 의지하다' },
    ],
  },
};

export function getAnnotation(bookId: number, chapter: number, verse: number): VerseAnnotation {
  const key = `${bookId}:${chapter}:${verse}`;
  if (annotations[key]) return annotations[key];

  // Phase 2: Book-RAG API 호출로 대체
  return {
    commentary: '이 구절에 대한 주석이 준비 중입니다. 곧 더 풍성한 자료가 제공됩니다.',
    crossRefs: [],
    originalWords: [],
  };
}
