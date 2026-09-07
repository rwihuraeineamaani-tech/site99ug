SELECT cron.schedule(
  'build-monthly-payment-run',
  '0 5 1 * *',
  $$ SELECT public.build_payment_run(date_trunc('month', now())::date); $$
);