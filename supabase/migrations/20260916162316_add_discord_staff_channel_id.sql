/*
# Add discord_staff_channel_id column to tickets

1. Changes
- Adds `discord_staff_channel_id` (text, nullable) to the `tickets` table.
- This column stores the ID of the private Discord channel visible only to staff,
  while the existing `discord_channel_id` stores the channel visible to the customer.

2. Security
- No RLS policy changes needed — the column is accessible under existing ticket policies.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'discord_staff_channel_id'
  ) THEN
    ALTER TABLE tickets ADD COLUMN discord_staff_channel_id text;
  END IF;
END $$;
