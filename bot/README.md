# CUS Discord Bot

Bot Discord e ponte da dashboard com o Discord.

## Responsabilidades

- Registra `/ticket` e cria uma thread no canal do departamento.
- Grava tickets e mensagens no Supabase.
- Escuta mensagens de clientes nas threads e sincroniza com a dashboard.
- Escuta mensagens de atendentes criadas pela dashboard e publica na thread do Discord.
- Recebe anexos da dashboard em `POST /discord/attachments` e os envia ao Discord.
- Publica transcripts no canal configurado.

## Desenvolvimento

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Para produção:

```powershell
npm run build
npm start
```

## Discord Developer Portal

Ative os intents privilegiados:

- Message Content Intent
- Server Members Intent, se o bot precisar consultar membros

Convide o bot com os scopes `bot` e `applications.commands`, além das permissões:

- View Channels
- Send Messages
- Send Messages in Threads
- Create Public Threads
- Attach Files
- Read Message History
- Manage Threads, se o bot for arquivar ou fechar threads

## Endpoint da dashboard

Configure no frontend:

```env
VITE_DISCORD_BRIDGE_URL=https://endereco-do-bot
```

O endpoint exige `Authorization: Bearer <supabase_access_token>` e recebe multipart com `file`, `ticketId`, `discordChannelId`, `senderId`, `senderName` e `attachmentType`.

O bot deve usar somente variáveis privadas do seu `.env`. Nunca exponha `DISCORD_BOT_TOKEN` ou `SUPABASE_SERVICE_ROLE_KEY` no frontend.
