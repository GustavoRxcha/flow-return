# WhatsApp de verdade

A atendente responde no WhatsApp real pelo número de testes da Meta, sem pagar nada. A IA continua rodando no Mac.

## Como funciona

1. O cliente escreve no WhatsApp.
2. A Meta avisa o endereço público do túnel.
3. O túnel entrega o aviso no Mac, na porta 5185.
4. O sistema confere a assinatura da Meta e chama a mesma `assistantTurn` da aba Atendente IA.
5. A resposta volta pelo `metaChannel`, em `src/lib/channel.ts`.

A porta 5185 só tem esse endereço. O túnel não alcança o login nem as telas.

## Conectar pela primeira vez

Você faz os passos da Meta, porque a conta é sua.

1. Entre em [developers.facebook.com](https://developers.facebook.com/) e crie um app com o produto WhatsApp.
2. Em WhatsApp, Configuração da API, copie o token temporário e o ID do número de telefone.
3. No campo "Para", adicione o seu WhatsApp e confirme o código que chegar. Só os números dessa lista conversam com o número de testes.
4. Em Configurações do app, Básico, copie a chave secreta.
5. Abra o `.env` e preencha `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN` e `WHATSAPP_APP_SECRET`. O `WHATSAPP_VERIFY_TOKEN` já está preenchido.
6. Reinicie o sistema com o Mac acordado:

```bash
caffeinate -is npm run dev
```

7. Em outra aba do Terminal, abra o túnel e copie o endereço `https://...trycloudflare.com` que aparecer:

```bash
npm run whatsapp:tunel
```

8. Em WhatsApp, Configuração, edite o webhook:
   - URL de retorno: o endereço do túnel, seguido de `/webhooks/whatsapp`.
   - Token de verificação: o `WHATSAPP_VERIFY_TOKEN` do `.env`.
   - Assine o campo `messages`.
9. Do seu celular, mande um "oi" para o número de testes.

## No dia a dia dos testes

- **Mac:** precisa ficar ligado, acordado e com o Ollama aberto.
- **Túnel:** o endereço muda toda vez que o túnel reinicia. Quando mudar, repita o passo 8.
- **Token:** o temporário vence rápido. Se ela parar de responder, gere outro, troque no `.env` e reinicie. Para não vencer, crie um usuário do sistema no Business Manager com as permissões `whatsapp_business_messaging` e `whatsapp_business_management`.
- **Erro de número:** o WhatsApp pode tratar celular brasileiro sem o 9. Se o registro mostrar o código 131030, adicione o número também sem o 9 na lista do passo 3.

## Passar para o WhatsApp real

Com um número próprio na API da Meta, nada muda no código:

1. Troque `WHATSAPP_PHONE_NUMBER_ID` e `WHATSAPP_ACCESS_TOKEN` no `.env`.
2. Aponte o webhook para o endereço fixo do servidor.

Para mais de um negócio, cada número vira uma linha em `whatsapp_lines`, ligada ao seu negócio.

## Trocar de provedor

Outro provedor precisa de duas peças em `server/whatsapp.ts`: ler o aviso dele para `IncomingMessage` e enviar por um `SendChannel`. Agenda, travas e atendente ficam iguais.

## Trocar de IA

A IA entra por um único ponto: `ChatModel`, em `server/ai.ts`. Uma IA paga é outra função com esse mesmo formato. Depois da troca, rode `npm run atendente:avaliar` e leia as conversas.
