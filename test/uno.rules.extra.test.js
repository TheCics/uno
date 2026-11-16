const test = require('node:test');
const assert = require('node:assert');
const engine = require('../server/uno.engine');
const { newGame } = require('../server/uno.state');
const { play, draw, jumpIn, challenge } = require('../server/uno.actions');

const mk = (opts) => {
    const g = newGame(['a', 'b', 'c'], opts);
    g.discard = [{ c: 'red', v: '5' }];
    g.color = 'red';
    g.turn = 0;
    return g;
};

test('+2 sobre +2 acumula', () => {
    const g = mk({ stackDraw2: true });
    g.hands.a = [{ c: 'red', v: 'draw2' }, { c: 'red', v: '1' }];
    g.hands.b = [{ c: 'blue', v: 'draw2' }, { c: 'red', v: '1' }];
    assert.ok(play(g, 'a', 0).ok);
    assert.strictEqual(g.pending.total, 2);
    assert.ok(play(g, 'b', 1).error); // carta comum não vale
    assert.ok(play(g, 'b', 0).ok);
    assert.strictEqual(g.pending.total, 4);
    const before = g.hands.c.length;
    draw(g, 'c');
    assert.strictEqual(g.hands.c.length, before + 4);
    assert.strictEqual(g.pending, null);
});

test('desafio do +4', () => {
    const g = mk({ challengeWild4: true });
    g.hands.a = [{ c: 'wild', v: 'wild4' }, { c: 'red', v: '9' }];
    assert.ok(play(g, 'a', 0, 'blue').ok);
    const bBefore = g.hands.b.length;
    assert.ok(challenge(g, 'b').ok); // a tinha vermelha → a compra 4
    assert.strictEqual(g.hands.a.length, 5);
    assert.strictEqual(g.hands.b.length, bBefore);
    assert.strictEqual(g.players[g.turn], 'b');
    const h = mk({ challengeWild4: true });
    h.hands.a = [{ c: 'wild', v: 'wild4' }, { c: 'blue', v: '9' }];
    play(h, 'a', 0, 'blue');
    const n = h.hands.b.length;
    challenge(h, 'b');
    assert.strictEqual(h.hands.b.length, n + 6);
    assert.strictEqual(h.players[h.turn], 'c');
});

test('jump-in e janela', () => {
    const g = mk({ jumpIn: true });
    g.hands.a = [{ c: 'red', v: '5' }, { c: 'red', v: '5' }, { c: 'red', v: '1' }];
    g.hands.b = [{ c: 'red', v: '5' }, { c: 'blue', v: '1' }];
    g.hands.c = [{ c: 'red', v: '5' }, { c: 'blue', v: '2' }];
    play(g, 'a', 0);
    assert.ok(play(g, 'b', 0).error); // vez de b, mas janela aberta
    assert.ok(jumpIn(g, 'c', 0).ok);
    assert.strictEqual(g.players[g.turn], 'a');
    assert.ok(jumpIn(g, 'a', 0).error); // a é o próximo da vez: sem intromissão instantânea
    assert.ok(jumpIn(g, 'b', 0).ok); // b está fora da vez: pode se intrometer (repetida em sequência)
    g.jumpUntil = Date.now() - 1;
    assert.ok(jumpIn(g, 'a', 0).error);
});

test('7 troca e 0 gira', () => {
    const g = mk({ swapSeven: true, rotateZero: true });
    g.hands.a = [{ c: 'red', v: '7' }, { c: 'red', v: '1' }];
    g.hands.b = [{ c: 'blue', v: '2' }];
    assert.ok(play(g, 'a', 0).ok); // sem alvo: carta pousa e o alvo é escolhido depois
    assert.strictEqual(g.awaiting.kind, 'target');
    assert.ok(engineChoose(g, 'a', null, 'b').ok);
    assert.strictEqual(g.hands.a.length, 1);
    assert.strictEqual(g.hands.b.length, 1 + 0 + 0 || 1);
    const h = mk({ rotateZero: true });
    h.hands.a = [{ c: 'red', v: '0' }, { c: 'red', v: '1' }];
    const ha = h.hands.a, hb = h.hands.b;
    play(h, 'a', 0);
    assert.strictEqual(h.hands.b, ha);
    assert.strictEqual(h.hands.c, hb);
});

test('engine aceita config nova', () => {
    const r = engine.normalizeConfig({ jumpIn: true });
    assert.ok(r.ok !== false);
});

const { keep, callUno, reportUno, choose: engineChoose } = require('../server/uno.actions');

test('jump-in vale para +2 e +4 (wild4 exige cor)', () => {
    const g = mk({ jumpIn: true });
    g.discard = [{ c: 'red', v: '5' }];
    g.hands.a = [{ c: 'red', v: 'draw2' }, { c: 'red', v: '1' }];
    g.hands.b = [{ c: 'red', v: 'draw2' }, { c: 'blue', v: '2' }];
    play(g, 'a', 0); // b compra 2 e perde a vez: o próximo é c
    assert.ok(jumpIn(g, 'b', 0).ok);
    const w = mk({ jumpIn: true });
    w.hands.a = [{ c: 'wild', v: 'wild4' }, { c: 'red', v: '1' }];
    w.hands.b = [{ c: 'wild', v: 'wild4' }, { c: 'blue', v: '2' }];
    play(w, 'a', 0, 'blue');
    assert.ok(jumpIn(w, 'b', 0).ok); // sem cor: pousa e a cor vem depois
    assert.ok(engineChoose(w, 'b', 'green').ok);
    assert.strictEqual(w.color, 'green');
});

