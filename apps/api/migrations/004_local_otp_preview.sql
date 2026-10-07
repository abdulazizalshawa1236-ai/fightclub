ALTER TABLE outbox DROP CONSTRAINT outbox_channel;
ALTER TABLE outbox ADD CONSTRAINT outbox_channel CHECK(channel IN ('sms','whatsapp','local'));
ALTER TABLE outbox DROP CONSTRAINT outbox_status;
ALTER TABLE outbox ADD CONSTRAINT outbox_status CHECK(status IN ('queued','sending','accepted','delivered','read','failed','suppressed','unknown','preview'));
ALTER TABLE outbox ADD CONSTRAINT local_preview_delivery CHECK((channel='local' AND status='preview' AND category='authentication' AND provider_id IS NULL) OR channel<>'local');
