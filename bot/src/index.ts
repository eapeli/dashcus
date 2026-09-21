import cors from 'cors';
import express from 'express';
import multer from 'multer';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  ModalBuilder,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import type { ChatInputCommandInteraction, Message, ModalSubmitInteraction } from 'discord.js';
import { config } from './config.js';
import { supabase } from './supabase.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024 },
});

const categories = {
  duvida: { label: 'Dúvidas', color: 0x12b981 },
  reclamacao: { label: 'Reclamação', color: 0x5865f2 },
  funcionario: { label: 'Reportar Funcionário', color: 0xef4444 },
} as const;

type TicketCategory = keyof typeof categories;
type TicketRow = {
  id: string;
  ticket_number: number;
  subject: string;
  customer_name: string;
  customer_discord_id: string | null;
  discord_channel_id: string | null;
  assigned_to: string | null;
  status: string;
  priority: string;
};

type ProfileRow = {
  id: string;
  full_name: string;
  discord_id: string | null;
  discord_username: string | null;
  role: string;
};

const departmentNames: Record<string, string> = {
  atendimento_geral: 'Atendimento Geral',
  suporte_tecnico: 'Suporte Técnico',
  financeiro: 'Financeiro',
  recursos_humanos: 'Recursos Humanos',
};

const ticketCommand = new SlashCommandBuilder()
  .setName('ticket')
  .setDescription('Abre um atendimento com a equipe')
  .addStringOption((option) => option.setName('assunto').setDescription('Assunto do atendimento').setRequired(true))
  .addStringOption((option) => option.setName('departamento').setDescription('Departamento responsável').setRequired(true).addChoices(
    { name: 'Atendimento Geral', value: 'atendimento_geral' },
    { name: 'Suporte Técnico', value: 'suporte_tecnico' },
    { name: 'Financeiro', value: 'financeiro' },
    { name: 'Recursos Humanos', value: 'recursos_humanos' },
  ));

const manageCommand = new SlashCommandBuilder()
  .setName('gerenciar')
  .setDescription('Mostra o painel de gestão do atendimento deste canal (apenas staff)');

const panelChannelId = process.env.DISCORD_CHANNEL_TICKET_PANEL_ID || '';

function isTextChannel(channel: unknown): channel is TextChannel {
  return channel instanceof TextChannel;
}

function categoryValue(value: string): TicketCategory {
  return value in categories ? value as TicketCategory : 'duvida';
}

function priorityLabel(priority: string): string {
  return ({ low: 'Baixa', normal: 'Normal', high: 'Alta', urgent: 'Urgente' } as Record<string, string>)[priority] || 'Normal';
}

function priorityColor(priority: string): number {
  return ({ low: 0x64748b, normal: 0x3b82f6, high: 0xf59e0b, urgent: 0xef4444 } as Record<string, number>)[priority] || 0x3b82f6;
}

function cleanChannelName(subject: string): string {
  return subject.replace(/[^a-zA-Z0-9\- ]/g, '').trim().slice(0, 45).replace(/\s+/g, '-') || 'atendimento';
}

function ticketControls(ticketId: string, status: string): ActionRowBuilder<ButtonBuilder>[] {
  if (status === 'closed') {
    return [new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`ticket_reopen:${ticketId}`).setLabel('Reabrir atendimento').setStyle(ButtonStyle.Success),
    )];
  }
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`ticket_claim:${ticketId}`).setLabel('Assumir').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`ticket_transfer:${ticketId}`).setLabel('Transferir').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`ticket_priority:${ticketId}`).setLabel('Prioridade').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`ticket_close:${ticketId}`).setLabel('Encerrar').setStyle(ButtonStyle.Danger),
    ),
  ];
}

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(config.discordToken);
  await rest.put(Routes.applicationGuildCommands(config.discordClientId, config.hpGuildId), {
    body: [ticketCommand.toJSON(), manageCommand.toJSON()],
  });
}

