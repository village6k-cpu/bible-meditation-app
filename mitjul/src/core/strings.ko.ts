// 밑줄의 목소리 — 조용한 서재의 친구. 감탄사 없이, 책을 아끼는 사람의 어휘로 짧게.
export const S = {
  appName: '밑줄',
  tagline: '쓰기만 하는 기록 말고, 다시 읽는 기록',

  tab_today: '오늘',
  tab_library: '서재',
  tab_capture: '남기기',
  tab_trends: '흐름',

  compose_title: '무엇을 남길까요?',
  compose_save: '밑줄 긋기',
  compose_close: '닫기',
  compose_tags_placeholder: '#태그 (쉼표나 공백으로 구분)',
  compose_photo_camera: '카메라',
  compose_photo_album: '앨범',
  compose_minutes_suffix: '분',
  compose_dropped_warning: '지금 유형에서는 저장되지 않는 내용이 있어요',

  save_done: '담아두었어요. 잊지 않고 다시 보여드릴게요.',
  save_task_done: '적어두었어요.',

  empty_today: '아직 오늘의 기록이 없어요.\n첫 밑줄을 그어볼까요?',
  empty_library: '서재가 비어 있어요.\n기록이 쌓이면 이곳이 당신의 책장이 돼요.',
  empty_trends: '무늬가 생기려면 며칠의 기록이 필요해요.\n오늘부터 시작해요.',
  empty_tag: '이 갈피에 꽂힌 기록이 아직 없어요.',
  empty_search: '찾는 문장이 아직 없어요.',

  resurface_header: '다시 만나는 밑줄',
  resurface_pinned_caption: '아껴둔 문장',
  resurface_forgotten_caption: '오래 잊고 있던 기록',
  resurface_keep: '여전히 좋아요',
  resurface_retire: '보내주기',
  resurface_kept_toast: '아껴둔 밑줄에 담았어요.',
  resurface_retired_toast: '조용히 보내드렸어요.',

  library_search_placeholder: '문장, 제목, 태그로 찾기',
  library_sort_recent: '최신순',
  library_sort_dusty: '오래 안 읽은 순',
  library_filter_pinned: '아껴둔 것만',
  library_all: '전체',
  library_last_read: (n: number) => `읽은 지 ${n}일`,
  library_never_read: '아직 다시 읽지 않음',

  detail_related: '같은 갈피에 꽂힌 기록',
  detail_pin: '아껴두기',
  detail_pinned: '아껴둔 밑줄',
  detail_delete: '지우기',
  detail_delete_title: '이 기록을 지울까요?',
  detail_delete_confirm: '지우기',
  detail_cancel: '취소',
  detail_edit: '고치기',

  today_tasks: '오늘 할 일',
  today_task_placeholder: '할 일 적어두기',
  today_entries: '오늘의 기록',

  trends_practice_header: '실천의 무늬',
  trends_week_workout: '이번 주 운동',
  trends_month_shelf: '이달의 서재',
  trends_streak: (name: string, n: number) => `${name}, ${n}일째 이어오고 있어요`,
  trends_week_fallback: (name: string, n: number) => `${name}, 이번 주 ${n}일 함께했어요`,
  trends_rows: { workout: '운동', meal: '식사', verse: '묵상', record: '기록' },

  settings_title: '설정',
  settings_theme: '화면',
  settings_theme_system: '시스템',
  settings_theme_light: '밝게',
  settings_theme_dark: '어둡게',
  settings_export: '옵시디언으로 내보내기',
  settings_export_week: '이번 주',
  settings_export_month: '이번 달',
  settings_export_all: '전체',
  settings_about: '밑줄에 대해',

  export_action: '옵시디언으로 내보내기',
  export_done: '옵시디언으로 떠날 준비가 됐어요.',
  export_empty: '이 기간에는 기록이 없어요.',

  tag_bookend_first: '첫 기록',
  tag_bookend_latest: '최근 기록',

  onboarding_title: '밑줄',
  onboarding_body:
    '책에도, 하루에도, 스쳐 간 순간에도\n밑줄을 그을 수 있다면 어떨까요.\n\n여기 남긴 기록은 사라지지 않고\n어느 아침, 당신을 다시 찾아옵니다.',
  onboarding_start: '첫 밑줄 긋기',
} as const;
