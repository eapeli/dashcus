/* Shared team chat and attention alerts */

CREATE TABLE IF NOT EXISTS team_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_name text NOT NULL,
  sender_role text NOT NULL DEFAULT 'agent' CHECK (sender_role IN ('agent', 'supervisor', 'admin')),
  content text NOT NULL,
  message_type text NOT NULL DEFAULT 'message' CHECK (message_type IN ('message', 'attention')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_messages_created_at ON team_messages(created_at DESC);

ALTER TABLE team_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_messages_select_authenticated" ON team_messages;
CREATE POLICY "team_messages_select_authenticated" ON team_messages
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "team_messages_insert_authenticated" ON team_messages;
CREATE POLICY "team_messages_insert_authenticated" ON team_messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

ALTER PUBLICATION supabase_realtime ADD TABLE team_messages;
