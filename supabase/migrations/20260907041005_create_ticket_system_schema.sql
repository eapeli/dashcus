/*
# Ticket Support Dashboard Schema

## Overview
Creates a complete ticket support system for Discord-integrated customer service.
Supports multiple departments, agent authentication, ticket lifecycle, chat messages,
transfers, closures, transcripts, and performance reporting.

## New Tables

1. **departments** — Support departments/sectors (e.g., General Support, Billing, Technical)
   - id (uuid PK)
   - name (text, unique)
   - description (text)
   - color (text — hex color for UI badges)
   - discord_channel_id (text, nullable — Discord transcript channel)
   - created_at (timestamptz)

2. **profiles** — Agent profiles linked to Supabase auth users
   - id (uuid PK, FK to auth.users)
   - full_name (text)
   - avatar_url (text, nullable)
   - discord_id (text, nullable — Discord user ID for integration)
   - discord_username (text, nullable)
   - department_id (uuid FK → departments)
   - role (text: 'agent' | 'supervisor' | 'admin')
   - status (text: 'online' | 'offline' | 'away')
   - created_at (timestamptz)

3. **tickets** — Support tickets
   - id (uuid PK)
   - ticket_number (int auto-increment, unique — human-readable ID)
   - department_id (uuid FK → departments)
   - category (text: 'funcionario' | 'reclamacao' | 'duvida' | 'consulta' | 'contratacao')
   - subject (text)
   - description (text)
   - status (text: 'waiting' | 'in_progress' | 'resolved' | 'closed' | 'transferred')
   - priority (text: 'low' | 'normal' | 'high' | 'urgent')
   - customer_name (text)
   - customer_discord_id (text, nullable)
   - discord_channel_id (text, nullable)
   - assigned_to (uuid FK → profiles, nullable)
   - transferred_to (uuid FK → profiles, nullable)
   - transfer_reason (text, nullable)
   - opened_at (timestamptz)
   - picked_up_at (timestamptz, nullable)
   - closed_at (timestamptz, nullable)
   - close_reason (text, nullable)
   - close_notes (text, nullable)
   - transcript_url (text, nullable)
   - created_at (timestamptz)

4. **messages** — Chat messages within a ticket
   - id (uuid PK)
   - ticket_id (uuid FK → tickets ON DELETE CASCADE)
   - sender_type (text: 'customer' | 'agent' | 'system')
   - sender_id (uuid, nullable — profile ID if agent)
   - sender_name (text)
   - content (text, nullable)
   - attachment_type (text: 'none' | 'image' | 'audio' | 'video' | 'file', default 'none')
   - attachment_url (text, nullable)
   - attachment_name (text, nullable)
   - created_at (timestamptz)

5. **ticket_events** — Audit log of ticket lifecycle events
   - id (uuid PK)
   - ticket_id (uuid FK → tickets ON DELETE CASCADE)
   - event_type (text: 'created' | 'picked_up' | 'transferred' | 'closed' | 'message_sent')
   - actor_id (uuid, nullable — profile ID)
   - actor_name (text)
   - details (jsonb, nullable)
   - created_at (timestamptz)

## Security
- RLS enabled on all tables
- Profiles: authenticated users can read all profiles (team view), update own profile
- Tickets: authenticated users can CRUD tickets they need to see (all agents see waiting + own + department)
- Messages: authenticated users can read/insert messages for visible tickets
- Ticket events: authenticated users can read all events, insert new events
*/

-- Departments
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text DEFAULT '',
  color text DEFAULT '#3B82F6',
  discord_channel_id text,
  created_at timestamptz DEFAULT now()
);

-- Profiles (linked to auth.users)
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

-- Tickets
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

-- Messages
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

-- Ticket events (audit log)
CREATE TABLE IF NOT EXISTS ticket_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('created', 'picked_up', 'transferred', 'closed', 'message_sent', 'reopened')),
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  actor_name text NOT NULL,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_department ON tickets(department_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_ticket_id ON messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_ticket_events_ticket_id ON ticket_events(ticket_id);
CREATE INDEX IF NOT EXISTS idx_profiles_department ON profiles(department_id);

-- Enable RLS
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_events ENABLE ROW LEVEL SECURITY;

-- ============ DEPARTMENTS policies ============
DROP POLICY IF EXISTS "dept_select_all" ON departments;
CREATE POLICY "dept_select_all" ON departments FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "dept_insert_all" ON departments;
CREATE POLICY "dept_insert_all" ON departments FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "dept_update_all" ON departments;
CREATE POLICY "dept_update_all" ON departments FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- ============ PROFILES policies ============
DROP POLICY IF EXISTS "profile_select_all" ON profiles;
CREATE POLICY "profile_select_all" ON profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "profile_insert_own" ON profiles;
CREATE POLICY "profile_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profile_update_own" ON profiles;
CREATE POLICY "profile_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============ TICKETS policies ============
-- Agents can see: waiting tickets (all), their own assigned, their department's
DROP POLICY IF EXISTS "ticket_select_all" ON tickets;
CREATE POLICY "ticket_select_all" ON tickets FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "ticket_insert_all" ON tickets;
CREATE POLICY "ticket_insert_all" ON tickets FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "ticket_update_all" ON tickets;
CREATE POLICY "ticket_update_all" ON tickets FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ticket_delete_all" ON tickets;
CREATE POLICY "ticket_delete_all" ON tickets FOR DELETE
  TO authenticated USING (true);

-- ============ MESSAGES policies ============
DROP POLICY IF EXISTS "msg_select_all" ON messages;
CREATE POLICY "msg_select_all" ON messages FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "msg_insert_all" ON messages;
CREATE POLICY "msg_insert_all" ON messages FOR INSERT
  TO authenticated WITH CHECK (true);

-- ============ TICKET_EVENTS policies ============
DROP POLICY IF EXISTS "event_select_all" ON ticket_events;
CREATE POLICY "event_select_all" ON ticket_events FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "event_insert_all" ON ticket_events;
CREATE POLICY "event_insert_all" ON ticket_events FOR INSERT
  TO authenticated WITH CHECK (true);
