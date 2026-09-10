-- revision은 모든 insert/update에서 트리거가 한 번만 발급한다.
-- 기본값까지 nextval을 부르면 insert마다 번호가 두 칸씩 뛰어 변경 로그 진단이 흐려진다.
alter table public.ledger_sync_records
  alter column revision drop default;
