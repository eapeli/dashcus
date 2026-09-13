import type { Ticket } from '@/lib/types';
import { supabase } from '@/lib/supabase';

const bridgeUrl = import.meta.env.VITE_DISCORD_BRIDGE_URL as string | undefined;

interface DiscordUploadResponse {
  url: string;
  name?: string;
  messageId?: string;
}

export async function uploadToDiscord({
  ticket,
  file,
  attachmentType,
  senderId,
  senderName,
}: {
  ticket: Ticket;
  file: Blob;
  attachmentType: 'image' | 'audio' | 'video' | 'file' | 'transcript';
  senderId: string;
  senderName: string;
}): Promise<DiscordUploadResponse> {
  if (!bridgeUrl) {
    throw new Error('VITE_DISCORD_BRIDGE_URL não configurada');
  }

  const formData = new FormData();
  formData.append('file', file, attachmentType === 'transcript' ? `transcript-${ticket.ticket_number}.txt` : file instanceof File ? file.name : 'attachment');
  formData.append('ticketId', ticket.id);
  formData.append('discordChannelId', ticket.discord_channel_id || '');
  formData.append('senderId', senderId);
  formData.append('senderName', senderName);
  formData.append('attachmentType', attachmentType);

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.access_token) throw new Error('Sessão Supabase não encontrada');

  const response = await fetch(`${bridgeUrl.replace(/\/$/, '')}/discord/attachments`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
    headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
  });

  if (!response.ok) {
    throw new Error(`Falha no bot Discord (${response.status})`);
  }

  const data = await response.json() as DiscordUploadResponse;
  if (!data.url) throw new Error('O bot não retornou a URL do anexo');
  return data;
}
