-- 같은 계정의 두 요청이 번호를 받은 순서와 반대로 커밋되면,
-- 먼저 보인 큰 번호로 커서를 옮긴 기기가 늦게 커밋된 작은 번호를 영영 놓친다.
-- 계정별 트랜잭션 잠금을 번호 발급보다 먼저 잡아 커밋 순서도 함께 보장한다.
create or replace function public.ledger_stamp_sync_record()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('ledger-sync:' || new.owner_id::text, 0)
  );
  new.revision := nextval('public.ledger_sync_revision_seq');
  new.updated_at := now();
  return new;
end;
$$;
