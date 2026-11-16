const test = require('node:test');
const assert = require('node:assert/strict');
const unoEngine = require('../server/uno.engine');
const { newGame } = require('../server/uno.state');
const { view } = require('../server/uno.view');

const card = (c, v) => ({ c, v });

function preparedGame() {
    const state = newGame(['a', 'b', 'c'], { initialCards: 3, unoCall: true });
    state.hands.a = [card('red', '5'), card('blue', '1')];
    state.hands.b = [card('green', '2'), card('blue', '3')];
    state.hands.c = [card('yellow', '4'), card('blue', '6')];
    state.discard = [card('red', '4')];
    state.color = 'red';
    state.turn = 0;
    state.turnEnd = Date.now() + 5000;
    return state;
}

function playToOne(state) {
    const result = unoEngine.handleAction({ state }, {
        playerId: 'a', type: 'play-card', payload: { index: 0 },
    });
    assert.equal(result.ok, true);
    assert.equal(result.state.hands.a.length, 1);
    return result.state;
}

test('UNO: mantém chamada antecipada com duas cartas', () => {
    const state = preparedGame();
    const result = unoEngine.handleAction({ state }, { playerId: 'a', type: 'call-uno', payload: {} });
    assert.equal(result.ok, true);
    assert.equal(result.state.uno.a, true);
    assert.equal(result.state.unoVuln, null);
});

test('UNO: depois de jogar, a chamada é aceita dentro da janela de 300 ms', () => {
    const state = playToOne(preparedGame());
    assert.equal(state.unoGraceUid, 'a');
    assert.ok(state.unoGraceUntil > Date.now());
    const result = unoEngine.handleAction({ state }, { playerId: 'a', type: 'call-uno', payload: {} });
    assert.equal(result.ok, true);
    assert.equal(result.state.uno.a, true);
    assert.equal(result.state.unoVuln, null);
    assert.equal(result.state.unoGraceUid, null);
});

test('UNO: depois dos 300 ms, a chamada atrasada é recusada', () => {
    const state = playToOne(preparedGame());
    state.unoGraceUntil = Date.now() - 1;
    const result = unoEngine.handleAction({ state }, { playerId: 'a', type: 'call-uno', payload: {} });
    assert.equal(result.ok, false);
    assert.match(result.error.message, /tempo para dizer UNO/i);
    assert.equal(state.hands.a.length, 1);
});

test('UNO: denúncia aguarda a graça, aplica +2 e bloqueia qualquer jogada pela duração visual', () => {
    const state = playToOne(preparedGame());
    const early = unoEngine.handleAction({ state }, { playerId: 'b', type: 'report-uno', payload: {} });
    assert.equal(early.ok, false);
    assert.match(early.error.message, /janela de UNO/i);

    state.unoGraceUntil = Date.now() - 1;
    const turnEndBefore = state.turnEnd;
    const report = unoEngine.handleAction({ state }, { playerId: 'b', type: 'report-uno', payload: {} });
    assert.equal(report.ok, true);
    assert.equal(report.state.hands.a.length, 3);
    assert.equal(report.state.last.event.kind, 'uno-report');
    assert.equal(report.state.last.event.by, 'b');
    assert.equal(report.state.last.event.target, 'a');
    assert.equal(report.state.last.drawn, 2);
    assert.ok(report.state.actionLockUntil > Date.now());
    assert.ok(report.state.turnEnd >= turnEndBefore + 4400);

    const blocked = unoEngine.handleAction({ state: report.state }, { playerId: 'c', type: 'play-card', payload: { index: 0 } });
    assert.equal(blocked.ok, false);
    assert.match(blocked.error.message, /animação da denúncia/i);
    assert.ok(unoEngine.getPaceMs({ state: report.state }) >= 4400);
    assert.ok(unoEngine.getReactionDelayMs({ state: report.state }) >= 4400);
    assert.equal(view(report.state, 'c').actionLockMs > 0, true);
});


test('UNO: a visão pública só marca quem declarou pelo botão, antes ou depois da jogada', () => {
    const state = preparedGame();
    const before = view(state, 'b');
    assert.equal(Boolean(before.players.find((player) => player.uid === 'a').unoCalled), false);

    const preCall = unoEngine.handleAction({ state }, { playerId: 'a', type: 'call-uno', payload: {} });
    assert.equal(preCall.ok, true);
    assert.equal(view(preCall.state, 'b').players.find((player) => player.uid === 'a').unoCalled, true);

    const played = unoEngine.handleAction({ state: preCall.state }, { playerId: 'a', type: 'play-card', payload: { index: 0 } });
    assert.equal(played.ok, true);
    const publicPlayer = view(played.state, 'b').players.find((player) => player.uid === 'a');
    assert.equal(publicPlayer.count, 1);
    assert.equal(publicPlayer.unoCalled, true);

    const lateCallState = playToOne(preparedGame());
    assert.equal(Boolean(view(lateCallState, 'b').players.find((player) => player.uid === 'a').unoCalled), false);
    const lateCall = unoEngine.handleAction({ state: lateCallState }, { playerId: 'a', type: 'call-uno', payload: {} });
    assert.equal(lateCall.ok, true);
    assert.equal(view(lateCall.state, 'b').players.find((player) => player.uid === 'a').unoCalled, true);
});