async function getTicket(ticketId: string): Promise<TicketRow | null> {
  const { data } = await supabase.from('tickets').select('id,ticket_number,subject,customer_name,customer_discord_id,discord_channel_id,assigned_to,status,priority').eq('id', ticketId).maybeSingle();
  return data as TicketRow | null;
}

async function getProfileByDiscordId(discordId: string): Promise<ProfileRow | null> {
  const { data } = await supabase.from('profiles').select('id,full_name,discord_id,discord_username,role').eq('discord_id', discordId).maybeSingle();
  return data as ProfileRow | null;
}

async function getProfileByDiscordReference(reference: string): Promise<ProfileRow | null> {
  const normalized = reference.replace(/[<@!>]/g, '').trim();
  if (/^\d{15,25}$/.test(normalized)) return getProfileByDiscordId(normalized);
  const { data } = await supabase
    .from('profiles')
    .select('id,full_name,discord_id,discord_username,role')
    .ilike('discord_username', normalized)
    .maybeSingle();
  return data as ProfileRow | null;
}

async function addSystemMessage(ticketId: string, content: string) {
  await supabase.from('messages').insert({
    ticket_id: ticketId,
    sender_type: 'system',
    sender_name: 'Central de Atendimento',
    content,
    attachment_type: 'none',
  });
}

async function postTicketEmbed(ticket: TicketRow, content?: string) {
  if (!ticket.discord_channel_id) return;
  const channel = await client.channels.fetch(ticket.discord_channel_id);
  if (!isTextChannel(channel)) return;
  const embed = new EmbedBuilder()
    .setColor(priorityColor(ticket.priority))
    .setTitle(`Atendimento #${ticket.ticket_number}`)
    .setDescription(ticket.subject)
    .addFields(
      { name: 'Prioridade', value: priorityLabel(ticket.priority), inline: true },
      { name: 'Status', value: ticket.status === 'transferred' ? 'Transferido' : ticket.status === 'in_progress' ? 'Em atendimento' : 'Aguardando', inline: true },
      { name: 'Cliente', value: ticket.customer_discord_id ? `<@${ticket.customer_discord_id}>` : ticket.customer_name, inline: true },
    )
    .setFooter({ text: 'CUS • Central de Atendimento' })
    .setTimestamp();
  await channel.send({ content, embeds: [embed] });
}

