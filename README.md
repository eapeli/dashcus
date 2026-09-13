# dashcus

[![Open in Bolt](https://bolt.new/static/open-in-bolt.svg)](https://bolt.new/~/sb1-udfs6cjz)

## Configuração

Use [.env.example](.env.example) como referência para configurar o frontend e o bot.

Para executar a dashboard localmente, crie `.env.local` com:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-publishable
```

As variáveis `DISCORD_BOT_TOKEN` e `SUPABASE_SERVICE_ROLE_KEY` são privadas e devem existir somente no ambiente do bot/backend. Nunca use o prefixo `VITE_` nessas chaves.

O bot deve usar os IDs de canais definidos no `.env.example` para criar e acompanhar os canais do Discord, publicar transcripts e enviar alertas da equipe.

O código do bot está em [bot/](bot/), com instruções próprias em [bot/README.md](bot/README.md). A dashboard usa `VITE_DISCORD_BRIDGE_URL` para enviar anexos ao bot sem armazená-los no Supabase Storage.
