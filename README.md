# Flow Return

Traz de volta clientes que sumiram de pequenos negócios. Esta é a Fase 0: sem API, com envio assistido pelo WhatsApp, login e banco local.

```bash
npm install
npm run dev
npm test
```

- O app roda em http://localhost:5183 e a API em http://localhost:5184.
- Contas de teste em `docs/CONTAS-DE-TESTE.md`.
- Nomenclatura em `CLAUDE.md`.
- A lista precisa das colunas nome, telefone e última visita. Serviço é opcional.
- Regras de marca em `docs/IDENTIDADE.md`.
- O envio passa por `src/lib/channel.ts`. A API oficial entra como outro conector, sem mudar as telas.