async function createTicketForUser(
  interaction: ChatInputCommandInteraction | ModalSubmitInteraction,
  subject: string,
  category: TicketCategory,
  department = 'atendimento_geral',
) {
  const guild = await client.guilds.fetch(config.hpGuildId);
  const customerName = interaction.user.globalName || interaction.user.username;
  const { data: departmentRecord } = await supabase.from('departments').select('id').eq('name', departmentNames[department]).maybeSingle();
  const { data: ticket, error } = await supabase.from('tickets').insert({
    department_id: departmentRecord?.id || null,
    category,
    subject: subject.trim(),
    description: `Atendimento aberto pelo Discord por ${interaction.user.tag}`,
    status: 'waiting',
    priority: 'normal',
    customer_name: customerName,
    customer_discord_id: interaction.user.id,
  }).select('id,ticket_number,subject,customer_name,customer_discord_id,discord_channel_id,assigned_to,status,priority').maybeSingle();

  if (error || !ticket) {
    await interaction.reply({ content: 'Não foi possível registrar seu atendimento agora.', ephemeral: true });
    return;
  }

  const channelName = `ticket-${ticket.ticket_number}-${cleanChannelName(subject)}`;

  const permissionOverwrites = [
    { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    { id: client.user!.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
  ];
  if (config.staffRoleId) {
    permissionOverwrites.push({ id: config.staffRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
  }

  const ticketChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: config.staffCategoryId || undefined,
    permissionOverwrites,
    reason: `Atendimento #${ticket.ticket_number}`,
  });

  const introEmbed = new EmbedBuilder()
    .setColor(categories[category].color)
    .setTitle(`Atendimento #${ticket.ticket_number}`)
    .setDescription('Seu atendimento foi criado. Explique todos os detalhes neste canal para que a equipe possa ajudar com agilidade.')
    .addFields(
      { name: 'Assunto', value: subject.trim(), inline: false },
      { name: 'Categoria', value: categories[category].label, inline: true },
      { name: 'Departamento', value: departmentNames[department], inline: true },
      { name: 'Próximo passo', value: 'Um atendente assumirá o caso em breve.', inline: false },
      { name: 'Staff', value: 'Use `/gerenciar` para abrir o painel de gestão deste atendimento.', inline: false },
    )
    .setFooter({ text: 'CUS • Central de Atendimento' })
    .setTimestamp();

  await ticketChannel.send({
    content: `<@${interaction.user.id}>`,
    embeds: [introEmbed],
  });

  await supabase.from('tickets').update({ discord_channel_id: ticketChannel.id }).eq('id', ticket.id);
  await supabase.from('messages').insert({
    ticket_id: ticket.id,
    sender_type: 'customer',
    sender_id: null,
    sender_name: customerName,
    content: subject.trim(),
    attachment_type: 'none',
  });
  await supabase.from('ticket_events').insert({
    ticket_id: ticket.id,
    event_type: 'created',
    actor_id: null,
    actor_name: customerName,
    details: { source: 'discord', category: categories[category].label, department: departmentNames[department] },
  });

  await interaction.reply({ content: `Seu atendimento foi aberto com sucesso: ${ticketChannel}`, ephemeral: true });
}

async function openTicket(interaction: ChatInputCommandInteraction) {
  await createTicketForUser(
    interaction,
    interaction.options.getString('assunto', true),
    'duvida',
    interaction.options.getString('departamento', true),
  );
}

async function publishTicketPanel() {
  if (!panelChannelId) {
    console.warn('DISCORD_CHANNEL_TICKET_PANEL_ID não configurado; painel de abertura não será publicado.');
    return;
  }
  const channel = await client.channels.fetch(panelChannelId);
  if (!isTextChannel(channel) || channel.guild.id !== config.hpGuildId) throw new Error('Canal do painel não pertence ao servidor configurado');
  const recentMessages = await channel.messages.fetch({ limit: 50 });
  const panelExists = recentMessages.some((message) => message.author.id === client.user?.id && message.embeds.some((embed) => embed.title === 'CUS | Central de Atendimento'));
  if (panelExists) return;

  const panel = new EmbedBuilder()
    .setColor(0x08a6c9)
    .setTitle('CUS | Central de Atendimento')
    .setDescription('Precisa de ajuda? Escolha uma categoria abaixo para abrir um atendimento privado com a equipe.\n\n**Antes de abrir**\nExplique o problema com clareza e envie todos os detalhes necessários. Isso ajuda a equipe a responder mais rápido.')
    .addFields(
      { name: 'Dúvidas', value: 'Informações gerais, orientações e perguntas sobre os serviços.', inline: false },
      { name: 'Reclamação', value: 'Insatisfações, problemas no atendimento ou na estrutura.', inline: false },
      { name: 'Reportar Funcionário', value: 'Relatos sobre condutas inadequadas ou incidentes.', inline: false },
    )
    .setFooter({ text: 'CUS • Vidas alheias, riquezas a salvar' });

  await channel.send({
    embeds: [panel],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('ticket_category:duvida').setLabel('Dúvidas').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('ticket_category:reclamacao').setLabel('Reclamação').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ticket_category:funcionario').setLabel('Reportar Funcionário').setStyle(ButtonStyle.Danger),
    )],
  });
}

async function showTicketSubjectModal(interaction: ButtonInteraction) {
  const category = categoryValue(interaction.customId.replace('ticket_category:', ''));
  const modal = new ModalBuilder().setCustomId(`ticket_subject:${category}`).setTitle(categories[category].label);
  const subject = new TextInputBuilder()
    .setCustomId('subject')
    .setLabel('Sobre o que você precisa de ajuda?')
    .setPlaceholder('Descreva o assunto do atendimento')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(5)
    .setMaxLength(500);
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(subject));
  await interaction.showModal(modal);
}

