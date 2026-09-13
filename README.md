# 🏥 CUS ATENDIMENTO

Dashboard profissional de atendimento integrada ao Discord para o Hospital CUS. O sistema centraliza tickets, conversas, anexos, transcripts, acompanhamento da equipe e métricas operacionais em uma experiência única para os atendentes.

## 🎯 O Contexto

O usuário abre um atendimento no Discord, escolhe o tipo de solicitação e recebe uma thread exclusiva. A equipe assume o ticket pela dashboard, responde pelo painel e acompanha todo o histórico em tempo real.

O ecossistema utiliza dois servidores:

- **Servidor HP:** `1483260289632829493`, onde os tickets são abertos e atendidos.
- **Servidor de gestão/heads:** `1497845087575740456`, onde ficam transcripts e comunicações administrativas.

## 🚀 Funcionalidades

### 🎫 Abertura de tickets no Discord

- Painel com botões para **Dúvidas**, **Reclamações** e **Reportar Funcionário**.
- Modal para o usuário informar o assunto.
- Criação automática de thread por ticket.
- Registro do cliente, categoria, assunto e canal no Supabase.
- Comando `/ticket` disponível como alternativa administrativa.

### 🖥️ Dashboard de atendimento

- Fila de tickets em tempo real.
- Botão **Pegar atendimento** para assumir o próximo ticket.
- Quadro Kanban com drag and drop.
- Categorias personalizáveis com cores individuais.
- Busca por assunto do ticket.
- Fluxo de transferência e encerramento.
- Abas de tickets assumidos e finalizados pelo atendente.
- Data, hora, assunto, atendente e resultado dos tickets fechados.

### 💬 Comunicação integrada

- Mensagens enviadas pela dashboard chegam à thread do Discord.
- Mensagens enviadas pelo cliente no Discord aparecem na dashboard.
- Chat interno da equipe em tempo real.
- Avisos dos heads com contador, alerta sonoro e animação de atenção.

### 📎 Arquivos e transcripts

- Fotos, áudios, vídeos e arquivos são enviados diretamente ao Discord.
- O Supabase guarda apenas os metadados e URLs retornadas pelo Discord.
- Transcripts são publicados no canal de gestão configurado.
- Cliente pode encerrar o ticket pelo Discord.
- Tickets fechados ficam disponíveis para auditoria da equipe.

### 🎨 Personalização

- Tema claro e escuro.
- Cor do fundo, menu e botões.
- Papel de parede por upload ou URL.
- Controle de transparência do papel de parede.
- Fontes do Google Fonts e fontes locais do computador.
- Preferências salvas individualmente por atendente.

## 📁 Estrutura do Projeto

```text
dashcus-main/
├── bot/
│   ├── src/
│   │   ├── config.ts       # Configuração privada do bot
│   │   ├── index.ts        # Discord, ponte HTTP e sincronização
│   │   └── supabase.ts     # Cliente backend do Supabase
│   ├── .env.example
│   ├── package.json
│   └── README.md
├── src/
│   ├── components/         # Dashboard, Kanban, chat e modal de ticket
│   ├── lib/                # Auth, Supabase, tipos e ponte Discord
│   └── pages/              # Painel, tickets, relatórios e equipe
├── supabase/migrations/    # Schema, RLS, Kanban e chat da equipe
├── .env.example            # Referência de variáveis
└── package.json            # Dashboard Vite
```

## 🔧 Configuração

### Dashboard

Crie `.env.local` na raiz:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-publishable
VITE_DISCORD_BRIDGE_URL=https://url-do-bot
```

### Bot

Crie `bot/.env` usando [bot/.env.example](bot/.env.example):

```env
DISCORD_BOT_TOKEN=seu-token
DISCORD_CLIENT_ID=id-da-aplicacao
DISCORD_HP_GUILD_ID=1483260289632829493
DISCORD_MANAGEMENT_GUILD_ID=1497845087575740456
DISCORD_CHANNEL_TICKET_PANEL_ID=id-do-canal-abrir-ticket
DISCORD_CHANNEL_TRANSCRIPTS_ID=1502647502992838737
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
```

Também preencha os IDs dos canais de departamento do servidor HP.

> Nunca versione `.env`, tokens, service role keys ou qualquer credencial privada. O token do Discord e a service role key existem somente no backend do bot.

## 📦 Instalação e execução

### Dashboard

```powershell
npm install
npm run dev
```

### Bot

```powershell
cd bot
npm install
npm run dev
```

### Build de produção

```powershell
npm run build
cd bot
npm run build
npm start
```

## 🛡️ Permissões do bot Discord

O bot precisa de:

- View Channels
- Send Messages
- Send Messages in Threads
- Create Public Threads
- Attach Files
- Read Message History
- Manage Threads

Ative também o **Message Content Intent** no Discord Developer Portal.

## 🔄 Fluxo do atendimento

```text
Usuário clica em um botão no Discord
	↓
Bot abre modal e cria ticket/thread
	↓
Ticket aparece na dashboard em tempo real
	↓
Atendente clica em “Pegar atendimento”
	↓
Mensagens e anexos são sincronizados com o Discord
	↓
Atendimento é encerrado e transcript é arquivado
```

## 🧪 Validação

```powershell
# Dashboard
npm run typecheck
npm run build

# Bot
cd bot
npm run build
```

## 🔒 Segurança

- Tokens privados somente no ambiente do bot.
- RLS habilitado nas tabelas do Supabase.
- Upload de anexos protegido pela sessão autenticada.
- Ponte de anexos valida o token Supabase antes de falar com o Discord.
- `.env`, `.env.local`, `node_modules` e builds ignorados pelo Git.

## 👩‍💻 Desenvolvimento

Projeto desenvolvido por **Elisabete Alves** para o Hospital CUS Capital, unindo desenvolvimento web, automação Discord e uma experiência de atendimento voltada à comunidade do roleplay.

## 📄 Licença

Projeto privado do ecossistema CUS Atendimento.
