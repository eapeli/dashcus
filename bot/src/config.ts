import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const config = {
  discordToken: required('DISCORD_BOT_TOKEN'),
  discordClientId: required('DISCORD_CLIENT_ID'),
  hpGuildId: required('DISCORD_HP_GUILD_ID'),
  managementGuildId: required('DISCORD_MANAGEMENT_GUILD_ID'),
  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  port: Number(process.env.PORT || 3000),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5175',
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB || 25),
  channels: {
    atendimentoGeral: process.env.DISCORD_CHANNEL_ATENDIMENTO_GERAL_ID || '',
    suporteTecnico: process.env.DISCORD_CHANNEL_SUPORTE_TECNICO_ID || '',
    financeiro: process.env.DISCORD_CHANNEL_FINANCEIRO_ID || '',
    recursosHumanos: process.env.DISCORD_CHANNEL_RECURSOS_HUMANOS_ID || '',
    transcripts: process.env.DISCORD_CHANNEL_TRANSCRIPTS_ID || '',
    heads: process.env.DISCORD_CHANNEL_HEADS_ID || '',
    alerts: process.env.DISCORD_CHANNEL_ALERTS_ID || '',
    logs: process.env.DISCORD_CHANNEL_LOGS_ID || '',
  },
  staffCategoryId: process.env.DISCORD_STAFF_CATEGORY_ID || '',
  staffRoleId: process.env.DISCORD_STAFF_ROLE_ID || '',
};
