export type TicketStatus = 'waiting' | 'in_progress' | 'resolved' | 'closed' | 'transferred';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TicketCategory = 'funcionario' | 'reclamacao' | 'duvida' | 'consulta' | 'contratacao';
export type AgentRole = 'agent' | 'supervisor' | 'admin';
export type AgentStatus = 'online' | 'offline' | 'away';
export type SenderType = 'customer' | 'agent' | 'system';
export type AttachmentType = 'none' | 'image' | 'audio' | 'video' | 'file';

export interface Department {
  id: string;
  name: string;
  description: string;
  color: string;
  discord_channel_id: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  discord_id: string | null;
  discord_username: string | null;
  department_id: string | null;
  role: AgentRole;
  status: AgentStatus;
  created_at: string;
}

export interface Ticket {
  id: string;
  ticket_number: number;
  department_id: string | null;
  category: TicketCategory;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  customer_name: string;
  customer_discord_id: string | null;
  discord_channel_id: string | null;
  discord_staff_channel_id: string | null;
  assigned_to: string | null;
  transferred_to: string | null;
  transfer_reason: string | null;
  opened_at: string;
  picked_up_at: string | null;
  closed_at: string | null;
  close_reason: string | null;
  close_notes: string | null;
  transcript_url: string | null;
  feedback_success: boolean | null;
  feedback_text: string | null;
  board_category_id: string | null;
  created_at: string;
}

export interface KanbanCategory {
  id: string;
  name: string;
  description: string;
  color: string;
  position: number;
  created_by: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  ticket_id: string;
  sender_type: SenderType;
  sender_id: string | null;
  sender_name: string;
  content: string | null;
  attachment_type: AttachmentType;
  attachment_url: string | null;
  attachment_name: string | null;
  created_at: string;
}

export interface TicketEvent {
  id: string;
  ticket_id: string;
  event_type: 'created' | 'picked_up' | 'transferred' | 'closed' | 'message_sent' | 'reopened';
  actor_id: string | null;
  actor_name: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

export const STATUS_LABELS: Record<TicketStatus, string> = {
  waiting: 'Aguardando',
  in_progress: 'Em Atendimento',
  resolved: 'Resolvido',
  closed: 'Fechado',
  transferred: 'Transferido',
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'Baixa',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
};

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  funcionario: 'Funcionário',
  reclamacao: 'Reclamação',
  duvida: 'Dúvida',
  consulta: 'Consulta',
  contratacao: 'Contratação',
};

export const STATUS_COLORS: Record<TicketStatus, string> = {
  waiting: 'bg-amber-100 text-amber-700 border-amber-200',
  in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
  resolved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  closed: 'bg-gray-200 text-gray-600 border-gray-300',
  transferred: 'bg-purple-100 text-purple-700 border-purple-200',
};

export const PRIORITY_COLORS: Record<TicketPriority, string> = {
  low: 'bg-gray-100 text-gray-600 border-gray-200',
  normal: 'bg-blue-100 text-blue-600 border-blue-200',
  high: 'bg-orange-100 text-orange-600 border-orange-200',
  urgent: 'bg-red-100 text-red-600 border-red-200',
};

export const PRIORITY_DOT: Record<TicketPriority, string> = {
  low: 'bg-gray-400',
  normal: 'bg-blue-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-500',
};