async function syncDiscordMessage(message: Message) {
  if (message.author.bot || !isTextChannel(message.channel)) return;
  const channel = message.channel as TextChannel;
  const { data: ticket } = await supabase.from('tickets').select('id,customer_discord_id').eq('discord_channel_id', channel.id).maybeSingle();
  if (!ticket) return;

  const agent = await getProfileByDiscordId(message.author.id);
  const senderType = agent ? 'agent' : 'customer';
  const senderName = agent?.full_name || message.author.globalName || message.author.username;
  const senderId = agent?.id || null;

  for (const attachment of message.attachments.values()) {
    const type = attachment.contentType?.startsWith('image/') ? 'image' : attachment.contentType?.startsWith('audio/') ? 'audio' : attachment.contentType?.startsWith('video/') ? 'video' : 'file';
    await supabase.from('messages').insert({
      ticket_id: ticket.id,
      sender_type: senderType,
      sender_id: senderId,
      sender_name: senderName,
      content: message.content || null,
      attachment_type: type,
      attachment_url: attachment.url,
      attachment_name: attachment.name,
    });
  }

  if (message.content) {
    await supabase.from('messages').insert({
      ticket_id: ticket.id,
      sender_type: senderType,
      sender_id: senderId,
      sender_name: senderName,
      content: message.content,
      attachment_type: 'none',
    });
  }
}

async function syncDashboardMessage(payload: { new: Record<string, unknown> }) {
  const message = payload.new;
  if (message.sender_type !== 'agent' || message.attachment_type !== 'none') return;
  const ticketId = String(message.ticket_id);
  const { data: ticket } = await supabase.from('tickets').select('discord_channel_id').eq('id', ticketId).maybeSingle();
  if (!ticket?.discord_channel_id || !message.content) return;
  const channel = await client.channels.fetch(ticket.discord_channel_id);
  if (isTextChannel(channel)) {
    await channel.send({ content: `**${message.sender_name}**\n${message.content}` });
  }
}

async function assertStaff(interaction: ButtonInteraction | StringSelectMenuInteraction): Promise<ProfileRow | null> {
  const profile = await getProfileByDiscordId(interaction.user.id);
  if (!profile) {
    await interaction.reply({ content: 'Apenas a staff pode usar este botão.', ephemeral: true });
    return null;
  }
  return profile;
}

async function claimTicket(interaction: ButtonInteraction, ticketId: string) {
  const profile = await assertStaff(interaction);
  const ticket = await getTicket(ticketId);
  if (!profile || !ticket) {
    if (ticket) await interaction.reply({ content: 'Apenas a staff pode usar este botão.', ephemeral: true });
    return;
  }
  if (ticket.status === 'closed') {
    await interaction.reply({ content: 'Este atendimento já está encerrado.', ephemeral: true });
    return;
  }
  if (ticket.assigned_to && ticket.assigned_to !== profile.id) {
    await interaction.reply({ content: 'Este atendimento já está sendo conduzido por outro atendente.', ephemeral: true });
    return;
  }
  await supabase.from('tickets').update({ status: 'in_progress', assigned_to: profile.id, picked_up_at: new Date().toISOString() }).eq('id', ticketId);
  await supabase.from('ticket_events').insert({ ticket_id: ticketId, event_type: 'picked_up', actor_id: profile.id, actor_name: profile.full_name, details: { source: 'discord' } });
  await addSystemMessage(ticketId, `${profile.full_name} assumiu este atendimento.`);

  const updatedTicket = { ...ticket, status: 'in_progress' as const, assigned_to: profile.id };
  await interaction.reply({ content: 'Atendimento assumido. Você já pode responder pela dashboard ou por este canal.', ephemeral: true });
  await postTicketEmbed(updatedTicket, `Atendimento assumido por **${profile.full_name}**.`);
}

