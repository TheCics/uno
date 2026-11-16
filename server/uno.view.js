/**
 * ============================================================================
 * ARQUIVO: uno.view.js
 * LOCAL: server/games/uno/uno.view.js
 * ============================================================================
 *
 * DESCRIÇÃO:
 * Visão da partida de Uno entregue a cada jogador.
 *
 * RESPONSABILIDADES:
 * - Expor apenas a mão do próprio jogador.
 * - Expor o topo, a cor, o turno, o monte, a direção e a contagem de cartas dos jogadores.
 *
 * DATA DE CRIAÇÃO: 07/11/2026 (divisão de games/uno/engine.js na Etapa 8).
 *
 * ATUALIZAÇÕES:
 * - 07/11/2026: Extraído de games/uno/engine.js sem alteração das regras do jogo.
 * - 09/11/2026: jumpDelayMs (janela de intromissão depois da troca do 7) e autoDraw (compra automática do +2 acumulado).
 * - 08/11/2026: turnLimit do turno normal passou de 7 s para 12 s (acompanha TURN_MS do uno.engine.js).
 *
 * AUTOR: Viana-78
 *
 * ============================================================================
 */

// Cada jogador só recebe a própria mão.
// A mão revelada num desafio só vai para o desafiante.
function publicLast(last, uid) {
    if (!last || !last.reveal)
        return last || null;
    const { reveal, ...rest } = last;
    return reveal.to === uid ? last : rest;
}

function view(g, uid) {
    const live = Boolean(g.turnEnd) && !g.winner;
    return {
        hand: g.hands[uid] || [],
        top: g.discard[g.discard.length - 1],
        color: g.color,
        turnUid: g.players[g.turn],
        deckCount: g.deck.length,
        dir: g.dir,
        last: publicLast(g.last, uid),
        pending: g.pending,
        canChallenge: Boolean(g.challenge && uid && g.players[g.turn] === uid),
        jumpMs: g.opts.jumpIn && g.jumpUntil ? Math.max(0, g.jumpUntil - Date.now()) : 0,
        jumpDelayMs: g.opts.jumpIn && g.jumpUntil && g.jumpFrom ? Math.max(0, g.jumpFrom - Date.now()) : 0, // a janela só abre depois da troca do 7
        autoDraw: Boolean(g.autoDraw), // +2 acumulado sem como empilhar: a compra é automática
        rules: g.opts,
        unoVuln: g.unoVuln || null,
        unoGraceUid: g.unoGraceUid || null,
        unoGraceMs: g.unoGraceUid ? Math.max(0, g.unoGraceUntil - Date.now()) : 0,
        actionLockMs: Math.max(0, (g.actionLockUntil || 0) - Date.now()),
        unoCalled: Boolean(uid && g.uno && g.uno[uid]),
        drawn: g.drawn && g.drawn.uid === uid ? g.drawn : null,
        players: g.players.map((id) => ({ uid: id, count: g.hands[id].length, unoCalled: Boolean(g.uno && g.uno[id]) })),
        awaiting: g.awaiting && g.awaiting.uid === uid ? { kind: g.awaiting.kind } : null,
        turnMs: live && !g.autoDraw ? Math.max(0, g.turnEnd - Date.now()) : 0, // sem contagem quando a compra é automática
        turnLimit: g.awaiting ? 10000 : 12000,
        // Fim da rodada: todas as mãos são reveladas depois da animação da última carta.
        allHands: g.winner ? Object.fromEntries(g.players.map((id) => [id, g.hands[id]])) : null,
        winner: g.winner || null,
    };
}

module.exports = { view };
