/**
 * ============================================================================
 * ARQUIVO: engine.js
 * LOCAL: server/games/uno/engine.js
 * ============================================================================
 *
 * DESCRIÇÃO:
 * Motor responsável por aplicar as regras e manter a lógica de uma partida
 * de Uno no servidor.
 *
 * RESPONSABILIDADES:
 * - Construir e embaralhar o baralho.
 * - Verificar se uma carta pode ser jogada.
 * - Controlar mãos, monte de compra e pilha de descarte.
 * - Atualizar direção, turnos e efeitos das cartas.
 * - Processar jogadas e compras conforme as regras configuradas.
 * - Produzir uma visão pública e privada adequada para cada jogador.
 *
 * DATA DE CRIAÇÃO: 07/11/2026 (extração para o módulo independente).
 *
 * ATUALIZAÇÕES:
 * - 07/11/2026: Separado do antigo server/uno.js sem alteração intencional
 *   das regras do jogo.
 * - 07/11/2026: Formatação e cabeçalho documental padronizados.
 *
 * AUTOR: Viana-78
 *
 * ============================================================================
 */

// Lógica do Uno (regras básicas). Sem dependências, roda só no servidor.
const COLORS = ['red', 'yellow', 'green', 'blue'];

function buildDeck() {
    const d = [];
    for (const c of COLORS) {
        d.push({ c, v: '0' });
        for (let n = 1; n <= 9; n++)
            d.push({ c, v: String(n) }, { c, v: String(n) });
        for (const v of ['skip', 'reverse', 'draw2'])
            d.push({ c, v }, { c, v });
    }
    for (let i = 0; i < 4; i++)
        d.push({ c: 'wild', v: 'wild' }, { c: 'wild', v: 'wild4' });
    return d; // 108 cartas
}

function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function canPlay(card, top, color) {
    return card.c === 'wild' || card.c === color || card.v === top.v;
}

function advance(g, k) {
    const n = g.players.length;
    g.turn = (((g.turn + g.dir * k) % n) + n) % n;
}

function drawCards(g, uid, k) {
    for (let i = 0; i < k; i++) {
        if (!g.deck.length) {
            const top = g.discard.pop();
            g.deck = shuffle(g.discard);
            g.discard = [top];
        }
        if (!g.deck.length)
            break;
        g.hands[uid].push(g.deck.pop());
    }
}

function newGame(playerIds, opts = {}) {
    const g = {
        players: [...playerIds], hands: {}, deck: shuffle(buildDeck()), discard: [], turn: 0, dir: 1, color: null, winner: null,
        opts: { initialCards: opts.initialCards || 7, drawUntilPlay: !!opts.drawUntilPlay },
    };
    for (const id of g.players)
        g.hands[id] = [];
    for (let i = 0; i < g.opts.initialCards; i++)
        for (const id of g.players)
            g.hands[id].push(g.deck.pop());
    let f;
    do {
        f = g.deck.pop();
        if (f.c === 'wild')
            g.deck.unshift(f);
    } while (f.c === 'wild');
    g.discard.push(f);
    g.color = f.c;
    return g;
}

function play(g, uid, index, color) {
    if (g.winner)
        return { error: 'Partida encerrada' };
    if (g.players[g.turn] !== uid)
        return { error: 'Não é a sua vez' };
    const hand = g.hands[uid];
    const card = hand[index];
    if (!card)
        return { error: 'Carta inválida' };
    const top = g.discard[g.discard.length - 1];
    if (!canPlay(card, top, g.color))
        return { error: 'Essa carta não pode ser jogada' };
    if (card.c === 'wild' && !COLORS.includes(color))
        return { error: 'Escolha uma cor' };
    hand.splice(index, 1);
    g.discard.push(card);
    g.color = card.c === 'wild' ? color : card.c;
    if (!hand.length) {
        g.winner = uid;
        return { ok: true };
    }
    const n = g.players.length;
    if (card.v === 'skip')
        advance(g, 2);
    else if (card.v === 'reverse') {
        g.dir *= -1;
        advance(g, n === 2 ? 2 : 1);
    }
    else if (card.v === 'draw2' || card.v === 'wild4') {
        advance(g, 1);
        drawCards(g, g.players[g.turn], card.v === 'draw2' ? 2 : 4);
        advance(g, 1);
    }
    else
        advance(g, 1);
    return { ok: true };
}

// Padrão: comprar 1 carta encerra a vez. Com drawUntilPlay: compra até sair uma carta jogável e mantém a vez.
function draw(g, uid) {
    if (g.winner)
        return { error: 'Partida encerrada' };
    if (g.players[g.turn] !== uid)
        return { error: 'Não é a sua vez' };
    if (g.opts.drawUntilPlay) {
        let got = false;
        while (!got) {
            const before = g.hands[uid].length;
            drawCards(g, uid, 1);
            if (g.hands[uid].length === before)
                break; // baralho acabou
            const c = g.hands[uid][g.hands[uid].length - 1];
            got = canPlay(c, g.discard[g.discard.length - 1], g.color);
        }
        if (!got)
            advance(g, 1);
        return { ok: true };
    }
    drawCards(g, uid, 1);
    advance(g, 1);
    return { ok: true };
}

// Cada jogador só recebe a própria mão.
function view(g, uid) {
    return {
        hand: g.hands[uid] || [],
        top: g.discard[g.discard.length - 1],
        color: g.color,
        turnUid: g.players[g.turn],
        deckCount: g.deck.length,
        dir: g.dir,
        players: g.players.map((id) => ({ uid: id, count: g.hands[id].length })),
    };
}

module.exports = { newGame, play, draw, view, canPlay };
