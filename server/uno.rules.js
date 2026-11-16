/**
 * ============================================================================
 * ARQUIVO: uno.rules.js
 * LOCAL: server/games/uno/uno.rules.js
 * ============================================================================
 *
 * DESCRIÇÃO:
 * Regras de jogabilidade e efeitos das cartas do Uno.
 *
 * RESPONSABILIDADES:
 * - Verificar se uma carta pode ser jogada sobre a carta do topo.
 * - Aplicar o efeito da carta jogada (pular, inverter, +2, +4 e carta comum).
 *
 * DATA DE CRIAÇÃO: 07/11/2026 (divisão de games/uno/engine.js na Etapa 8).
 *
 * ATUALIZAÇÕES:
 * - 07/11/2026: Extraído de games/uno/engine.js sem alteração das regras do jogo.
 * - 09/11/2026: 7 com troca de mãos também aceita intromissão (a janela abre depois da troca).
 * - 08/11/2026: +2/+4 em intromissão não soma com a compra pendente (passa a valer só o valor da própria carta).
 *
 * AUTOR: Viana-78
 *
 * ============================================================================
 */

const { advance, drawCards } = require('./uno.state');

function canPlay(card, top, color) {
    return card.c === 'wild' || card.c === color || card.v === top.v;
}

const isNumber = (card) => /^[0-9]$/.test(card.v);

// Intromissão vale para números (7 inclusive: depois da troca das mãos), bloqueio, inverter, +2, coringa e +4; só o 0 giratório fica de fora.
const JUMPABLE = ['skip', 'reverse', 'draw2', 'wild', 'wild4'];
function canJumpOn(g, card) {
    if (!isNumber(card) && !JUMPABLE.includes(card.v))
        return false;
    return !(card.v === '0' && g.opts.rotateZero);
}

// Quem acabou de ser bloqueado não pode se intrometer com outro bloqueio.
const isBlockedSkip = (g, uid, card) => card.v === 'skip' && Boolean(g.last) && g.last.penalty === 'skip' && g.last.target === uid;

// Depois de trocar/girar mãos, quem ficou com 1 carta já está com UNO (não precisa gritar de novo).
function autoUno(g, ids) {
    if (!g.opts.unoCall)
        return;
    for (const id of ids) {
        g.uno[id] = g.hands[id].length === 1;
        if (g.uno[id] && g.unoVuln === id) {
            g.unoVuln = null;
            g.unoGraceUid = null;
            g.unoGraceUntil = 0;
        } else if (!g.uno[id] && g.unoVuln === id) {
            g.unoVuln = null;
            g.unoGraceUid = null;
            g.unoGraceUntil = 0;
        }
    }
}

// Com a regra ligada, a compra do +2/+4 fica pendente e o próximo jogador pode empilhar.
function canStack(g, card) {
    if (!g.pending || card.v !== g.pending.v)
        return false;
    return card.v === 'draw2' ? g.opts.stackDraw2 : g.opts.stackWild4;
}

// Aplica o efeito da carta já jogada e passa a vez.
// ctx: { uid, target, prevColor, jumped }. Retorna { deferred, event } (deferred = compra ficou pendente).
function applyCardEffect(g, card, ctx = {}) {
    const n = g.players.length;
    const o = g.opts;
    if (card.v === 'skip')
        advance(g, 2);
    else if (card.v === 'reverse') {
        g.dir *= -1;
        advance(g, n === 2 ? 2 : 1);
    }
    else if (card.v === 'draw2' || card.v === 'wild4') {
        const amount = card.v === 'draw2' ? 2 : 4;
        const stack = card.v === 'draw2' ? o.stackDraw2 : o.stackWild4;
        const challengeable = card.v === 'wild4' && o.challengeWild4;
        if (stack || challengeable) {
            // Intromissão (jump-in) quebra a sequência: o +2/+4 dela NÃO soma com o pendente, passa a valer só o próprio valor.
            const stacked = Boolean(g.pending) && !ctx.jumped;
            g.pending = { v: card.v, total: (stacked ? g.pending.total : 0) + amount };
            if (challengeable) // +4 sobre +4: o desafio vale contra quem jogou o último +4
                g.challenge = { by: ctx.uid, prevColor: ctx.prevColor };
            advance(g, 1);
            return { deferred: true, event: stacked ? { kind: 'stack', total: g.pending.total } : null };
        }
        advance(g, 1);
        drawCards(g, g.players[g.turn], amount);
        advance(g, 1);
    }
    else if (card.v === '7' && o.swapSeven && g.hands[ctx.target]) {
        [g.hands[ctx.uid], g.hands[ctx.target]] = [g.hands[ctx.target], g.hands[ctx.uid]];
        autoUno(g, [ctx.uid, ctx.target]);
        advance(g, 1);
        return { deferred: false, event: { kind: 'swap', target: ctx.target } };
    }
    else if (card.v === '0' && o.rotateZero) {
        const hs = g.players.map((id) => g.hands[id]);
        g.players.forEach((id, i) => {
            g.hands[g.players[(((i + g.dir) % n) + n) % n]] = hs[i];
        });
        autoUno(g, g.players);
        advance(g, 1);
        return { deferred: false, event: { kind: 'rotate', dir: g.dir } };
    }
    else
        advance(g, 1);
    return { deferred: false, event: null };
}

module.exports = { canPlay, applyCardEffect, canStack, canJumpOn, isBlockedSkip, isNumber };