test('UNO: esquecer permite denúncia (+2); chamar evita', () => {
    const g = mk({ unoCall: true });
    g.hands.a = [{ c: 'red', v: '1' }, { c: 'red', v: '2' }];
    play(g, 'a', 0);
    assert.strictEqual(g.unoVuln, 'a');
    assert.ok(reportUno(g, 'a').error); // não pode denunciar a si mesmo
    const n = g.hands.a.length;
    g.unoGraceUntil = Date.now() - 1; // a denúncia só é liberada depois da janela de 300 ms
    assert.ok(reportUno(g, 'b').ok);
    assert.strictEqual(g.hands.a.length, n + 2);
    const h = mk({ unoCall: true });
    h.hands.a = [{ c: 'red', v: '1' }, { c: 'red', v: '2' }];
    assert.ok(callUno(h, 'a').ok);
    play(h, 'a', 0);
    assert.strictEqual(h.unoVuln, null);
});

test('comprada jogável: obrigatória ou escolha', () => {
    const g = mk({ autoPlayDrawn: true });
    g.hands.a = [{ c: 'blue', v: '9' }];
    g.deck.push({ c: 'red', v: '8' });
    draw(g, 'a');
    assert.strictEqual(g.players[g.turn], 'a');
    assert.ok(draw(g, 'a').error);
    assert.ok(keep(g, 'a').error); // forçada: não pode guardar
    assert.ok(play(g, 'a', 0).error); // só a comprada
    assert.ok(play(g, 'a', 1).ok);
    const h = mk({ choosePlayDrawn: true });
    h.hands.a = [{ c: 'blue', v: '9' }];
    h.deck.push({ c: 'red', v: '8' });
    draw(h, 'a');
    assert.ok(keep(h, 'a').ok);
    assert.strictEqual(h.players[h.turn], 'b');
});

test('jump-in com +2/+4 não soma: quebra a sequência e vale só o próprio valor', () => {
    const g = mk({ jumpIn: true, stackDraw2: true });
    g.hands.a = [{ c: 'red', v: 'draw2' }, { c: 'red', v: '1' }];
    g.hands.b = [{ c: 'blue', v: '3' }];
    g.hands.c = [{ c: 'red', v: 'draw2' }, { c: 'blue', v: '2' }];
    assert.ok(play(g, 'a', 0).ok);
    assert.strictEqual(g.pending.total, 2);
    assert.ok(jumpIn(g, 'c', 0).ok); // c está fora da sequência (a vez era de b)
    assert.strictEqual(g.pending.total, 2); // não vira 4
    assert.strictEqual(g.players[g.turn], 'a');

    const w = mk({ jumpIn: true, stackWild4: true });
    w.hands.a = [{ c: 'wild', v: 'wild4' }, { c: 'red', v: '1' }];
    w.hands.b = [{ c: 'blue', v: '3' }];
    w.hands.c = [{ c: 'wild', v: 'wild4' }, { c: 'blue', v: '2' }];
    assert.ok(play(w, 'a', 0, 'blue').ok);
    assert.strictEqual(w.pending.total, 4);
    assert.ok(jumpIn(w, 'c', 0, 'green').ok);
    assert.strictEqual(w.pending.total, 4); // não vira 8
});

test('próximo da vez com carta idêntica NÃO usa jump-in: espera a janela e joga normal (o +2 soma)', () => {
    const g = mk({ jumpIn: true, stackDraw2: true });
    g.hands.a = [{ c: 'red', v: 'draw2' }, { c: 'red', v: '1' }];
    g.hands.b = [{ c: 'red', v: 'draw2' }, { c: 'blue', v: '3' }];
    play(g, 'a', 0);
    assert.ok(play(g, 'b', 0).error); // janela aberta: b espera
    assert.ok(jumpIn(g, 'b', 0).error); // b é o próximo: nada de jogada rápida
    assert.strictEqual(g.hands.b.length, 2);
    g.jumpUntil = 0; // animação e janela terminaram
    assert.ok(play(g, 'b', 0).ok); // jogada normal, empilha
    assert.strictEqual(g.pending.total, 4);
    assert.strictEqual(g.players[g.turn], 'c');
    assert.ok(!g.last.event || g.last.event.kind !== 'jump');

    const h = mk({ jumpIn: true });
    h.hands.a = [{ c: 'red', v: '5' }, { c: 'red', v: '1' }];
    h.hands.b = [{ c: 'red', v: '5' }, { c: 'blue', v: '3' }];
    play(h, 'a', 0);
    assert.ok(jumpIn(h, 'b', 0).error);
    h.jumpUntil = 0;
    assert.ok(play(h, 'b', 0).ok);
    assert.strictEqual(h.last.event, null); // não é intromissão
    assert.strictEqual(h.players[h.turn], 'c');
});

test('coringa: ninguém se intromete até a cor ser escolhida; depois a janela abre', () => {
    const g = mk({ jumpIn: true });
    g.hands.a = [{ c: 'wild', v: 'wild' }, { c: 'red', v: '1' }];
    g.hands.c = [{ c: 'wild', v: 'wild' }, { c: 'blue', v: '2' }];
    assert.ok(play(g, 'a', 0).ok); // sem cor: a carta pousa e fica aguardando a escolha
    assert.ok(g.awaiting);
    assert.strictEqual(g.jumpUntil, 0);
    assert.ok(jumpIn(g, 'c', 0).error); // ainda sem cor: bloqueado
    assert.ok(engineChoose(g, 'a', 'green').ok);
    assert.ok(g.jumpUntil > Date.now()); // cor escolhida: janela aberta
    g.jumpFrom = 0; // (a engine adia a abertura até o fim da animação: ver uno.jumpseven.autodraw.test.js)
    assert.ok(jumpIn(g, 'c', 0, 'blue').ok);
});
