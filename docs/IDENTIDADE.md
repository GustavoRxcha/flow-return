# Identidade da Flow Return

A Flow Return é um serviço da ExecFlow e segue o design system da marca, sem exceções.

- **Fonte da verdade:** `design-system/` (cópia de `ExecFlow-DesignSystem`, versão `5257c7a`). Leia `design-system/README.md` antes de mexer em qualquer tela, texto ou peça.
- **Não edite `design-system/`.** Para atualizar, copie de novo a pasta original inteira e registre a versão aqui.
- **Carregamento:** `tokens.css`, depois `components/bundle.css`, com a classe `.ef` no `body`.
- **Telas:** use só classes `ef-` e os estilos de texto dos tokens, como `title-lg`. A marcação de cada componente está em `design-system/components/<Nome>/preview.html`.
- **Layout do produto:** `src/styles/app.css` tem só o que o design system não cobre, com prefixo `fr-` e apenas tokens.
- **Logo e ícone:** `flow-return-preto` sobre branco e `icone-flow-return` como favicon, sempre pelo arquivo.
- **Verde:** significa resultado. Botão `--brand` só ao concluir algo. A ação principal é `--primary`, em preto.
- **Navegação inferior:** até cinco itens, hoje Início, Clientes, Agenda, Serviços e Atendente IA. Ajustes fica no topo.
- **Calendário:** o design system ainda não tem esse componente. Ele vive em `src/styles/calendar.css` e `src/components/CalendarViews.tsx`, com prefixo `fr-cal-` e só tokens. Preto marca o dia escolhido, verde marca hoje, e o ponto verde marca dia com horário. Ao atualizar o design system, avalie levar o calendário para lá.
- **Conversa de teste:** o design system ainda não tem balão de conversa. Ele vive em `src/styles/app.css`, com prefixo `fr-chat`, e usa só tokens. Ao atualizar o design system, avalie levar o balão para lá.
- **Amarelo de atenção:** o design system não tem amarelo. Ele foi pedido para a coluna de dias sem vir e vive em `src/styles/status-tokens.css`, com o mesmo peso de `accent-soft` e `danger-soft`. Use só em selos de estado. Vermelho `danger` também marca atraso nesses selos.
- **Nomes nas telas:** use "clientes" e "negócios". "Cliente Return" e "cliente final" não aparecem no sistema.
- **Ação destrutiva:** botão `--danger`, sempre com `ConfirmDialog`.
- **Fora daqui:** texto para WhatsApp, documentos, peças de venda e qualquer entrega seguem o mesmo tom de voz e as mesmas regras.

`src/lib/brand.test.ts` reprova cor, fonte, sombra e classe fora do sistema. Estilo em linha só vale para posição, com variáveis `--fr-`.
