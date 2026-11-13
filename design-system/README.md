## A marca

A ExecFlow é a marca principal, e cada serviço vive dentro dela. A identidade é limpa, direta e feita para o público geral: muito branco, preto forte e um único verde.

A assinatura é **o ponto final**. Ele fecha o nome da marca e representa algo que foi resolvido. Por isso o verde significa resultado, em toda a marca.

## Tom de voz

- Escreva como se explicasse para um amigo: frases curtas e palavras do dia a dia.
- Trate o leitor por “você”.
- Diga o que a pessoa ganha, não como o sistema funciona: “Tudo em um lugar”, nunca “Centralize seus processos”.
- Use caixa normal nos títulos, com só a primeira palavra em maiúscula. Termine títulos curtos com ponto quando couber.
- Não use jargão corporativo, exclamações em sequência nem emoji.
- Em erros, diga o que aconteceu e como resolver: “Falta o final do e-mail.”

## Cor

- Comece sempre no tema claro, com `surface` e `ink`. O tema escuro é um complemento.
- Mantenha cerca de 90% da tela em branco, preto e cinza. O verde fica nos outros 10%.
- Use `brand` como preenchimento, com `on-brand`, e só onde há conclusão ou resultado.
- Use `accent` para verde em texto, números e ícones. Sobre preto, `#14624c` tem só 2,9:1, então `accent` vira `#4fd1a5` no tema escuro.
- Use `surface-inverse` para seções de contraste e para o botão principal.
- Use `surface-alt` em painéis, `line` em divisores e `line-strong` em bordas de controles.
- Não use degradês nem outras cores de destaque. `danger` é só para erro.

## Tipografia

- Use **Bricolage Grotesque** (`--font-display`) em todos os títulos e números de destaque.
- Use **Nunito** (`--font-text`) em texto, botões, campos e rótulos.
- Não use uma terceira fonte, fontes serifadas ou itálico decorativo.
- Rótulos ficam em caixa normal com `label`. Caixa alta espaçada lembra o tom corporativo que a marca deixou para trás.
- No celular, reduza `display-xl` para 44px e `display-lg` para 36px.

## Layout e formas

- Dê muito espaço: use `space-96` entre seções e `content-wide` como largura máxima.
- Desenhe primeiro para o celular. Áreas de toque têm pelo menos 44px.
- Use `radius-pill` em botões e selos, `radius-sm` em campos, `radius-md` em cartões e `radius-lg` em painéis e modais.
- Separe com borda de 1px em `line` ou com fundo `surface-alt`.
- Use `shadow-float` só no que flutua, como menus e modais. Cartões ficam planos.
- O foco de teclado é um contorno sólido de 2px em `focus`, com 2px de afastamento.

## Movimento

- Use transições de 120ms em cor e 240ms em posição, com a curva `--ease-out` de `components/bundle.css`.
- O ponto pode esticar e virar barra de progresso, encolhendo de volta ao terminar. Esse é o único movimento de marca.
- Respeite `prefers-reduced-motion`.

## Imagens e ícones

- Prefira telas reais do produto e pessoas reais em situações comuns, com luz natural. Preto e branco é bem-vindo.
- Não use banco de imagens genérico nem fotos com clima de luxo.
- Use ícones Lucide, em linha de 2px com pontas arredondadas, em `ink` ou `ink-soft`. Use ícone sempre com texto, a menos que o significado seja universal.

## Logos

- Sobre fundo branco, use `execflow-preto`, com ponto verde.
- Sobre preto, use `execflow-branco`, com ponto `#4fd1a5`.
- Sobre verde ou em uma cor só, use as versões `-mono-`.
- O ícone padrão de app e favicon é `icone-preto`. `icone-branco` e `icone-verde` são alternativas.
- Mantenha em volta do logo um espaço livre igual à altura do “e”.
- Tamanho mínimo: 80px de largura no logo e 16px no ícone.
- Não mude as cores, não redesenhe, não aplique sombra nem degradê.

## Serviços

- Cada serviço usa o nome em minúsculas, em Nunito 900, com o mesmo ponto: `flow-return-preto`.
- O ícone do serviço usa a inicial e o ponto: `icone-flow-return`.
- Serviços compartilham todos os tokens. Nenhum serviço ganha cor própria.

## Como usar em outro projeto

1. Copie esta pasta para o projeto ou aponte para ela como referência.
2. Abra `index.html` para ver a marca, os tokens e os componentes.
3. Carregue `tokens.css` e depois `components/bundle.css`.
4. Envolva a tela em `.ef` e use as classes `ef-`. A marcação de cada componente está em `components/<Nome>/preview.html`, e as regras em `components/<Nome>/README.md`.
5. Para o tema escuro, use `data-theme="dark"` no elemento raiz.
6. Em outra stack, leia os valores de `tokens.json`. Não copie cores nem tamanhos à mão.