async function showTransferModal(interaction: ButtonInteraction, ticketId: string) {
  const profile = await assertStaff(interaction);
  if (!profile) return;
  const modal = new ModalBuilder().setCustomId(`ticket_transfer_submit:${ticketId}`).setTitle('Transferir atendimento');
  const target = new TextInputBuilder().setCustomId('target').setLabel('ID ou username do atendente').setPlaceholder('Ex.: 123456789012345678 ou usuario').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100);
  const reason = new TextInputBuilder().setCustomId('reason').setLabel('Motivo da transferência').setPlaceholder('Explique brevemente o motivo').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500);
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(target), new ActionRowBuilder<TextInputBuilder>().addComponents(reason));
  await interaction.showModal(modal);
}

async function transferTicket(interaction: ModalSubmitInteraction, ticketId: string) {
  const actor = await getProfileByDiscordId(interaction.user.id);
  const targetReference = interaction.fields.getTextInputValue('target');
  const reason = interaction.fields.getTextInputValue('reason');
  const target = await getProfileByDiscordReference(targetReference);
  if (!actor || !target || !target.discord_id) {
    await interaction.reply({ content: 'Não encontrei um atendente cadastrado com esse ID ou username do Discord.', ephemeral: true });
    return;
  }
  const ticket = await getTicket(ticketId);
  if (!ticket || ticket.status === 'closed') {
    await interaction.reply({ content: 'Este atendimento não está disponível para transferência.', ephemeral: true });
    return;
  }
  await supabase.from('tickets').update({ status: 'transferred', assigned_to: target.id, transferred_to: target.id, transfer_reason: reason }).eq('id', ticketId);
  await supabase.from('ticket_events').insert({ ticket_id: ticketId, event_type: 'transferred', actor_id: actor.id, actor_name: actor.full_name, details: { target: target.full_name, target_discord_id: target.discord_id, reason, source: 'discord' } });
  await addSystemMessage(ticketId, `Atendimento transferido de ${actor.full_name} para ${target.full_name}. Motivo: ${reason}`);
  await interaction.reply({ content: `Atendimento transferido para ${target.full_name}.`, ephemeral: true });
  const updatedTicket = { ...ticket, status: 'transferred' as const, assigned_to: target.id };
  await postTicketEmbed(updatedTicket, `Atendimento transferido para <@${target.discord_id}>.`);

  if (ticket.discord_channel_id && target.discord_id) {
    const channel = await client.channels.fetch(ticket.discord_channel_id);
    if (isTextChannel(channel)) {
      await channel.permissionOverwrites.edit(target.discord_id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
    }
  }
}

async function showPriorityMenu(interaction: ButtonInteraction, ticketId: string) {
  const profile = await assertStaff(interaction);
  if (!profile) return;
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`ticket_priority_submit:${ticketId}`)
    .setPlaceholder('Escolha a prioridade')
    .addOptions(
      { label: 'Baixa', value: 'low', description: 'Pode aguardar', emoji: '○' },
      { label: 'Normal', value: 'normal', description: 'Atendimento padrão', emoji: '•' },
      { label: 'Alta', value: 'high', description: 'Atender com prioridade', emoji: '▲' },
      { label: 'Urgente', value: 'urgent', description: 'Atenção imediata', emoji: '!' },
    );
  await interaction.reply({ content: 'Defina a prioridade deste atendimento:', components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)], ephemeral: true });
}

async function updatePriority(interaction: StringSelectMenuInteraction, ticketId: string) {
  const profile = await assertStaff(interaction);
  const priority = interaction.values[0];
  if (!profile || !['low', 'normal', 'high', 'urgent'].includes(priority)) {
    await interaction.update({ content: 'Apenas a staff pode alterar a prioridade.', components: [] });
    return;
  }
  await supabase.from('tickets').update({ priority }).eq('id', ticketId);
  await addSystemMessage(ticketId, `${profile.full_name} definiu a prioridade como ${priorityLabel(priority)}.`);
  await interaction.update({ content: `Prioridade atualizada para **${priorityLabel(priority)}**.`, components: [] });
}

