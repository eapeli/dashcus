# 🏥 CUS ATENDIMENTO

Sistema profissional de atendimento integrado ao Discord, desenvolvido para o Hospital CUS da Capital City. Centraliza tickets, conversas, anexos, transcripts e métricas em uma dashboard moderna para facilitar o atendimento de médicos, pacientes, colaboradores e toda a equipe do hospital.

## 🎮 O Contexto

O bot funciona como o sistema central de atendimento do hospital no Discord. O usuário escolhe o tipo de solicitação, informa o assunto e recebe uma thread exclusiva. A equipe acompanha o ticket em tempo real pela dashboard, assume o atendimento e mantém todo o histórico sincronizado.

Todo este ecossistema é liderado dentro da cidade por:

**Dra. Anne Salvatore:** personagem responsável pelo hospital no RP. Ela é Médica, Psicóloga, Diretora Geral e a atual Dona do HP CUS Capital.

O projeto utiliza dois servidores Discord:

- **Servidor HP:** servidor privado onde os tickets são abertos e atendidos.
- **Servidor de gestão/heads:** servidor privado onde ficam transcripts e comunicações administrativas.

## 👩‍💻 A Mente Por Trás do Projeto

A infraestrutura do bot, a personagem e o desenvolvimento do hospital ganham vida através de **Elisabete Alves**, a pessoa real que uniu seus conhecimentos técnicos e acadêmicos para criar uma experiência imersiva completa. Elisabete é uma profissional multidisciplinar:

- 🎓 **Estudante de Psicologia:** trazendo embasamento teórico real para as inovações do setor no jogo.
- 💻 **Desenvolvedora:** criação de sistemas e bots utilizando JavaScript, Node.js, React e Discord.js.
- 🎮 **Game Dev (FiveM):** programação em Lua e modelagem 3D, incluindo roupas personalizadas e logos 3D.
- 🎨 **Designer.**
- 🎵 **Cantora e Compositora.**
- 🎥 **Streamer.**

## 🚀 Funcionalidades

### 🎫 Sistema de Tickets

- Painel de abertura com botões para **Dúvidas**, **Reclamações** e **Reportar Funcionário**.
- Modal para o usuário informar o assunto do atendimento.
- Criação automática de threads no Discord.
- Registro de cliente, categoria, assunto, status e canal no Supabase.
- Sincronização em tempo real entre Discord e dashboard.
- Comando `/ticket` como alternativa administrativa.

### 💬 Sistema de Atendimento

- Botão **Pegar atendimento** para o atendente assumir o próximo ticket.
- Envio de mensagens da dashboard diretamente para a thread do Discord.
- Mensagens dos usuários no Discord exibidas na dashboard.
- Transferência entre departamentos e atendentes.
- Encerramento pelo atendente ou pelo cliente.
- Histórico completo de mensagens e eventos.

### 📎 Arquivos e Transcripts

- Envio de imagens, áudios, vídeos e arquivos diretamente para o Discord.
- O Discord é o armazenamento definitivo dos anexos.
- Supabase guarda apenas os metadados e URLs retornadas pelo Discord.
- Transcript gerado ao finalizar o atendimento.
- Cópia do transcript enviada ao canal de gestão configurado.

### 💬 Chat da Equipe

- Comunicação interna em tempo real entre atendentes.
- Avisos dos heads para toda a equipe.
- Contador de mensagens não lidas.
- Alerta sonoro e animação para chamadas de atenção.

### 📊 Relatórios e Gestão

- Tickets por dia, semana e mês.
- Desempenho dos atendentes.
- Tickets por categoria e departamento.
- Tempo médio de resolução.
- Histórico de tickets finalizados.
- Identificação do atendente responsável e resultado do atendimento.

### 🔒 Segurança e Controle

- Autenticação pelo Supabase Auth.
- Row Level Security nas tabelas do sistema.
- Token do Discord somente no backend do bot.
- Service role key nunca exposta no frontend.
- Ponte de anexos protegida pela sessão autenticada.
- Registro de eventos de criação, atendimento, transferência e fechamento.

## 📋 Comandos e Interações do Discord

- Botões de categoria no canal de abertura de tickets.
- Modal para informar o assunto.
- `/ticket` - abre um ticket manualmente pelo Discord.
- Botão de encerramento na thread do cliente.
- Threads individuais por atendimento.
- Publicação de transcripts no canal de gestão.

## 📈 Sistema de Logs

- Registro de eventos dos tickets no Supabase.
- Histórico de mensagens e anexos.
- Registro de atendente responsável.
- Registro de transferências e encerramentos.
- Canal de logs do bot configurável por variável de ambiente.

## 🎨 Interface

- Dashboard limpa e moderna para operação diária.
- Tema claro e escuro.
- Papel de parede por upload ou URL.
- Controle de transparência do papel de parede.
- Cores individuais para cada categoria do Kanban.
- Fontes do Google Fonts e fontes instaladas no computador.
- Busca por assunto dos tickets.
- Drag and drop para organização do Kanban.
- Chat flutuante da equipe.

