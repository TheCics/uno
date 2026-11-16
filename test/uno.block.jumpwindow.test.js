const test = require('node:test');
const assert = require('node:assert');
const engine = require('../server/uno.engine');
const { newGame } = require('../server/uno.state');
const { challenge, play } = require('../server/uno.actions');

const mk = (opts, players = ['a', 'b', 'c', 'd']) => {
    const g = newGame(players, opts);
    g.discard = [{ c: 'red', v: '5' }];
    g.color = 'red';
    g.turn = 0;
    return g;
};
const state = (g) => ({ state: g });
const act = (g, playerId, type, payload = {}) => {
    const r = engine.handleAction(state(g), { playerId, type, payload });
    assert.ok(r.ok !== false, JSON.stringify(r));
    return r.state;
};

test('bloqueio: a janela de intromissão só abre depois da animação (cooldown) e o próximo espera por ela', () => {
    let g = mk({ jumpIn: true });
    g.hands.a = [{ c: 'red', v: 'skip' }, { c: 'blue', v: '1' }];
    g.hands.d = [{ c: 'red', v: 'skip' }, { c: 'blue', v: '2' }];
    g = act(g, 'a', 'play-card', { index: 0 });
    assert.equal(g.last.penalty, 'skip');
    // animação do bloqueio ≈ 3,4 s: a janela abre só depois dela e dura 2 s
    assert.ok(g.jumpFrom > Date.now() + 2500, 'janela abre depois da animação do bloqueio');
    assert.equal(g.jumpUntil - g.jumpFrom, 2000);
    // antes da hora ninguém se intromete
    assert.equal(engine.handleAction(state(g), { playerId: 'd', type: 'jump-in', payload: { index: 0 } }).ok, false);
    // e o relógio de quem joga depois do bloqueio só começa depois da janela
    assert.ok(engine.getPaceMs(state(g)) >= g.jumpUntil - Date.now());
    g.jumpFrom = Date.now() - 1; // animação terminou: a janela está aberta
    const after = act(g, 'd', 'jump-in', { index: 0 }); // c é o próximo da vez (sem intromissão); d está fora da vez
    assert.equal(after.last.penalty, 'skip');
    assert.ok(after.jumpFrom > Date.now() + 2500, 'a janela da intromissão também espera a animação');
});

test('bot reage só depois que a janela abre', () => {
    let g = mk({ jumpIn: true });
    g.hands.a = [{ c: 'red', v: 'skip' }, { c: 'blue', v: '1' }];
    g = act(g, 'a', 'play-card', { index: 0 });
    assert.ok(engine.getReactionDelayMs(state(g)) > 2500);
    g.jumpFrom = Date.now() - 1;
    assert.equal(engine.getReactionDelayMs(state(g)), 0);
});

test('+4 sobre +4 com desafio ganho: cada um compra 4 e quem desafiou continua com a vez', () => {
    const g = mk({ stackWild4: true, challengeWild4: true }, ['a', 'b', 'c']);
    g.hands.a = [{ c: 'wild', v: 'wild4' }, { c: 'red', v: '1' }];
    g.hands.b = [{ c: 'wild', v: 'wild4' }, { c: 'blue', v: '3' }];
    g.hands.c = [{ c: 'yellow', v: '1' }, { c: 'yellow', v: '2' }];
    g.deck = Array.from({ length: 30 }, () => ({ c: 'green', v: '7' }));
    play(g, 'a', 0, 'blue');
    play(g, 'b', 0, 'green');
    assert.equal(g.pending.total, 8);
    assert.ok(challenge(g, 'c').ok);
    assert.equal(g.last.event.success, true);
    assert.deepEqual(g.last.event.draws.map((d) => [d.uid, d.n]), [['b', 4], ['c', 4]]);
    assert.equal(g.players[g.turn], 'c', 'o desafiante ganhou e ainda joga');
    assert.equal(g.pending, null);
});

test('animMs do +4 esperando a cor e do desafio com dois pagantes inclui os símbolos novos', () => {
    let g = mk({ stackWild4: true, challengeWild4: true }, ['a', 'b', 'c']);
    g.hands.a = [{ c: 'wild', v: 'wild4' }, { c: 'red', v: '1' }];
    g = act(g, 'a', 'play-card', { index: 0 });
    assert.equal(g.awaiting.kind, 'color');
    assert.ok(engine.getPaceMs(state(g)) >= 2650);
});
