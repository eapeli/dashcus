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
  duvida: { label: 'Dúvidas', emoji: '❓', color: 0x2d7fff, description: 'Informações gerais, orientações e perguntas sobre os serviços.' },
  reclamacao: { label: 'Reclamação', emoji: '⚠️', color: 0xf59e0b, description: 'Insatisfações, problemas no atendimento ou na estrutura.' },
  funcionario: { label: 'Reportar Funcionário', emoji: '🔴', color: 0xef4444, description: 'Relatos sobre condutas inadequadas ou incidentes.' },
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

const BRAND_COLOR = 0x08a6c9;
const BRAND_NAME = 'CUS';
const BRAND_TAGLINE = 'Vidas alheias, riquezas a salvar';

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

function priorityEmoji(priority: string): string {
  return ({ low: '🟢', normal: '🔵', high: '🟡', urgent: '🔴' } as Record<string, string>)[priority] || '🔵';
}

function statusLabel(status: string): string {
  return ({ waiting: 'Aguardando', in_progress: 'Em Atendimento', transferred: 'Transferido', closed: 'Encerrado' } as Record<string, string>)[status] || 'Aguardando';
}

function statusEmoji(status: string): string {
  return ({ waiting: '⏳', in_progress: '🎧', transferred: '↔️', closed: '🔒' } as Record<string, string>)[status] || '⏳';
}