async function closeTicket(interaction: ButtonInteraction, ticketId: string) {
  const ticket = await getTicket(ticketId);
  if (!ticket) {
    await interaction.reply({ content: 'Atendimento não encontrado.', ephemeral: true });
    return;
  }
  const profile = await assertStaff(interaction);
  if (!profile) return;
  const modal = new ModalBuilder().setCustomId(`ticket_close_submit:${ticketId}`).setTitle('Encerrar atendimento');
  const resolved = new TextInputBuilder().setCustomId('resolved').setLabel('O caso foi resolvido? (sim ou nao)').setPlaceholder('sim ou nao').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(3);
  const feedback = new TextInputBuilder().setCustomId('feedback').setLabel('Feedback do atendimento').setPlaceholder('Conte brevemente como foi a solução').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(1000);
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(resolved), new ActionRowBuilder<TextInputBuilder>().addComponents(feedback));
  await interaction.showModal(modal);
}

async function closeTicketSubmit(interaction: ModalSubmitInteraction, ticketId: string) {
  const ticket = await getTicket(ticketId);
  if (!ticket) {
    await interaction.reply({ content: 'Atendimento não encontrado.', ephemeral: true });
    return;
  }
  const profile = await getProfileByDiscordId(interaction.user.id);
  if (!profile) {
    await interaction.reply({ content: 'Apenas a staff pode encerrar atendimentos.', ephemeral: true });
    return;
  }
  const resolvedInput = interaction.fields.getTextInputValue('resolved').trim().toLowerCase();
  const feedback = interaction.fields.getTextInputValue('feedback').trim();
  const resolved = ['sim', 's', 'yes'].includes(resolvedInput);
  const { data: messages } = await supabase.from('messages').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true });
  const transcript = (messages || []).map((message) => `[${new Date(message.created_at).toLocaleString('pt-BR')}] ${message.sender_name} (${message.sender_type}): ${message.content || `[Anexo: ${message.attachment_name || message.attachment_url}]`}`).join('\n');
  const transcriptBuffer = Buffer.from(`Transcript do atendimento #${ticket.ticket_number}\nAssunto: ${ticket.subject}\nCliente: ${ticket.customer_name}\n\n${transcript}\n\nResultado: ${resolved ? 'Resolvido' : 'Não resolvido'}\nFeedback: ${feedback || 'Não informado'}\n`);

  const closeEmbed = new EmbedBuilder()
    .setColor(resolved ? 0x10b981 : 0xef4444)
    .setTitle(`Atendimento #${ticket.ticket_number} encerrado`)
    .setDescription(`Resultado: **${resolved ? 'Resolvido' : 'Não resolvido'}**${feedback ? `\nFeedback: ${feedback}` : ''}`)
    .setFooter({ text: 'CUS • Central de Atendimento' })
    .setTimestamp();

  if (ticket.discord_channel_id) {
    const channel = await client.channels.fetch(ticket.discord_channel_id);
    if (isTextChannel(channel)) {
      await channel.send({ embeds: [closeEmbed], files: [{ attachment: transcriptBuffer, name: `transcript-${ticket.ticket_number}.txt` }] });
    }
  }
  if (config.channels.transcripts) {
    const transcriptChannel = await client.channels.fetch(config.channels.transcripts);
    if (isTextChannel(transcriptChannel) && transcriptChannel.guild.id === config.managementGuildId) {
      await transcriptChannel.send({ content: `Transcript do atendimento #${ticket.ticket_number}`, files: [{ attachment: transcriptBuffer, name: `transcript-${ticket.ticket_number}.txt` }] });
    }
  }

  await supabase.from('tickets').update({ status: 'closed', closed_at: new Date().toISOString(), close_reason: resolved ? 'Resolvido' : 'Não resolvido', close_notes: feedback, feedback_success: resolved, feedback_text: feedback || null }).eq('id', ticketId);
  await supabase.from('ticket_events').insert({ ticket_id: ticketId, event_type: 'closed', actor_id: null, actor_name: interaction.user.globalName || interaction.user.username, details: { resolved, feedback, source: 'discord' } });
  await addSystemMessage(ticketId, `Atendimento encerrado. Resultado: ${resolved ? 'resolvido' : 'não resolvido'}.${feedback ? ` Feedback: ${feedback}` : ''}`);
  await interaction.reply({ content: `Atendimento encerrado como **${resolved ? 'resolvido' : 'não resolvido'}**. O transcript foi arquivado.`, ephemeral: true });
}

