# Flow Return

## Nomenclatura
- **Cliente Return:** o negócio que usa o sistema (barbearia, clínica de massagem). No código: `ReturnClient`.
- **Cliente final:** quem é atendido pelo negócio. No código: `EndCustomer`.
- **Gestor:** quem administra a Flow Return e os Clientes Return.

Esses nomes servem para conversar e para o código. Nas telas, use "clientes" para quem é atendido e "negócios" para quem usa o sistema, sem "Cliente Return" nem "cliente final".

## Regras
- **Design system obrigatório:** tudo o que for criado ou alterado neste projeto, em qualquer linha, segue `design-system/README.md` e `docs/IDENTIDADE.md`: cor, fonte, espaçamento, forma, movimento, ícones, logos, componentes e tom de voz. Vale para código, telas, textos, mensagens e documentos, sem exceções. Se faltar algo no sistema, pergunte antes de criar.
- Todo horário entra pela função `createAppointment`, em `server/repo.ts`, sempre com um profissional da lista do negócio.
- Cada profissional tem a própria agenda. Um período só fica ocupado para quem já atende nele, e fica esgotado quando todos estão ocupados.
- O link da agenda é privado. Ele não aparece para o gestor nem em registros.
- O valor fica guardado em cada horário, em centavos. Horário sem valor fica fora das contas: valor nunca é estimado.
- Antes de concluir, rode `npm test`. `src/lib/brand.test.ts` precisa passar.
- O gestor vê só números. Nomes e telefones de clientes finais não saem da conta do Cliente Return.
- O negócio de cada pedido vem da sessão no servidor, nunca do navegador.
- O envio passa por `src/lib/channel.ts`.
- No WhatsApp, o negócio vem da linha que recebeu a mensagem (`whatsapp_lines`), depois de conferir a assinatura da Meta. Telefone e texto de cliente não vão para registros.
- O que o negócio ensina à atendente entra por campos fixos (`src/lib/businessInfo.ts`), nunca por texto livre, e chega à IA sempre na mesma estrutura.
- A IA da atendente conversa, mas horário, valor e profissional saem das ferramentas de `src/lib/assistant.ts`. Toda resposta passa por `findInvented` antes de sair. Nunca dê à IA outro caminho para consultar ou marcar.
- O que muda a agenda sai escrito pelo sistema, não pela IA: a pergunta de confirmação e a mensagem de pronto.
- A atendente mostra todos os horários livres do dia, em faixas (`availabilityText`), sem limite de quantidade.
- A chave de IA fica só no `.env`, nunca no código, em telas ou em registros.
- Pela conversa, o cliente só desmarca ou remarca horários do próprio número. A trava fica na consulta ao banco (`deleteOwnAppointment`, `moveOwnAppointment`), e nada muda sem o sim da pessoa.
- Número desconhecido: a atendente pede o nome e cadastra o cliente com esse nome e esse número.
- O pedido pode ser para outra pessoa, mas o horário fica sempre no nome e no número de quem escreve. Ninguém marca no nome de outro.
- A atendente só sabe do negócio. Se alguém disser que está em perigo, ela diz que foi treinada apenas para os serviços daqui, sem conselho nem telefone de ajuda.
- Quem pede para não receber mensagens vira `nao_chamar` e não recebe mais mensagens automáticas.
