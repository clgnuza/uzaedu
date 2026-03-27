-- send_batch_id: çoklu okul gönderimi için ortak kimlik. Eski satırlar için batch = id.
ALTER TABLE admin_messages ADD COLUMN IF NOT EXISTS send_batch_id UUID;
UPDATE admin_messages SET send_batch_id = id WHERE send_batch_id IS NULL;
-- Eski şema NOT NULL kısıtlıysa ve null satır kaldıysa:
ALTER TABLE admin_messages ALTER COLUMN send_batch_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_admin_messages_send_batch_id ON admin_messages(send_batch_id);
