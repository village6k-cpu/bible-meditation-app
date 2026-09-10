-- Ledger의 본문·관계·사진 식별자를 기기 사이에서 옮기는 단일 변경 로그.
-- 사진 바이트와 OAuth 토큰은 이 표에 넣지 않는다.
create sequence if not exists public.ledger_sync_revision_seq;

create table if not exists public.ledger_sync_records (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entity_type text not null check (
    entity_type in ('entries', 'sources', 'tags', 'entry_tags', 'resurfacings', 'photo_links')
  ),
  entity_id text not null,
  operation text not null check (operation in ('upsert', 'delete')),
  payload jsonb,
  revision bigint not null default nextval('public.ledger_sync_revision_seq'),
  updated_at timestamptz not null default now(),
  primary key (owner_id, entity_type, entity_id),
  check (
    (operation = 'upsert' and payload is not null)
    or (operation = 'delete' and payload is null)
  )
);

create index if not exists ledger_sync_records_owner_revision
  on public.ledger_sync_records (owner_id, revision);

create or replace function public.ledger_stamp_sync_record()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.revision := nextval('public.ledger_sync_revision_seq');
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ledger_stamp_sync_record on public.ledger_sync_records;
create trigger ledger_stamp_sync_record
before insert or update on public.ledger_sync_records
for each row execute function public.ledger_stamp_sync_record();

alter table public.ledger_sync_records enable row level security;

drop policy if exists "ledger_sync_select_own" on public.ledger_sync_records;
create policy "ledger_sync_select_own"
on public.ledger_sync_records for select
to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists "ledger_sync_insert_own" on public.ledger_sync_records;
create policy "ledger_sync_insert_own"
on public.ledger_sync_records for insert
to authenticated
with check ((select auth.uid()) = owner_id);

drop policy if exists "ledger_sync_update_own" on public.ledger_sync_records;
create policy "ledger_sync_update_own"
on public.ledger_sync_records for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "ledger_sync_delete_own" on public.ledger_sync_records;
create policy "ledger_sync_delete_own"
on public.ledger_sync_records for delete
to authenticated
using ((select auth.uid()) = owner_id);

revoke all on table public.ledger_sync_records from anon;
grant select, insert, update, delete on table public.ledger_sync_records to authenticated;
grant usage, select on sequence public.ledger_sync_revision_seq to authenticated;
revoke all on function public.ledger_stamp_sync_record() from public;
grant execute on function public.ledger_stamp_sync_record() to authenticated;