async function reopenTicket(interaction: ButtonInteraction, ticketId: string) {
  const ticket = await getTicket(ticketId);
  if (!ticket) {
    await interaction.reply({ content: 'Atendimento não encontrado.', ephemeral: true });
    return;
  }
  const profile = await assertStaff(interaction);
  if (!profile) return;
  await supabase.from('tickets').update({ status: 'waiting', closed_at: null, close_reason: null }).eq('id', ticketId);
  await addSystemMessage(ticketId, 'Atendimento reaberto e devolvido para a fila.');
  await interaction.reply({ content: 'Atendimento reaberto e devolvido para a fila.', ephemeral: true });

  const reopenEmbed = new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle(`Atendimento #${ticket.ticket_number} reaberto`)
    .setDescription('Este atendimento foi reaberto e está novamente na fila da equipe.')
    .setFooter({ text: 'CUS • Central de Atendimento' })
    .setTimestamp();

  if (ticket.discord_channel_id) {
    const channel = await client.channels.fetch(ticket.discord_channel_id);
    if (isTextChannel(channel)) await channel.send({ embeds: [reopenEmbed] });
  }
}

async function showManagePanel(interaction: ChatInputCommandInteraction) {
  const profile = await getProfileByDiscordId(interaction.user.id);
  if (!profile) {
    await interaction.reply({ content: 'Apenas a staff pode usar este comando.', ephemeral: true });
    return;
  }
  if (!interaction.channel || !isTextChannel(interaction.channel)) {
    await interaction.reply({ content: 'Use este comando dentro do canal do atendimento.', ephemeral: true });
    return;
  }
  const { data: ticket } = await supabase.from('tickets').select('id,ticket_number,subject,customer_name,customer_discord_id,discord_channel_id,assigned_to,status,priority').eq('discord_channel_id', interaction.channel.id).maybeSingle();
  if (!ticket) {
    await interaction.reply({ content: 'Este canal não é um canal de atendimento.', ephemeral: true });
    return;
  }
  const embed = new EmbedBuilder()
    .setColor(priorityColor(ticket.priority))
    .setTitle(`Gestão do Atendimento #${ticket.ticket_number}`)
    .setDescription(ticket.subject)
    .addFields(
      { name: 'Prioridade', value: priorityLabel(ticket.priority), inline: true },
      { name: 'Status', value: ticket.status === 'transferred' ? 'Transferido' : ticket.status === 'in_progress' ? 'Em atendimento' : ticket.status === 'closed' ? 'Encerrado' : 'Aguardando', inline: true },
      { name: 'Cliente', value: ticket.customer_discord_id ? `<@${ticket.customer_discord_id}>` : ticket.customer_name, inline: true },
    )
    .setFooter({ text: 'CUS • Painel de gestão da staff' })
    .setTimestamp();
  await interaction.reply({ embeds: [embed], components: ticketControls(ticket.id, ticket.status), ephemeral: true });
}