## 📁 Estrutura do Projeto

```text
dashcus-main/
├── bot/
│   ├── src/
│   │   ├── config.ts       # Variáveis privadas do bot
│   │   ├── index.ts        # Discord, ponte HTTP e sincronização
│   │   └── supabase.ts     # Cliente backend do Supabase
│   ├── .env.example        # Configuração do bot
│   ├── package.json        # Dependências do bot
│   └── README.md           # Instruções do bot
├── src/
│   ├── components/         # Componentes da dashboard
│   ├── lib/                # Auth, Supabase, tipos e ponte Discord
│   └── pages/              # Painel, tickets, relatórios e equipe
├── supabase/migrations/    # Schema, RLS, Kanban e chat da equipe
├── .env.example            # Variáveis do frontend e referência geral
├── package.json            # Dependências da dashboard
└── README.md               # Documentação do projeto
```

## 🔧 Configuração

### 📦 Dependências

Dashboard:

```json
{
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "@supabase/supabase-js": "^2.57.4",
  "lucide-react": "^0.446.0",
  "vite": "^5.4.2",
  "typescript": "^5.5.3"
}
```

Bot:

```json
{
  "discord.js": "^14.22.1",
  "@supabase/supabase-js": "^2.57.4",
  "express": "^5.1.0",
  "multer": "^2.0.2",
  "dotenv": "^16.6.1"
}
```

### 🔐 Variáveis de Ambiente

Para a dashboard, crie `.env.local` na raiz:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-publishable
VITE_DISCORD_BRIDGE_URL=https://url-do-bot
```

Para o bot, crie `bot/.env` usando [bot/.env.example](bot/.env.example):

```env
DISCORD_BOT_TOKEN=SEU_TOKEN_DO_BOT
DISCORD_CLIENT_ID=ID_DA_APLICACAO
DISCORD_HP_GUILD_ID=ID_DO_SERVIDOR_HP
DISCORD_MANAGEMENT_GUILD_ID=ID_DO_SERVIDOR_GESTAO
DISCORD_CHANNEL_TICKET_PANEL_ID=ID_DO_CANAL_ABRIR_TICKET
DISCORD_CHANNEL_TRANSCRIPTS_ID=ID_DO_CANAL_TRANSCRIPTS
DISCORD_CHANNEL_ATENDIMENTO_GERAL_ID=ID_DO_CANAL
DISCORD_CHANNEL_SUPORTE_TECNICO_ID=ID_DO_CANAL
DISCORD_CHANNEL_FINANCEIRO_ID=ID_DO_CANAL
DISCORD_CHANNEL_RECURSOS_HUMANOS_ID=ID_DO_CANAL
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=SUA_SERVICE_ROLE_KEY
```

**Observação:** nunca versione `.env` com credenciais reais. Use variáveis de ambiente seguras.

### 🛡️ Permissões Necessárias

O bot precisa das seguintes permissões no Discord:

- `ViewChannel` - visualizar canais.
- `SendMessages` - enviar mensagens.
- `SendMessagesInThreads` - responder nas threads.
- `CreatePublicThreads` - criar threads de tickets.
- `ReadMessageHistory` - ler o histórico dos atendimentos.
- `AttachFiles` - enviar fotos, áudios, vídeos e transcripts.
- `ManageThreads` - arquivar e administrar threads.

Ative também o **Message Content Intent** no Discord Developer Portal.

## 🚀 Deploy

### 🌐 Deploy pelo GitHub

O projeto está disponível em:

`https://github.com/eapeli/dashcus`

A dashboard e o bot podem ser hospedados a partir do repositório. Configure as variáveis de ambiente no serviço de hospedagem sem commitar arquivos `.env`.

### 📦 Execução Manual

Dashboard:

```powershell
npm install
npm run build
npm run dev
```

Bot:

```powershell
cd bot
npm install
npm run build
npm start
```

### 🔄 Desenvolvimento

Dashboard:

```powershell
npm run dev
```

Bot:

```powershell
cd bot
npm run dev
```

## 🧪 Testes e Validação

Dashboard:

```powershell
npm run typecheck
npm run build
```

Bot:

```powershell
cd bot
npm run build
```

As validações cobrem compilação TypeScript, aliases da dashboard, integração da ponte Discord e estrutura do bot.

## 🔒 Segurança

### Proteções Implementadas

- **Autenticação:** acesso da dashboard protegido pelo Supabase Auth.
- **RLS:** políticas de acesso nas tabelas do Supabase.
- **Credenciais:** tokens e service role key somente no backend.
- **Anexos:** arquivos enviados diretamente ao Discord.
- **Ponte protegida:** endpoint de anexos valida o token da sessão.
- **Auditoria:** eventos de atendimento e fechamento registrados.
- **Gitignore:** `.env`, `.env.local`, builds e dependências ignorados.

