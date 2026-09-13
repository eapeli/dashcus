/*
# Add ticket feedback and shared kanban board

1. New Tables
- `kanban_categories` stores support-created board columns with a name, color, description, and display position.

2. Modified Tables
- `tickets.board_category_id` links each ticket to a kanban column.
- `tickets.feedback_success` records whether the customer case was resolved successfully.
- `tickets.feedback_text` stores the short closing feedback entered by the attendant.

3. Security
- Row level security is enabled on `kanban_categories`.
- Authenticated support users can read, create, update, and delete shared kanban categories.
- Existing authenticated ticket access remains unchanged.

4. Important Notes
- Existing tickets remain safe and are placed in the first default board column when available.
- Categories are shared across the support team so every attendant sees the same organization.
*/

CREATE TABLE IF NOT EXISTS kanban_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '#3B82F6',
  position integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS board_category_id uuid REFERENCES kanban_categories(id) ON DELETE SET NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS feedback_success boolean;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS feedback_text text;

CREATE INDEX IF NOT EXISTS idx_tickets_board_category ON tickets(board_category_id);
CREATE INDEX IF NOT EXISTS idx_kanban_categories_position ON kanban_categories(position);

ALTER TABLE kanban_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kanban_select_authenticated" ON kanban_categories;
CREATE POLICY "kanban_select_authenticated" ON kanban_categories FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "kanban_insert_authenticated" ON kanban_categories;
CREATE POLICY "kanban_insert_authenticated" ON kanban_categories FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = created_by OR created_by IS NULL);

DROP POLICY IF EXISTS "kanban_update_authenticated" ON kanban_categories;
CREATE POLICY "kanban_update_authenticated" ON kanban_categories FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "kanban_delete_authenticated" ON kanban_categories;
CREATE POLICY "kanban_delete_authenticated" ON kanban_categories FOR DELETE
  TO authenticated USING (true);

INSERT INTO kanban_categories (name, description, color, position)
SELECT 'Novos', 'Tickets que ainda não foram organizados', '#2563EB', 0
WHERE NOT EXISTS (SELECT 1 FROM kanban_categories);

INSERT INTO kanban_categories (name, description, color, position)
SELECT 'Prioridade alta', 'Casos que precisam de atenção rápida', '#DC2626', 1
WHERE NOT EXISTS (SELECT 1 FROM kanban_categories WHERE name = 'Prioridade alta');

INSERT INTO kanban_categories (name, description, color, position)
SELECT 'Em triagem', 'Tickets sendo analisados pela equipe', '#D97706', 2
WHERE NOT EXISTS (SELECT 1 FROM kanban_categories WHERE name = 'Em triagem');

INSERT INTO kanban_categories (name, description, color, position)
SELECT 'Aguardando cliente', 'Aguardando uma resposta do cliente', '#0891B2', 3
WHERE NOT EXISTS (SELECT 1 FROM kanban_categories WHERE name = 'Aguardando cliente');

UPDATE tickets
SET board_category_id = (SELECT id FROM kanban_categories ORDER BY position, created_at LIMIT 1)
WHERE board_category_id IS NULL;
