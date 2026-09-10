-- Google OAuth의 장기 토큰은 브라우저와 동기화 표에 절대 내보내지 않는다.
-- Edge Function의 service_role만 읽으며, 값 자체도 함수에서 AES-GCM으로 암호화한다.
create table if not exists public.ledger_google_accounts (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token_ciphertext text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ledger_google_albums (
  owner_id uuid not null references auth.users(id) on delete cascade,
  month text not null check (month ~ '^\\d{4}-\\d{2}$'),
  album_id text not null,
  created_at timestamptz not null default now(),
  primary key (owner_id, month)
);

alter table public.ledger_google_accounts enable row level security;
alter table public.ledger_google_albums enable row level security;

revoke all on table public.ledger_google_accounts from anon, authenticated;
revoke all on table public.ledger_google_albums from anon, authenticated;
grant select, insert, update, delete on table public.ledger_google_accounts to service_role;
grant select, insert, update, delete on table public.ledger_google_albums to service_role;
