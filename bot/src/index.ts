import cors from 'cors';
import express from 'express';
import multer from 'multer';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  ModalBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
  ThreadChannel,
} from 'discord.js';
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

function departmentChannelId(department: string): string {
  const channels: Record<string, string> = {
    atendimento_geral: config.channels.atendimentoGeral,
    suporte_tecnico: config.channels.suporteTecnico,
    financeiro: config.channels.financeiro,
    recursos_humanos: config.channels.recursosHumanos,
  };
  return channels[department] || channels.atendimento_geral;
}

function isTextChannel(channel: unknown): channel is TextChannel {
  return channel instanceof TextChannel;
}

function isThreadChannel(channel: unknown): channel is ThreadChannel {
  return channel instanceof ThreadChannel;
}

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(config.discordToken);
  await rest.put(Routes.applicationGuildCommands(config.discordClientId, config.hpGuildId), {
    body: [ticketCommand.toJSON()],
  });
}

async function createTicketForUser(
  interaction: import('discord.js').ChatInputCommandInteraction | import('discord.js').ModalSubmitInteraction,
  subject: string,
  category: 'duvida' | 'reclamacao' | 'funcionario',
  department = 'atendimento_geral',
) {
  const parent = await client.channels.fetch(departmentChannelId(department));
  if (!isTextChannel(parent) || parent.guild.id !== config.hpGuildId) {
    await interaction.reply({ content: 'O canal deste departamento não está configurado corretamente.', ephemeral: true });
    return;
  }

  const departmentNames: Record<string, string> = {
    atendimento_geral: 'Atendimento Geral',
    suporte_tecnico: 'Suporte Técnico',
    financeiro: 'Financeiro',
    recursos_humanos: 'Recursos Humanos',
  };
  const { data: departmentRecord } = await supabase
    .from('departments')
    .select('id')
    .eq('name', departmentNames[department])
    .maybeSingle();

  const { data: ticket, error } = await supabase.from('tickets').insert({
    department_id: departmentRecord?.id || null,
    category,
    subject,
    description: `Ticket aberto pelo Discord por ${interaction.user.tag}`,
    status: 'waiting',
    priority: 'normal',
    customer_name: interaction.user.globalName || interaction.user.username,
    customer_discord_id: interaction.user.id,
  }).select().maybeSingle();

  if (error || !ticket) {
    await interaction.reply({ content: 'Não foi possível registrar seu ticket agora.', ephemeral: true });
    return;
  }

  const thread = await parent.threads.create({
    name: `ticket-${ticket.ticket_number}-${subject.slice(0, 60)}`,
    type: ChannelType.PublicThread,
    reason: `Ticket #${ticket.ticket_number}`,
  });

  await thread.send({
    content: `**Novo ticket #${ticket.ticket_number}**\nCliente: <@${interaction.user.id}>\nAssunto: ${subject}\n\nA equipe responderá por aqui.`,
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`ticket_close:${ticket.id}`).setLabel('Fechar ticket').setStyle(ButtonStyle.Danger),
    )],
  });

  await supabase.from('tickets').update({ discord_channel_id: thread.id }).eq('id', ticket.id);
  await supabase.from('messages').insert({
    ticket_id: ticket.id,
    sender_type: 'customer',
    sender_id: interaction.user.id,
    sender_name: interaction.user.globalName || interaction.user.username,
    content: subject,
    attachment_type: 'none',
  });

  await interaction.reply({ content: `Seu atendimento foi aberto: ${thread}`, ephemeral: true });
}

async function openTicket(interaction: import('discord.js').ChatInputCommandInteraction) {
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
  if (!isTextChannel(channel) || channel.guild.id !== config.hpGuildId) throw new Error('Canal do painel não pertence ao servidor HP');
  const recentMessages = await channel.messages.fetch({ limit: 50 });
  const panelExists = recentMessages.some((message) => message.author.id === client.user?.id && message.embeds.some((embed) => embed.title === '🎫 Abrir atendimento'));
  if (panelExists) return;

  await channel.send({
    embeds: [new EmbedBuilder()
      .setTitle('🎫 Abrir atendimento')
      .setDescription('Escolha o tipo de atendimento. Depois, informe o assunto e a equipe dará continuidade pela sua thread.')
      .setColor(0x08a6c9)],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('ticket_category:duvida').setLabel('Dúvidas').setEmoji('❓').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('ticket_category:reclamacao').setLabel('Reclamação').setEmoji('📢').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ticket_category:funcionario').setLabel('Reportar Funcionário').setEmoji('🚨').setStyle(ButtonStyle.Danger),
    )],
  });
}

async function showTicketSubjectModal(interaction: import('discord.js').ButtonInteraction) {
  const category = interaction.customId.replace('ticket_category:', '') as 'duvida' | 'reclamacao' | 'funcionario';
  const labels = { duvida: 'Dúvida', reclamacao: 'Reclamação', funcionario: 'Reportar Funcionário' };
  const modal = new ModalBuilder().setCustomId(`ticket_subject:${category}`).setTitle(labels[category]);
  const subject = new TextInputBuilder()
    .setCustomId('subject')
    .setLabel('Sobre o que você precisa de ajuda?')
    .setPlaceholder('Descreva o assunto do atendimento')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(500);
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(subject));
  await interaction.showModal(modal);
}

