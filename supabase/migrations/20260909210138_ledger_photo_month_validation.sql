-- SQL 문자열의 이중 역슬래시가 숫자 대신 문자 그대로의 역슬래시를 요구하던 오류를 고친다.
alter table public.ledger_google_albums
  drop constraint ledger_google_albums_month_check,
  add constraint ledger_google_albums_month_check
    check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
