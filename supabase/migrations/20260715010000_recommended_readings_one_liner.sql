alter table public.recommended_readings
  add column if not exists one_liner text
  check (one_liner is null or char_length(one_liner) between 1 and 180);
