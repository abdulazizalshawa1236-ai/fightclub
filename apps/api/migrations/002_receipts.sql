CREATE TABLE whatsapp_receipts(provider_id text PRIMARY KEY,correlation_id text,status text NOT NULL,occurred_at timestamptz NOT NULL,error text,received_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX receipts_correlation ON whatsapp_receipts(correlation_id);
ALTER TABLE outbox ADD CONSTRAINT outbox_status CHECK(status IN ('queued','sending','accepted','delivered','read','failed','suppressed','unknown'));
ALTER TABLE outbox ADD CONSTRAINT outbox_attempts CHECK(attempts>=0);
CREATE INDEX memberships_dates ON memberships(end_date) WHERE current;