function cleanChannelName(subject: string): string {
  return subject.replace(/[^a-zA-Z0-9\- ]/g, '').trim().slice(0, 45).replace(/\s+/g, '-') || 'atendimento';
}

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(config.discordToken);
  await rest.put(Routes.applicationGuildCommands(config.discordClientId, config.hpGuildId), {
    body: [ticketCommand.toJSON()],
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

async function getProfileById(profileId: string): Promise<ProfileRow | null> {
  const { data } = await supabase.from('profiles').select('id,full_name,discord_id,discord_username,role').eq('id', profileId).maybeSingle();
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

function buildWelcomeEmbed(ticket: TicketRow, subject: string, category: TicketCategory, department: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(categories[category].color)
    .setAuthor({ name: `${BRAND_NAME} • Central de Atendimento`, iconURL: client.user?.displayAvatarURL() || undefined })
    .setTitle(`${categories[category].emoji}  Atendimento #${ticket.ticket_number}`)
    .setDescription(`Olá <@${ticket.customer_discord_id}>! Seu atendimento foi aberto com sucesso.\n\nUm membro da equipe irá assumir seu caso em breve. Enquanto aguarda, **descreva todos os detalhes** do seu problema aqui neste canal para que possamos te ajudar com agilidade.`)
    .addFields(
      { name: '📝 Assunto', value: `\`\`\`${subject.trim()}\`\`\``, inline: false },
      { name: '📂 Categoria', value: `${categories[category].emoji} ${categories[category].label}`, inline: true },
      { name: '🏢 Departamento', value: departmentNames[department], inline: true },
      { name: '⏳ Status', value: 'Aguardando atendimento', inline: true },
    )
    .addFields(
      { name: '\u200B', value: '\u200B', inline: false },
      { name: '📋 Orientações', value: '• Mantenha o respeito no canal\n• Envie prints ou anexos se necessário\n• Não mencione @here ou @everyone\n• O atendimento é privado e visível apenas a você e a equipe', inline: false },
    )
    .setFooter({ text: `${BRAND_NAME} • ${BRAND_TAGLINE}`, iconURL: client.user?.displayAvatarURL() || undefined })
    .setTimestamp();
}

function buildStatusEmbed(ticket: TicketRow, agentName?: string): EmbedBuilder {
  const status = ticket.status;
  const colorMap: Record<string, number> = { waiting: 0xf59e0b, in_progress: 0x2d7fff, transferred: 0xa855f7, closed: 0x64748b };
  const embed = new EmbedBuilder()
    .setColor(colorMap[status] || BRAND_COLOR)
    .setAuthor({ name: `${BRAND_NAME} • Central de Atendimento`, iconURL: client.user?.displayAvatarURL() || undefined })
    .setTitle(`${statusEmoji(status)}  Atendimento #${ticket.ticket_number}`)
    .addFields(
      { name: 'Status', value: statusLabel(status), inline: true },
      { name: 'Prioridade', value: `${priorityEmoji(ticket.priority)} ${priorityLabel(ticket.priority)}`, inline: true },
      { name: 'Cliente', value: ticket.customer_discord_id ? `<@${ticket.customer_discord_id}>` : ticket.customer_name, inline: true },
    );

  if (status === 'in_progress' && agentName) {
    embed.setDescription(`🎧 **${agentName}** assumiu o seu atendimento e já está trabalhando no seu caso.\n\nA partir de agora, todas as mensagens da equipe aparecerão aqui automaticamente.`);
  } else if (status === 'transferred' && agentName) {
    embed.setDescription(`↔️ Seu atendimento foi **transferido** para **${agentName}**.\n\nO novo responsável irá dar continuidade ao seu caso.`);
  } else if (status === 'closed') {
    embed.setDescription(`🔒 Seu atendimento foi **encerrado**.\n\nAgradecemos o seu contato! Se precisar de ajuda novamente, abra um novo atendimento pelo painel.`);
  } else if (status === 'waiting') {
    embed.setDescription(`⏳ Seu atendimento voltou para a fila de espera.\n\nUm membro da equipe irá assumir em breve.`);
  }

  return embed
    .setFooter({ text: `${BRAND_NAME} • ${BRAND_TAGLINE}`, iconURL: client.user?.displayAvatarURL() || undefined })
    .setTimestamp();
}

function buildCloseEmbed(ticket: TicketRow, resolved: boolean, feedback: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(resolved ? 0x10b981 : 0xef4444)
    .setAuthor({ name: `${BRAND_NAME} • Central de Atendimento`, iconURL: client.user?.displayAvatarURL() || undefined })
    .setTitle(`🔒  Atendimento #${ticket.ticket_number} Encerrado`)
    .setDescription(`Este atendimento foi encerrado pela equipe.\n\n**Resultado:** ${resolved ? '✅ Resolvido' : '❌ Não resolvido'}${feedback ? `\n\n**Feedback da equipe:**\n\`\`\`${feedback}\`\`\`` : ''}`)
    .addFields(
      { name: 'Cliente', value: ticket.customer_discord_id ? `<@${ticket.customer_discord_id}>` : ticket.customer_name, inline: true },
      { name: 'Assunto', value: ticket.subject, inline: false },
    )
    .setFooter({ text: `${BRAND_NAME} • ${BRAND_TAGLINE}`, iconURL: client.user?.displayAvatarURL() || undefined })
    .setTimestamp();
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

  const welcomeEmbed = buildWelcomeEmbed(ticket, subject, category, department);

  await ticketChannel.send({
    content: `<@${interaction.user.id}>`,
    embeds: [welcomeEmbed],
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
  const panelExists = recentMessages.some((message) => message.author.id === client.user?.id && message.embeds.some((embed) => embed.title === `${BRAND_NAME} | Central de Atendimento`));
  if (panelExists) return;

  const panel = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setAuthor({ name: `${BRAND_NAME} • Central de Atendimento`, iconURL: client.user?.displayAvatarURL() || undefined })
    .setTitle(`${BRAND_NAME} | Central de Atendimento`)
    .setDescription('Precisa de ajuda? Selecione uma das categorias abaixo para abrir um atendimento privado com a nossa equipe.\n\n> **Antes de abrir um ticket**\n> Explique o problema com clareza e envie todos os detalhes necessários. Isso ajuda a equipe a responder mais rápido.')
    .addFields(
      { name: `${categories.duvida.emoji} Dúvidas`, value: categories.duvida.description, inline: false },
      { name: `${categories.reclamacao.emoji} Reclamação`, value: categories.reclamacao.description, inline: false },
      { name: `${categories.funcionario.emoji} Reportar Funcionário`, value: categories.funcionario.description, inline: false },
    )
    .setFooter({ text: `${BRAND_NAME} • ${BRAND_TAGLINE}`, iconURL: client.user?.displayAvatarURL() || undefined })
    .setTimestamp();

  await channel.send({
    embeds: [panel],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('ticket_category:duvida').setLabel('Dúvidas').setEmoji(categories.duvida.emoji).setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('ticket_category:reclamacao').setLabel('Reclamação').setEmoji(categories.reclamacao.emoji).setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ticket_category:funcionario').setLabel('Reportar Funcionário').setEmoji(categories.funcionario.emoji).setStyle(ButtonStyle.Danger),
    )],
  });
}

async function showTicketSubjectModal(interaction: ButtonInteraction) {
  const category = categoryValue(interaction.customId.replace('ticket_category:', ''));
  const modal = new ModalBuilder().setCustomId(`ticket_subject:${category}`).setTitle(`${categories[category].emoji} ${categories[category].label}`);
  const subject = new TextInputBuilder()
    .setCustomId('subject')
    .setLabel('Descreva o assunto do atendimento')
    .setPlaceholder('Ex.: Preciso de ajuda com um pagamento realizado...')
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

async function sendTranscriptToChannel(ticket: TicketRow) {
  if (!ticket.discord_channel_id) return;
  const channel = await client.channels.fetch(ticket.discord_channel_id);
  if (!isTextChannel(channel)) return;

  const allMessages: Message[] = [];
  let lastId: string | undefined;
  for (let i = 0; i < 50; i++) {
    const batch = await channel.messages.fetch({ limit: 100, ...(lastId ? { before: lastId } : {}) });
    if (batch.size === 0) break;
    allMessages.push(...batch.values());
    lastId = batch.last()?.id;
    if (batch.size < 100) break;
  }
  allMessages.reverse();

  const lines = allMessages
    .filter((m) => !m.author.bot || m.embeds.length === 0)
    .map((m) => {
      const time = new Date(m.createdTimestamp).toLocaleString('pt-BR');
      const author = m.author.bot ? 'Sistema' : (m.author.globalName || m.author.username);
      const attachments = m.attachments.size > 0
        ? m.attachments.map((a) => `[Anexo: ${a.name}]`).join(' ')
        : '';
      return `[${time}] ${author}: ${m.content || ''}${attachments ? ` ${attachments}` : ''}`;
    })
    .join('\n');

  const transcriptBuffer = Buffer.from(
    `Transcript do Atendimento #${ticket.ticket_number}\n` +
    `Assunto: ${ticket.subject}\n` +
    `Cliente: ${ticket.customer_name}\n` +
    `Canal: #${channel.name}\n` +
    `${'─'.repeat(50)}\n\n` +
    `${lines}\n\n` +
    `${'─'.repeat(50)}\n` +
    `Fim do transcript`,
  );

  if (config.channels.transcripts) {
    const transcriptChannel = await client.channels.fetch(config.channels.transcripts);
    if (isTextChannel(transcriptChannel) && transcriptChannel.guild.id === config.managementGuildId) {
      const transcriptEmbed = new EmbedBuilder()
        .setColor(BRAND_COLOR)
        .setAuthor({ name: `${BRAND_NAME} • Central de Atendimento`, iconURL: client.user?.displayAvatarURL() || undefined })
        .setTitle(`📋 Transcript #${ticket.ticket_number}`)
        .addFields(
          { name: 'Assunto', value: ticket.subject, inline: false },
          { name: 'Cliente', value: ticket.customer_discord_id ? `<@${ticket.customer_discord_id}>` : ticket.customer_name, inline: true },
          { name: 'Mensagens', value: String(allMessages.length), inline: true },
        )
        .setFooter({ text: `${BRAND_NAME} • ${BRAND_TAGLINE}`, iconURL: client.user?.displayAvatarURL() || undefined })
        .setTimestamp();
      await transcriptChannel.send({
        embeds: [transcriptEmbed],
        files: [{ attachment: transcriptBuffer, name: `transcript-${ticket.ticket_number}.txt` }],
      });
    }
  }

  await channel.send({
    content: '📋 **Transcript gerado e arquivado no canal de transcripts.**',
    files: [{ attachment: transcriptBuffer, name: `transcript-${ticket.ticket_number}.txt` }],
  }).catch(() => undefined);
}

async function syncTicketUpdate(payload: { new: Record<string, unknown>; old: Record<string, unknown> }) {
  const newRecord = payload.new;
  const oldRecord = payload.old;
  const ticketId = String(newRecord.id);
  const oldStatus = String(oldRecord.status || '');
  const newStatus = String(newRecord.status || '');
  if (oldStatus === newStatus) return;

  const ticket = await getTicket(ticketId);
  if (!ticket?.discord_channel_id) return;

  let agentName: string | undefined;
  if (newRecord.assigned_to) {
    const agent = await getProfileById(String(newRecord.assigned_to));
    agentName = agent?.full_name;
  }

  const channel = await client.channels.fetch(ticket.discord_channel_id);
  if (!isTextChannel(channel)) return;

  if (newStatus === 'closed') {
    const resolved = String(newRecord.close_reason || '').toLowerCase().includes('resolvido') || Boolean(newRecord.feedback_success);
    const feedback = String(newRecord.close_notes || '');
    await channel.send({ embeds: [buildCloseEmbed(ticket, resolved, feedback)] });
    await sendTranscriptToChannel(ticket);
  } else {
    await channel.send({ embeds: [buildStatusEmbed({ ...ticket, status: newStatus, priority: String(newRecord.priority || ticket.priority) }, agentName)] });
  }
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
    if (interaction.isButton() && interaction.customId.startsWith('ticket_category:')) return void await showTicketSubjectModal(interaction);
    if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_subject:')) {
      const category = categoryValue(interaction.customId.replace('ticket_subject:', ''));
      return void await createTicketForUser(interaction, interaction.fields.getTextInputValue('subject'), category);
    }
  } catch (error) {
    console.error('Interaction error:', error);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) await interaction.reply({ content: 'Ocorreu um erro ao processar esta ação. Tente novamente.', ephemeral: true });
  }
});

client.on('messageCreate', (message) => { void syncDiscordMessage(message); });

supabase
  .channel('dashboard-to-discord-messages')
  .on('postgres_changes' as const, { event: 'INSERT', schema: 'public', table: 'messages' }, (payload: { new: Record<string, unknown> }) => { void syncDashboardMessage(payload); })
  .subscribe();

supabase
  .channel('dashboard-to-discord-tickets')
  .on('postgres_changes' as const, { event: 'UPDATE', schema: 'public', table: 'tickets' }, (payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => { void syncTicketUpdate(payload); })
  .subscribe();

void client.login(config.discordToken);