async function syncDiscordMessage(message: import('discord.js').Message) {
  if (message.author.bot || !isThreadChannel(message.channel)) return;
  const { data: ticket } = await supabase.from('tickets').select('*').eq('discord_channel_id', message.channel.id).maybeSingle();
  if (!ticket) return;

  for (const attachment of message.attachments.values()) {
    const type = attachment.contentType?.startsWith('image/') ? 'image' : attachment.contentType?.startsWith('audio/') ? 'audio' : attachment.contentType?.startsWith('video/') ? 'video' : 'file';
    await supabase.from('messages').insert({
      ticket_id: ticket.id,
      sender_type: 'customer',
      sender_id: message.author.id,
      sender_name: message.author.globalName || message.author.username,
      content: message.content || null,
      attachment_type: type,
      attachment_url: attachment.url,
      attachment_name: attachment.name,
    });
  }

  if (message.content) {
    await supabase.from('messages').insert({
      ticket_id: ticket.id,
      sender_type: 'customer',
      sender_id: message.author.id,
      sender_name: message.author.globalName || message.author.username,
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
  if (isThreadChannel(channel)) await channel.send(`**${message.sender_name}**\n${message.content}`);
}

async function closeTicketFromDiscord(interaction: import('discord.js').ButtonInteraction) {
  const ticketId = interaction.customId.replace('ticket_close:', '');
  const { data: ticket } = await supabase.from('tickets').select('*').eq('id', ticketId).maybeSingle();
  if (!ticket || ticket.customer_discord_id !== interaction.user.id) {
    await interaction.reply({ content: 'Somente a pessoa que abriu este ticket pode fechá-lo.', ephemeral: true });
    return;
  }

  const { data: messages } = await supabase.from('messages').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true });
  const transcript = (messages || []).map((message) =>
    `[${new Date(message.created_at).toLocaleString('pt-BR')}] ${message.sender_name} (${message.sender_type}): ${message.content || `[Anexo: ${message.attachment_name || message.attachment_url}]`}`
  ).join('\n');
  const transcriptBuffer = Buffer.from(`Transcript do ticket #${ticket.ticket_number}\nAssunto: ${ticket.subject}\nCliente: ${ticket.customer_name}\n\n${transcript}\n`);

  const channel = await client.channels.fetch(ticket.discord_channel_id);
  if (isThreadChannel(channel)) {
    await channel.send({ content: 'Este atendimento foi encerrado pelo cliente. O transcript foi arquivado pela equipe.', files: [{ attachment: transcriptBuffer, name: `transcript-${ticket.ticket_number}.txt` }] });
  }
  if (config.channels.transcripts) {
    const transcriptChannel = await client.channels.fetch(config.channels.transcripts);
    if (isTextChannel(transcriptChannel) && transcriptChannel.guild.id === config.managementGuildId) {
      await transcriptChannel.send({ content: `Transcript do ticket #${ticket.ticket_number}`, files: [{ attachment: transcriptBuffer, name: `transcript-${ticket.ticket_number}.txt` }] });
    }
  }

  await supabase.from('tickets').update({ status: 'closed', closed_at: new Date().toISOString(), close_reason: 'Encerrado pelo cliente' }).eq('id', ticketId);
  await supabase.from('messages').insert({ ticket_id: ticketId, sender_type: 'system', sender_name: 'Discord', content: 'Ticket encerrado pelo cliente no Discord.', attachment_type: 'none' });
  await interaction.update({ content: 'Atendimento encerrado. Obrigado por falar com a equipe.', components: [] });
  if (isThreadChannel(channel)) await channel.setArchived(true, 'Ticket encerrado pelo cliente');
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
      const channel = await client.channels.fetch(ticketChannelId);
      if (!isThreadChannel(channel)) return response.status(400).json({ error: 'ticket channel is not a Discord thread' });

      const discordMessage = await channel.send({
        content: `**${request.body.senderName || 'Atendente'}** enviou um ${attachmentType === 'transcript' ? 'transcript' : 'anexo'}.`,
        files: [{ attachment: request.file.buffer, name: request.file.originalname }],
      });
      const attachment = discordMessage.attachments.first();
      if (!attachment) return response.status(502).json({ error: 'Discord did not return an attachment' });

      if (attachmentType === 'transcript' && config.channels.transcripts) {
        const transcriptChannel = await client.channels.fetch(config.channels.transcripts);
        if (isTextChannel(transcriptChannel) && transcriptChannel.guild.id === config.managementGuildId) {
          await transcriptChannel.send({ content: `Transcript do ticket ${ticketId}`, files: [{ attachment: request.file.buffer, name: request.file.originalname }] });
        }
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
  if (interaction.isChatInputCommand() && interaction.commandName === 'ticket') await openTicket(interaction);
  if (interaction.isButton() && interaction.customId.startsWith('ticket_category:')) await showTicketSubjectModal(interaction);
  if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_subject:')) {
    const category = interaction.customId.replace('ticket_subject:', '') as 'duvida' | 'reclamacao' | 'funcionario';
    await createTicketForUser(interaction, interaction.fields.getTextInputValue('subject'), category);
  }
  if (interaction.isButton() && interaction.customId.startsWith('ticket_close:')) await closeTicketFromDiscord(interaction);
});
client.on('messageCreate', (message) => { void syncDiscordMessage(message); });

supabase
  .channel('dashboard-to-discord')
  .on('postgres_changes' as const, { event: 'INSERT', schema: 'public', table: 'messages' }, (payload: { new: Record<string, unknown> }) => { void syncDashboardMessage(payload); })
  .subscribe();

void client.login(config.discordToken);
