ALTER TABLE outbox ADD COLUMN channel text NOT NULL DEFAULT 'whatsapp';
ALTER TABLE outbox ADD CONSTRAINT outbox_channel CHECK(channel IN ('sms','whatsapp'));
-- Provider identifiers are unique within a channel, since different providers may reuse numeric IDs.
ALTER TABLE outbox DROP CONSTRAINT outbox_provider_id_key;
CREATE UNIQUE INDEX outbox_provider_channel ON outbox(channel,provider_id) WHERE provider_id IS NOT NULL;