async function createBridgeServer() {
  const app = express();
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.get('/health', (_request, response) => response.json({ ok: true, service: 'cus-discord-bot' }));
  app.post('/discord/attachments', upload.single('file'), async (request, response) => {
    try {
      const authorization = request.headers.authorization;
      const accessToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
      if (!accessToken) return response.status(401).json({ error: 'authorization required' });
      const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
      if (userError || !userData.user) return response.status(401).json({ error: 'invalid session' });
      if (!request.file) return response.status(400).json({ error: 'file is required' });
      const ticketId = String(request.body.ticketId || '');
      const ticketChannelId = String(request.body.discordChannelId || '');
      const attachmentType = String(request.body.attachmentType || 'file');
      const ticket = await getTicket(ticketId);
      if (!ticket || ticket.discord_channel_id !== ticketChannelId) return response.status(403).json({ error: 'ticket channel mismatch' });
      const channel = await client.channels.fetch(ticketChannelId);
      if (!isTextChannel(channel)) return response.status(400).json({ error: 'ticket channel is not a Discord text channel' });
      const discordMessage = await channel.send({ content: `**${request.body.senderName || 'Atendente'}** enviou um ${attachmentType === 'transcript' ? 'transcript' : 'anexo'}.`, files: [{ attachment: request.file.buffer, name: request.file.originalname }] });
      const attachment = discordMessage.attachments.first();
      if (!attachment) return response.status(502).json({ error: 'Discord did not return an attachment' });
      if (attachmentType === 'transcript' && config.channels.transcripts) {
        const transcriptChannel = await client.channels.fetch(config.channels.transcripts);
        if (isTextChannel(transcriptChannel) && transcriptChannel.guild.id === config.managementGuildId) await transcriptChannel.send({ content: `Transcript do ticket ${ticketId}`, files: [{ attachment: request.file.buffer, name: request.file.originalname }] });
      }
      return response.json({ url: attachment.url, name: attachment.name, messageId: discordMessage.id });
    } catch (error) {
      console.error('Attachment bridge error:', error);
      return response.status(500).json({ error: 'failed to send attachment to Discord' });
    }
  });
  app.listen(config.port, () => console.log(`Discord bridge listening on ${config.port}`));
}

client.once('ready', async (readyClient) => {
  await registerCommands();
  await createBridgeServer();
  await publishTicketPanel();
  console.log(`Logged in as ${readyClient.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === 'ticket') return void await openTicket(interaction);
    if (interaction.isChatInputCommand() && interaction.commandName === 'gerenciar') return void await showManagePanel(interaction);
    if (interaction.isButton() && interaction.customId.startsWith('ticket_category:')) return void await showTicketSubjectModal(interaction);
    if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_subject:')) {
      const category = categoryValue(interaction.customId.replace('ticket_subject:', ''));
      return void await createTicketForUser(interaction, interaction.fields.getTextInputValue('subject'), category);
    }
    if (interaction.isButton() && interaction.customId.startsWith('ticket_claim:')) return void await claimTicket(interaction, interaction.customId.replace('ticket_claim:', ''));
    if (interaction.isButton() && interaction.customId.startsWith('ticket_transfer:')) return void await showTransferModal(interaction, interaction.customId.replace('ticket_transfer:', ''));
    if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_transfer_submit:')) return void await transferTicket(interaction, interaction.customId.replace('ticket_transfer_submit:', ''));
    if (interaction.isButton() && interaction.customId.startsWith('ticket_priority:')) return void await showPriorityMenu(interaction, interaction.customId.replace('ticket_priority:', ''));
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('ticket_priority_submit:')) return void await updatePriority(interaction, interaction.customId.replace('ticket_priority_submit:', ''));
    if (interaction.isButton() && interaction.customId.startsWith('ticket_close:')) return void await closeTicket(interaction, interaction.customId.replace('ticket_close:', ''));
    if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_close_submit:')) return void await closeTicketSubmit(interaction, interaction.customId.replace('ticket_close_submit:', ''));
    if (interaction.isButton() && interaction.customId.startsWith('ticket_reopen:')) return void await reopenTicket(interaction, interaction.customId.replace('ticket_reopen:', ''));
  } catch (error) {
    console.error('Interaction error:', error);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) await interaction.reply({ content: 'Ocorreu um erro ao processar esta ação. Tente novamente.', ephemeral: true });
  }
});

client.on('messageCreate', (message) => { void syncDiscordMessage(message); });

supabase
  .channel('dashboard-to-discord')
  .on('postgres_changes' as const, { event: 'INSERT', schema: 'public', table: 'messages' }, (payload: { new: Record<string, unknown> }) => { void syncDashboardMessage(payload); })
  .subscribe();

void client.login(config.discordToken);
