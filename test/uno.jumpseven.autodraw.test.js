const test = require('node:test');
const assert = require('node:assert');
const engine = require('../server/uno.engine');
const { newGame } = require('../server/uno.state');
const { play, choose, jumpIn } = require('../server/uno.actions');

const mk = (opts) => {
    const g = newGame(['a', 'b', 'c'], opts);
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

test('7 aceita intromissão depois da troca; a janela só abre depois da animação', () => {
    let g = mk({ jumpIn: true, swapSeven: true });
    g.hands.a = [{ c: 'red', v: '7' }, { c: 'red', v: '7' }, { c: 'blue', v: '1' }];
    g.hands.b = [{ c: 'green', v: '2' }, { c: 'green', v: '3' }];
    g.hands.c = [{ c: 'red', v: '7' }, { c: 'blue', v: '9' }];
    g = act(g, 'a', 'play-card', { index: 0 }); // 7 pousa, falta o alvo
    assert.equal(g.awaiting.kind, 'target');
    g = act(g, 'a', 'choose', { target: 'b' });
    assert.equal(g.last.event.kind, 'swap');
    assert.ok(g.jumpFrom > Date.now() + 1000, 'janela abre só depois da troca');
    assert.equal(g.jumpUntil - g.jumpFrom, 2000);
    assert.ok(engine.handleAction(state(g), { playerId: 'c', type: 'jump-in', payload: { index: 0, target: 'a' } }).ok === false, 'antes da hora não vale');
    g.jumpFrom = Date.now() - 1; // troca terminou
    // b é o próximo da vez: não tem intromissão (joga normal depois da janela)
    assert.equal(engine.handleAction(state(g), { playerId: 'b', type: 'jump-in', payload: { index: 0, target: 'a' } }).ok, false);
    // c está fora da vez: joga o outro 7 vermelho e troca com a (que ficou com o leque de b)
    g = act(g, 'c', 'jump-in', { index: 0, target: 'a' });
    assert.equal(g.last.event.kind, 'swap');
    assert.equal(g.hands.a.length, 1); // c jogou o 7 (sobrou 1 carta) e trocou: a fica com ela
    assert.equal(g.hands.c.length, 2);
});

test('intromissão com 7 sem alvo pede a escolha depois', () => {
    let g = mk({ jumpIn: true, swapSeven: true });
    g.hands.a = [{ c: 'red', v: '1' }, { c: 'blue', v: '1' }];
    g.hands.b = [{ c: 'red', v: '2' }, { c: 'blue', v: '2' }];
    g.hands.c = [{ c: 'red', v: '7' }, { c: 'blue', v: '9' }];
    g.discard = [{ c: 'red', v: '7' }];
    g.jumpUntil = Date.now() + 2000;
    g = act(g, 'c', 'jump-in', { index: 0 });
    assert.equal(g.awaiting.kind, 'target');
    assert.equal(g.awaiting.uid, 'c');
});

test('+2 acumulado sem como empilhar: compra automática depois de ~2 s', () => {
    let g = mk({ stackDraw2: true });
    g.hands.a = [{ c: 'red', v: 'draw2' }, { c: 'red', v: '1' }];
    g.hands.b = [{ c: 'blue', v: '1' }, { c: 'green', v: '3' }];
    g = act(g, 'a', 'play-card', { index: 0 });
    assert.equal(g.autoDraw, true);
    assert.ok(g.turnEnd - Date.now() >= 2000);
    assert.equal(engine.getPlayerView(state(g), 'b').turnMs, 0);
    const t = engine.getTimeoutAction(state(g));
    assert.equal(t.playerId, 'b');
    const before = g.hands.b.length;
    g = act(g, 'b', 'auto-turn');
    assert.equal(g.hands.b.length, before + 2);
    assert.equal(g.pending, null);
    assert.equal(g.autoDraw, false);
});

test('+2 acumulado com carta para empilhar não compra sozinho', () => {
    let g = mk({ stackDraw2: true });
    g.hands.a = [{ c: 'red', v: 'draw2' }, { c: 'red', v: '1' }];
    g.hands.b = [{ c: 'blue', v: 'draw2' }, { c: 'green', v: '3' }];
    g = act(g, 'a', 'play-card', { index: 0 });
    assert.equal(g.autoDraw, false);
});

test('coringa: a janela de intromissão só abre depois da animação da escolha de cor (respiro)', () => {
    let g = mk({ jumpIn: true });
    g.hands.a = [{ c: 'wild', v: 'wild' }, { c: 'red', v: '1' }];
    g.hands.c = [{ c: 'wild', v: 'wild' }, { c: 'blue', v: '2' }];
    g = act(g, 'a', 'play-card', { index: 0 });
    assert.ok(g.awaiting);
    assert.equal(g.jumpUntil, 0, 'sem janela antes da escolha');
    g = act(g, 'a', 'choose', { color: 'green' });
    assert.ok(g.jumpFrom > Date.now() + 500, 'a janela abre depois da pizza voltar para a carta');
    assert.equal(g.jumpUntil - g.jumpFrom, 2000);
    assert.equal(engine.handleAction(state(g), { playerId: 'c', type: 'jump-in', payload: { index: 0, color: 'blue' } }).ok, false);
    g.jumpFrom = Date.now() - 1;
    g = act(g, 'c', 'jump-in', { index: 0, color: 'blue' });
    assert.equal(g.color, 'blue');
});

test('ritmo: o próximo (bot) espera a animação do bloqueio, não só a janela de 2 s', () => {
    let g = mk({ jumpIn: true });
    g.hands.a = [{ c: 'red', v: 'skip' }, { c: 'red', v: '1' }];
    g = act(g, 'a', 'play-card', { index: 0 });
    assert.equal(g.last.penalty, 'skip');
    const pace = engine.getPaceMs(state(g));
    assert.ok(pace >= 3800, `ritmo ${pace} deve cobrir a animação inteira do bloqueio`);
});

test('bot na vez não se intromete (joga normal na hora dele)', () => {
    let g = mk({ jumpIn: true });
    g.hands.a = [{ c: 'red', v: '5' }, { c: 'red', v: '1' }];
    g.hands.b = [{ c: 'red', v: '5' }, { c: 'blue', v: '3' }];
    g.hands.c = [{ c: 'red', v: '5' }, { c: 'blue', v: '3' }];
    g = act(g, 'a', 'play-card', { index: 0 });
    const realRandom = Math.random;
    Math.random = () => 0;
    try {
        assert.equal(engine.createBotReaction(state(g), 'b'), null); // b é o próximo
        assert.equal(engine.createBotReaction(state(g), 'c').type, 'jump-in'); // c está fora da vez
    } finally {
        Math.random = realRandom;
    }
});