### Regras do Atendimento

- O ticket é aberto pelo painel do Discord.
- O atendente assume o ticket somente pelo botão da dashboard.
- O ticket só pode ser organizado no Kanban depois de aparecer na fila.
- O cliente pode encerrar o próprio atendimento no Discord.
- O transcript é arquivado no servidor de gestão.

## 📊 Fluxo de Uso

### 1. Usuário abre um ticket

```text
Usuário clica em Dúvidas, Reclamação ou Reportar Funcionário
↓
Bot abre modal e cria ticket/thread
↓
Ticket aparece na dashboard em tempo real
```

### 2. Atendente assume o atendimento

```text
Atendente clica em “Pegar atendimento”
↓
Ticket é atribuído ao atendente
↓
Status muda para Em Atendimento
↓
Atendente responde pela dashboard ou pelo Discord
```

### 3. Atendimento é finalizado

```text
Atendente informa se o caso foi resolvido
↓
Transcript é gerado
↓
Transcript é enviado ao canal de gestão
↓
Ticket é fechado e a thread pode ser arquivada
```

## 🎯 Regras do Sistema

### Para Usuários

- Um atendimento gera uma thread própria.
- O assunto é informado antes da criação do ticket.
- O cliente acompanha a conversa no Discord.
- O cliente pode encerrar o próprio atendimento.

### Para Atendentes

- O atendimento é assumido pelo botão **Pegar atendimento**.
- Tickets podem ser organizados no Kanban.
- Mensagens e anexos são sincronizados com o Discord.
- Transferências e fechamentos ficam registrados.

### Para Heads e Administradores

- Acompanham transcripts no servidor de gestão.
- Podem enviar avisos pelo chat da equipe.
- Recebem alertas sonoros de atenção.
- Acompanham relatórios e auditoria dos atendimentos.

## 🐛 Troubleshooting

### Bot não inicia

- Verifique `DISCORD_BOT_TOKEN`.
- Confirme `DISCORD_CLIENT_ID` e os IDs dos servidores.
- Confira se o bot está instalado no servidor HP e no servidor de gestão.
- Verifique se todas as variáveis do `bot/.env` estão preenchidas.

### Painel de abertura não aparece

- Confira `DISCORD_CHANNEL_TICKET_PANEL_ID`.
- Confirme que o canal pertence ao servidor HP.
- Verifique a permissão `SendMessages`.
- Reinicie o bot após alterar as variáveis.

### Mensagens não chegam à dashboard

- Confirme `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.
- Verifique se as migrations foram aplicadas.
- Confirme que o Realtime está habilitado para as tabelas necessárias.
- Confira os logs do bot.

### Anexos não são enviados

- Verifique `VITE_DISCORD_BRIDGE_URL`.
- Confirme a permissão `AttachFiles`.
- Verifique o limite `MAX_UPLOAD_MB`.
- Confirme se a sessão do atendente ainda está autenticada.

### Transcripts não aparecem no servidor de gestão

- Confira `DISCORD_CHANNEL_TRANSCRIPTS_ID`.
- Confirme `DISCORD_MANAGEMENT_GUILD_ID`.
- Verifique `SendMessages`, `AttachFiles` e `ViewChannel` no canal de transcripts.

## 📈 Performance

- ⚡ Atualização de tickets em tempo real.
- 🔄 Sincronização bidirecional entre Discord e dashboard.
- 💾 Arquivos mantidos no CDN do Discord.
- 📊 Consultas limitadas para buscas e históricos.
- 🧩 Frontend e bot separados por responsabilidade.

## 🤝 Contribuição

1. Faça um fork do repositório.
2. Crie uma branch para sua feature.
3. Faça commit das mudanças.
4. Abra um Pull Request descrevendo a contribuição.

## 📝 Licença

Este projeto está licenciado sob a **MIT License**.

## 🆘 Suporte

- **Servidor Discord:** HP CUS Capital — atendimento, operação do bot e comunicação da equipe.
- **GitHub Issues:** reporte bugs e sugira melhorias no projeto `dashcus`.
- **Configuração:** consulte [.env.example](.env.example) e [bot/README.md](bot/README.md).
- **Contato do projeto:** Elisabete Alves.

## 🎉 Agradecimentos

Projeto desenvolvido com dedicação para a comunidade do Hospital CUS Capital. Tecnologia a serviço da saúde e do atendimento em roleplay.

---

**🏥 CUS ATENDIMENTO - o sistema de tickets e atendimento integrado do Hospital CUS da Capital City** **Desenvolvido por Elisabete Alves - Estudante de Psicologia, Desenvolvedora, Streamer, Designer, Compositora e Cantora**

🚀 Sistema profissional, seguro e eficiente - A melhor experiência em atendimento! 🧠 Com a visão multidisciplinar da Diretora Geral do HP CUS Capital! 👩‍💻 Desenvolvido com paixão e dedicação por uma profissional multi-talentosa!
