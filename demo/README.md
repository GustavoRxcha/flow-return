# Demonstração no navegador

O Flow Return inteiro numa página só, sem servidor: o mesmo servidor Hono responde às chamadas de `/api` dentro do navegador, com o SQLite em memória (sql.js). Serve para abrir no celular e conferir telas.

```bash
npm run demo:build
```

Sai em `dist-demo/demo/index.html`.

- Abre logada na Barbearia do Bigode. As outras contas estão em `docs/CONTAS-DE-TESTE.md`.
- Os dados voltam ao início quando a página recarrega.
- A atendente IA fica desligada.
- `shims/` troca só o que é do Node: `node:sqlite`, `node:crypto` e os cookies do Hono. O resto é o código de verdade.
