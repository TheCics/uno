/**
 * ============================================================================
 * ARQUIVO: uno.engine.test.js
 * LOCAL: server/tests/uno.engine.test.js
 * ============================================================================
 *
 * DESCRIÇÃO:
 * Testes de regressão (caracterização) da engine do Uno.
 *
 * RESPONSABILIDADES:
 * - Fixar o comportamento atual do Uno antes da refatoração modular.
 * - Cobrir distribuição, jogadas, efeitos de cartas, compra, vitória e visão.
 * - Detectar qualquer mudança de regra causada pelas próximas subetapas.
 *
 * DATA DE CRIAÇÃO: 07/11/2026 (subetapa 4.0).
 *
 * ATUALIZAÇÕES:
 * - 07/11/2026: Criação da suíte de regressão do Uno.
 *
 * AUTOR: Viana-78
 *
 * ============================================================================
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const unoEngine = require('../server/uno.engine');
const { newGame } = require('../server/uno.state');
const { play, draw, choose, autoTurn, challenge } = require('../server/uno.actions');
const { view } = require('../server/uno.view');
const { canPlay } = require('../server/uno.rules');
const { runEngineContractSuite } = require('@bardotiao/game-contract/engine-contract.suite');

// Regras testadas direto nos módulos (estado mutável); o contrato é testado pela suíte no fim.
const uno = { newGame, play, draw, choose, autoTurn, challenge, view, canPlay };
const { buildDeck } = require('../server/uno.deck');

const card = (c, v) => ({ c, v });

// Monta um estado controlado, sem depender do sorteio do baralho.
function makeGame({ players = ['a', 'b', 'c'], hands = {}, top = card('red', '5'), turn = 0, dir = 1, opts = {} } = {}) {
    const g = uno.newGame(players, opts);

    for (const id of players) {
        g.hands[id] = hands[id] || [card('blue', '1'), card('blue', '2')];
    }

    g.discard = [top];
    g.color = top.c;
    g.turn = turn;
    g.dir = dir;
    g.winner = null;

    return g;
}

test('distribuição: 7 cartas por jogador, baralho de 108 e carta inicial não coringa', () => {
    for (let i = 0; i < 50; i++) {
        const g = uno.newGame(['a', 'b', 'c']);

        assert.equal(buildDeck().length, 108);
        assert.equal(g.hands.a.length, 7);
        assert.equal(g.hands.b.length, 7);
        assert.equal(g.hands.c.length, 7);
        assert.equal(g.deck.length, 108 - 21 - 1);
        assert.equal(g.discard.length, 1);
        assert.notEqual(g.discard[0].c, 'wild');
        assert.equal(g.color, g.discard[0].c);
        assert.ok(g.turn >= 0 && g.turn < 3);
        assert.equal(g.dir, 1);
        assert.equal(g.winner, null);
    }
});

test('configuração: initialCards e drawUntilPlay são respeitados e têm padrão', () => {
    const padrao = uno.newGame(['a', 'b']);
    assert.deepEqual(padrao.opts, { initialCards: 7, drawUntilPlay: false, stackDraw2: false, stackWild4: false, challengeWild4: false, jumpIn: false, swapSeven: false, rotateZero: false, unoCall: false, autoPlayDrawn: false, choosePlayDrawn: false });

    const custom = uno.newGame(['a', 'b'], { initialCards: 5, drawUntilPlay: true });
    assert.equal(custom.hands.a.length, 5);
    assert.equal(custom.opts.drawUntilPlay, true);
});

test('jogada válida por cor e por valor remove a carta da mão e passa a vez', () => {
    const porCor = makeGame({ hands: { a: [card('red', '9'), card('blue', '1')] } });
    assert.deepEqual(uno.play(porCor, 'a', 0), { ok: true });
    assert.equal(porCor.hands.a.length, 1);
    assert.deepEqual(porCor.discard[porCor.discard.length - 1], card('red', '9'));
    assert.equal(porCor.color, 'red');
    assert.equal(porCor.turn, 1);

    const porValor = makeGame({ hands: { a: [card('green', '5'), card('blue', '1')] } });
    assert.deepEqual(uno.play(porValor, 'a', 0), { ok: true });
    assert.equal(porValor.color, 'green');
});

test('jogadas inválidas retornam erro e não alteram o estado', () => {
    const g = makeGame({ hands: { a: [card('blue', '9'), card('blue', '1')] } });
    const antes = JSON.stringify(g);

    assert.deepEqual(uno.play(g, 'b', 0), { error: 'Não é a sua vez' });
    assert.deepEqual(uno.play(g, 'a', 7), { error: 'Carta inválida' });
    assert.deepEqual(uno.play(g, 'a', 0), { error: 'Essa carta não pode ser jogada' });
    assert.equal(JSON.stringify(g), antes);
});

test('coringa exige cor válida e define a cor ativa', () => {
    const g = makeGame({ hands: { a: [card('wild', 'wild'), card('blue', '1')] } });

    assert.deepEqual(uno.play(g, 'a', 0, 'roxo'), { error: 'Escolha uma cor' });
    assert.deepEqual(uno.play(g, 'a', 0, 'green'), { ok: true });
    assert.equal(g.color, 'green');
});

test('coringa sem cor: a carta pousa primeiro e a cor é escolhida depois (etapa 2)', () => {
    const g = makeGame({ hands: { a: [card('wild', 'wild'), card('blue', '1')] } });

    assert.deepEqual(uno.play(g, 'a', 0), { ok: true });
    assert.equal(g.awaiting.kind, 'color');
    assert.equal(g.discard[g.discard.length - 1].v, 'wild');
    assert.ok(uno.play(g, 'a', 0).error); // nada mais vale até escolher
    assert.deepEqual(uno.choose(g, 'a', 'roxo'), { error: 'Escolha uma cor' });
    assert.deepEqual(uno.choose(g, 'a', 'green'), { ok: true });
    assert.equal(g.color, 'green');
    assert.equal(g.awaiting, null);
    assert.equal(g.turn, 1);
});

test('tempo esgotado: sem jogável compra até a primeira jogável e a joga', () => {
    const g = makeGame({ hands: { a: [card('blue', '1')] }, top: card('red', '5') });

    g.deck = [card('red', '9'), card('blue', '3'), card('blue', '4')]; // topo do monte = fim da lista
    assert.deepEqual(uno.autoTurn(g, 'a'), { ok: true });
    assert.equal(g.last.autoDrawn, 3);
    assert.equal(g.discard[g.discard.length - 1].c, 'red');
    assert.equal(g.turn, 1);
});

test('skip pula o próximo jogador', () => {
    const g = makeGame({ hands: { a: [card('red', 'skip'), card('blue', '1')] } });
    uno.play(g, 'a', 0);
    assert.equal(g.turn, 2);
});

test('reverse inverte o sentido; com 2 jogadores funciona como skip', () => {
    const tres = makeGame({ hands: { a: [card('red', 'reverse'), card('blue', '1')] } });
    uno.play(tres, 'a', 0);
    assert.equal(tres.dir, -1);
    assert.equal(tres.turn, 2);

    const dois = makeGame({
        players: ['a', 'b'],
        hands: { a: [card('red', 'reverse'), card('blue', '1')] },
    });
    uno.play(dois, 'a', 0);
    assert.equal(dois.dir, -1);
    assert.equal(dois.turn, 0);
});

test('draw2 e wild4 fazem o próximo comprar e perder a vez', () => {
    const mais2 = makeGame({ hands: { a: [card('red', 'draw2'), card('blue', '1')] } });
    const antes2 = mais2.hands.b.length;
    uno.play(mais2, 'a', 0);
    assert.equal(mais2.hands.b.length, antes2 + 2);
    assert.equal(mais2.turn, 2);

    const mais4 = makeGame({ hands: { a: [card('wild', 'wild4'), card('blue', '1')] } });
    const antes4 = mais4.hands.b.length;
    uno.play(mais4, 'a', 0, 'blue');
    assert.equal(mais4.hands.b.length, antes4 + 4);
    assert.equal(mais4.color, 'blue');
    assert.equal(mais4.turn, 2);
});

test('vitória: jogar a última carta define o vencedor, não passa a vez e trava a partida', () => {
    const g = makeGame({ hands: { a: [card('red', '9')] } });

    assert.deepEqual(uno.play(g, 'a', 0), { ok: true });
    assert.equal(g.winner, 'a');
    assert.equal(g.turn, 0);
    assert.deepEqual(uno.play(g, 'b', 0), { error: 'Partida encerrada' });
    assert.deepEqual(uno.draw(g, 'b'), { error: 'Partida encerrada' });
});

test('compra padrão: 1 carta e a vez passa', () => {
    const g = makeGame();
    const antes = g.hands.a.length;

    assert.deepEqual(uno.draw(g, 'a'), { ok: true });
    assert.equal(g.hands.a.length, antes + 1);
    assert.equal(g.turn, 1);
    assert.deepEqual(uno.draw(g, 'a'), { error: 'Não é a sua vez' });
});

test('drawUntilPlay: compra até sair carta jogável e mantém a vez', () => {
    const g = makeGame({ opts: { drawUntilPlay: true } });

    // O topo do baralho é o fim do array: compra yellow 2, green 4 e então red 7 (jogável).
    g.deck = [card('red', '7'), card('green', '4'), card('yellow', '2')];

    uno.draw(g, 'a');

    assert.equal(g.hands.a.length, 2 + 3);
    assert.equal(g.turn, 0);
    assert.deepEqual(g.hands.a[g.hands.a.length - 1], card('red', '7'));
});

test('baralho vazio: reembaralha o descarte mantendo a carta do topo', () => {
    const g = makeGame();

    g.deck = [];
    g.discard = [card('blue', '4'), card('green', '6'), card('red', '5')];
    g.color = 'red';

    uno.draw(g, 'a');

    assert.equal(g.hands.a.length, 3);
    assert.deepEqual(g.discard, [card('red', '5')]);
    assert.equal(g.deck.length, 1);
});

test('visão: cada jogador vê só a própria mão e a contagem dos outros', () => {
    const g = makeGame({
        hands: { a: [card('red', '1')], b: [card('blue', '2'), card('blue', '3')], c: [card('green', '4')] },
    });
    const visao = uno.view(g, 'a');

    assert.deepEqual(visao.hand, [card('red', '1')]);
    assert.deepEqual(visao.top, card('red', '5'));
    assert.equal(visao.color, 'red');
    assert.equal(visao.turnUid, 'a');
    assert.equal(visao.dir, 1);
    assert.deepEqual(visao.players, [
        { uid: 'a', count: 1, unoCalled: false },
        { uid: 'b', count: 2, unoCalled: false },
        { uid: 'c', count: 1, unoCalled: false },
    ]);
    assert.equal(JSON.stringify(visao).includes('"blue","v":"2"'), false);
    assert.deepEqual(uno.view(g, 'inexistente').hand, []);
});

test('partida completa com bot termina e conserva as 108 cartas', () => {
    const bot = require('../server/uno.bot');

    for (const players of [['a', 'b'], ['a', 'b', 'c'], ['a', 'b', 'c', 'd']]) {
        const g = uno.newGame(players, {});
        let jogadas = 0;

        while (!g.winner && jogadas < 5000) {
            const uid = g.players[g.turn];
            const escolha = bot.chooseMove(g, uid);
            const r = escolha ? uno.play(g, uid, escolha.index, escolha.color) : uno.draw(g, uid);

            assert.equal(r.error, undefined);
            jogadas++;

            const total = g.deck.length + g.discard.length
                + Object.values(g.hands).reduce((soma, mao) => soma + mao.length, 0);
            assert.equal(total, 108);
        }

        assert.ok(g.winner, `partida de ${players.length} jogadores não terminou`);
    }
});


// ----- Contrato (subetapa 4.4) -----

const contractPlayers = [{ id: 'a', nick: 'Ana' }, { id: 'b', nick: 'Beto' }];

runEngineContractSuite('uno', unoEngine, {
    players: contractPlayers,
    invalidPlayers: [{ id: 'a', nick: 'Ana' }],
    validCommand: ({ state }) => ({ playerId: state.players[state.turn], type: 'draw-card', payload: {} }),
    invalidCommand: ({ state }) => ({ playerId: state.players[(state.turn + 1) % state.players.length], type: 'draw-card', payload: {} }),
    finish(context) {
        let current = context;

        while (!unoEngine.isFinished(current)) {
            const uid = current.state.players[current.state.turn];
            const step = unoEngine.handleAction(current, unoEngine.createBotAction(current, uid));

            current = { ...current, state: step.state };
        }

        return current;
    },
});

test('uno: comandos desconhecidos e índices malformados são rejeitados sem alterar o estado', () => {
    const created = unoEngine.createMatch({ config: unoEngine.normalizeConfig({}).config, players: contractPlayers });
    const context = { matchId: 'm', config: {}, players: contractPlayers, state: created.state };
    const before = JSON.stringify(context.state);
    const uid = context.state.players[context.state.turn];

    assert.equal(unoEngine.handleAction(context, { playerId: uid, type: 'explodir', payload: {} }).error.code, 'UNKNOWN_ACTION');
    assert.equal(unoEngine.handleAction(context, { playerId: uid, type: 'play-card', payload: { index: 'constructor' } }).ok, false);
    assert.equal(JSON.stringify(context.state), before);
});

test('uno: normalizeConfig aplica defaults, limites e descarta campos desconhecidos', () => {
    assert.deepEqual(unoEngine.normalizeConfig({}).config, { initialCards: 7, drawUntilPlay: false, stackDraw2: false, stackWild4: false, challengeWild4: false, jumpIn: false, swapSeven: false, rotateZero: false, unoCall: false, autoPlayDrawn: false, choosePlayDrawn: false });
    assert.deepEqual(unoEngine.normalizeConfig({ initialCards: 99, drawUntilPlay: 1, hack: true }).config, { initialCards: 10, drawUntilPlay: true, stackDraw2: false, stackWild4: false, challengeWild4: false, jumpIn: false, swapSeven: false, rotateZero: false, unoCall: false, autoPlayDrawn: false, choosePlayDrawn: false });
});

test('+4 sobre +4 desafiado: se tinha a cor, cada um compra 4; início da partida é sorteado', () => {
    const g = makeGame({ players: ['a', 'b', 'c'], top: card('red', '5'), opts: { stackWild4: true, challengeWild4: true } });

    g.hands.a = [card('wild', 'wild4'), card('red', '1'), card('blue', '2')];
    g.hands.b = [card('wild', 'wild4'), card('green', '3'), card('green', '4')];
    g.hands.c = [card('yellow', '1'), card('yellow', '2')];
    g.deck = Array.from({ length: 30 }, () => card('green', '7'));
    uno.play(g, 'a', 0, 'blue'); // a joga +4 tendo vermelho
    uno.play(g, 'b', 0, 'green'); // b empilha +4 sem ter a cor azul
    assert.equal(g.pending.total, 8);
    const out = uno.challenge(g, 'c');
    assert.ok(out.ok);
    assert.equal(g.last.event.target, 'b');
    assert.equal(g.last.event.success, false); // b não tinha azul
    assert.equal(g.hands.c.length, 2 + 10);

    // Com a cor na mão, a conta é dividida: o alvo compra 4 e o desafiante, o resto (4).
    const h = makeGame({ players: ['a', 'b', 'c'], top: card('red', '5'), opts: { stackWild4: true, challengeWild4: true } });

    h.hands.a = [card('wild', 'wild4'), card('red', '1')];
    h.hands.b = [card('wild', 'wild4'), card('blue', '3')];
    h.hands.c = [card('yellow', '1'), card('yellow', '2')];
    h.deck = Array.from({ length: 30 }, () => card('green', '7'));
    uno.play(h, 'a', 0, 'blue');
    uno.play(h, 'b', 0, 'green');
    assert.ok(uno.challenge(h, 'c').ok);
    assert.equal(h.last.event.success, true);
    assert.equal(h.hands.b.length, 1 + 4);
    assert.equal(h.hands.c.length, 2 + 4);

    const starters = new Set(Array.from({ length: 60 }, () => newGame(['a', 'b', 'c', 'd']).turn));
    assert.ok(starters.size > 1);
});

test('bloqueado não se intromete com bloqueio; 0/7 com 1 carta já vem com UNO', () => {
    const { jumpIn } = require('../server/uno.actions');
    const g = makeGame({ players: ['a', 'b', 'c'], top: card('red', '5'), opts: { jumpIn: true, unoCall: true, swapSeven: true } });

    g.hands.a = [card('red', 'skip'), card('red', '1')];
    g.hands.b = [card('red', 'skip'), card('blue', '1')];
    g.hands.c = [card('red', 'skip'), card('blue', '1')];
    uno.play(g, 'a', 0); // b é bloqueado e c é o próximo
    assert.ok(jumpIn(g, 'b', 0).error);
    assert.ok(jumpIn(g, 'c', 0).error); // c é o próximo da vez: sem intromissão instantânea
    g.hands.a.push(card('red', 'skip'));
    assert.ok(jumpIn(g, 'a', g.hands.a.length - 1).ok); // quem jogou o bloqueio pode repetir com carta idêntica

    const h = makeGame({ players: ['a', 'b'], top: card('red', '5'), opts: { unoCall: true, swapSeven: true } });

    h.hands.a = [card('red', '7'), card('blue', '1'), card('blue', '2')];
    h.hands.b = [card('green', '3')];
    uno.play(h, 'a', 0);
    assert.equal(h.awaiting.kind, 'target');
    uno.choose(h, 'a', undefined, 'b');
    assert.equal(h.hands.a.length, 1);
    assert.equal(h.uno.a, true);
    assert.equal(h.unoVuln, null);
});
