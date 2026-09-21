# CUS Discord Bot

Bot Discord e ponte da dashboard com o Discord.

## Como funciona

Quando um cliente abre um atendimento pelo painel do Discord, o bot cria **um canal privado** visível apenas ao cliente e à staff (cargo de staff configurado). Todos os participantes do ticket conversam no mesmo canal. Mídias (imagens, áudios, vídeos e arquivos) ficam arquivadas no Discord — apenas a URL de referência é salva no banco de dados, sem sobrecarregar o Supabase.

## Responsabilidades

- Publica um painel visual com botões para abrir atendimento (Dúvidas, Reclamação, Reportar Funcionário).
- Cria um canal privado por atendimento, visível apenas ao cliente e ao cargo de staff.
- Grava tickets e mensagens de texto no Supabase em tempo real.
- Mídias e anexos ficam armazenados no Discord (apenas a URL é salva no banco).
- Sincroniza mensagens da dashboard para o canal do Discord e vice-versa.
- Permite que atendentes assumam, transfiram, alterem prioridade e encerrem atendimentos.
- Coleta feedback de fechamento (resolvido ou não) e arquiva transcripts automaticamente.

## Fluxo do atendimento

1. O cliente clica em uma categoria no painel e preenche o assunto.
2. O bot cria um canal privado dentro da categoria de staff configurada.
3. O cliente e a staff (cargo) podem ver e conversar no canal.
4. Um atendente clica em **Assumir** (botões aparecem no próprio canal).
5. O atendente pode **Transferir**, alterar **Prioridade** ou **Encerrar**.
6. Ao encerrar, o bot pede se o caso foi resolvido e um feedback em texto.
7. O transcript é gerado e enviado para o canal de transcripts configurado.
8. O atendimento pode ser **reaberto** se necessário.

## Desenvolvimento

```bash
cp .env.example .env
npm install
npm run dev
```

Para produção:

```bash
npm run build
npm start
```

## Discord Developer Portal

Ative os intents privilegiados:

- Message Content Intent
- Server Members Intent

Convide o bot com os scopes `bot` e `applications.commands`, além das permissões:

- View Channels
- Send Messages
- Attach Files
- Read Message History
- Manage Channels (necessário para criar canais privados)
- Manage Roles (para ajustar permissões dos canais privados)

## Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `DISCORD_BOT_TOKEN` | Token do bot |
| `DISCORD_CLIENT_ID` | ID da aplicação |
| `DISCORD_HP_GUILD_ID` | ID do servidor principal |
| `DISCORD_MANAGEMENT_GUILD_ID` | ID do servidor de gestão |
| `DISCORD_STAFF_CATEGORY_ID` | ID da categoria onde os canais privados serão criados |
| `DISCORD_STAFF_ROLE_ID` | ID do cargo de staff que terá acesso aos canais de ticket |
| `DISCORD_CHANNEL_TICKET_PANEL_ID` | Canal do painel de abertura |
| `DISCORD_CHANNEL_TRANSCRIPTS_ID` | Canal de arquivamento de transcripts |
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key do Supabase |
| `PORT` | Porta do bridge HTTP (default 3000) |
| `CORS_ORIGIN` | Origem permitida para CORS |
| `MAX_UPLOAD_MB` | Tamanho máximo de upload (default 25) |

## Vinculação de atendentes

Para que um atendente possa usar os botões no canal do ticket, seu perfil na dashboard precisa ter o `discord_id` preenchido. O bot busca o perfil pelo Discord ID do usuário que clicou.

O bot deve usar somente variáveis privadas do seu `.env`. Nunca exponha `DISCORD_BOT_TOKEN` ou `SUPABASE_SERVICE_ROLE_KEY` no frontend.
