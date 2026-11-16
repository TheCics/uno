# @bardotiao/uno

Uno (versão "UMA") do Bar do Tião: client e servidor num só pacote, instalado pelo portal como dependência Git.

## Estrutura
- `client/`: telas, estilos e (no Uno) animações e sons. ESM. Entrada: `client/index.js` (`register(host)`). Tudo que usa do portal passa por `client/portal.js`.
- `server/`: motor de regras (`uno.engine.js`). CommonJS. Entrada: `server/index.js` (a engine).
- `test/`: testes do motor, incluindo a suíte do contrato (`@bardotiao/game-contract`).
- `dev/run.mjs`: abre o portal só com este jogo.

## Uso
```bash
npm install     # instala ui e game-contract (devDependencies, por tag do GitHub)
npm test        # testes do motor
npm run dev     # portal + este jogo (veja abaixo)
```

### Rodar dentro do portal
1. Clone `TheCics/bar-do-tiao` **ao lado** desta pasta e rode `npm install` nele.
2. Aqui: `npm run dev`. O script aponta o portal para esta pasta e sobe o servidor (`GAMES=uno`, porta 3001) e o client (porta 5173).
3. Outro local do portal: `PORTAL_DIR=/caminho npm run dev`.

O login ainda é o do Firebase do portal.

## Publicar uma versão
```bash
git tag v1.0.1 && git push --tags
```
Depois, no portal: troque a tag em `client/package.json` e `server/package.json`, `npm install` e push.

## Dependências
`@bardotiao/ui` e `@bardotiao/game-contract` são *peer* (o portal fornece) e *dev* (testes isolados).

Para criar outro jogo, veja `docs/NOVO-JOGO.md` no repositório `bar-do-tiao`.
