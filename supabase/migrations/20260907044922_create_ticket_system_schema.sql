/*
# Ticket Support Dashboard Schema

## Overview
Creates a complete ticket support system for Discord-integrated customer service.

## New Tables
1. departments — Support departments/sectors
2. profiles — Agent profiles linked to Supabase auth users
3. tickets — Support tickets with full lifecycle
4. messages — Chat messages within a ticket
5. ticket_events — Audit log of ticket lifecycle events

## Security
- RLS enabled on all tables
- All tables accessible to authenticated users (shared support workspace)
*/

CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text DEFAULT '',
  color text DEFAULT '#3B82F6',
  discord_channel_id text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  avatar_url text,
  discord_id text,
  discord_username text,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  role text NOT NULL DEFAULT 'agent' CHECK (role IN ('agent', 'supervisor', 'admin')),
  status text NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'away')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number SERIAL UNIQUE,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT 'duvida' CHECK (category IN ('funcionario', 'reclamacao', 'duvida', 'consulta', 'contratacao')),
  subject text NOT NULL,
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_progress', 'resolved', 'closed', 'transferred')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  customer_name text NOT NULL,
  customer_discord_id text,
  discord_channel_id text,
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  transferred_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  transfer_reason text,
  opened_at timestamptz DEFAULT now(),
  picked_up_at timestamptz,
  closed_at timestamptz,
  close_reason text,
  close_notes text,
  transcript_url text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('customer', 'agent', 'system')),
  sender_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  sender_name text NOT NULL,
  content text,
  attachment_type text NOT NULL DEFAULT 'none' CHECK (attachment_type IN ('none', 'image', 'audio', 'video', 'file')),
  attachment_url text,
  attachment_name text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ticket_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('created', 'picked_up', 'transferred', 'closed', 'message_sent', 'reopened')),
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  actor_name text NOT NULL,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_department ON tickets(department_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_ticket_id ON messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_ticket_events_ticket_id ON ticket_events(ticket_id);
CREATE INDEX IF NOT EXISTS idx_profiles_department ON profiles(department_id);

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dept_select_all" ON departments;
CREATE POLICY "dept_select_all" ON departments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "dept_insert_all" ON departments;
CREATE POLICY "dept_insert_all" ON departments FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "dept_update_all" ON departments;
CREATE POLICY "dept_update_all" ON departments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "profile_select_all" ON profiles;
CREATE POLICY "profile_select_all" ON profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "profile_insert_own" ON profiles;
CREATE POLICY "profile_insert_own" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profile_update_own" ON profiles;
CREATE POLICY "profile_update_own" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "ticket_select_all" ON tickets;
CREATE POLICY "ticket_select_all" ON tickets FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "ticket_insert_all" ON tickets;
CREATE POLICY "ticket_insert_all" ON tickets FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "ticket_update_all" ON tickets;
CREATE POLICY "ticket_update_all" ON tickets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "ticket_delete_all" ON tickets;
CREATE POLICY "ticket_delete_all" ON tickets FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "msg_select_all" ON messages;
CREATE POLICY "msg_select_all" ON messages FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "msg_insert_all" ON messages;
CREATE POLICY "msg_insert_all" ON messages FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "event_select_all" ON ticket_events;
CREATE POLICY "event_select_all" ON ticket_events FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "event_insert_all" ON ticket_events;
CREATE POLICY "event_insert_all" ON ticket_events FOR INSERT TO authenticated WITH CHECK (true);
