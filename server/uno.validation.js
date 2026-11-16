/**
 * ============================================================================
 * ARQUIVO: uno.validation.js
 * LOCAL: server/games/uno/uno.validation.js
 * ============================================================================
 *
 * DESCRIÇÃO:
 * Validação dos comandos de jogada e compra do Uno.
 *
 * RESPONSABILIDADES:
 * - Verificar fim de partida, vez do jogador, carta existente, jogada permitida e cor escolhida.
 * - Retornar a mesma mensagem de erro já utilizada pelo motor, sem alterar o estado.
 *
 * DATA DE CRIAÇÃO: 07/11/2026 (divisão de games/uno/engine.js na Etapa 8).
 *
 * ATUALIZAÇÕES:
 * - 07/11/2026: Extraído de games/uno/engine.js sem alteração das regras do jogo.
 * - 09/11/2026: jumpFrom (janela só abre depois da troca do 7) e validateJump aceita alvo do 7.
 * - 09/11/2026: validateJump recusa o próximo da vez (sem jogada instantânea); removido o ignoreJumpWindow do validatePlay.
 *
 * AUTOR: Viana-78
 *
 * ============================================================================
 */

const { COLORS } = require('./uno.deck');
const { canPlay, canStack, canJumpOn, isBlockedSkip } = require('./uno.rules');

const JUMP_MS = 2000;
const UNO_GRACE_MS = 300;

// A janela de intromissão pode começar depois da jogada (jumpFrom): no 7, só depois da troca das mãos.
const jumpWindowOpen = (g) => Boolean(g.opts.jumpIn && g.jumpUntil && Date.now() >= (g.jumpFrom || 0) && Date.now() < g.jumpUntil);
// Do instante da jogada até a janela fechar o jogador da vez precisa esperar (inclusive enquanto a troca é animada).
const jumpPending = (g) => Boolean(g.opts.jumpIn && g.jumpUntil && Date.now() < g.jumpUntil);

// Retorna { error } ou { card }. Não altera o estado da partida.
function validatePlay(g, uid, index, color, target, deferChoice = false) {
    if (g.winner)
        return { error: 'Partida encerrada' };
    if (g.awaiting)
        return { error: 'Escolha pendente' };
    if (g.players[g.turn] !== uid)
        return { error: 'Não é a sua vez' };
    if (jumpPending(g))
        return { error: 'Aguarde: janela de intromissão aberta' };
    if (g.drawn && g.drawn.index !== index)
        return { error: 'Jogue a carta comprada' + (g.drawn.forced ? '' : ' ou guarde') };
    const card = g.hands[uid][index];
    if (!card)
        return { error: 'Carta inválida' };
    const top = g.discard[g.discard.length - 1];
    if (g.pending) {
        if (!canStack(g, card))
            return { error: 'Empilhe uma carta igual ou compre' };
    }
    else if (!canPlay(card, top, g.color))
        return { error: 'Essa carta não pode ser jogada' };
    if (deferChoice)
        return { card };
    if (card.v === '7' && g.opts.swapSeven && (!g.players.includes(target) || target === uid))
        return { error: 'Escolha um jogador para trocar a mão' };
    if (card.c === 'wild' && !COLORS.includes(color))
        return { error: 'Escolha uma cor' };
    return { card };
}

// Retorna { error } ou null.
function validateDraw(g, uid) {
    if (g.winner)
        return { error: 'Partida encerrada' };
    if (g.awaiting)
        return { error: 'Escolha pendente' };
    if (g.players[g.turn] !== uid)
        return { error: 'Não é a sua vez' };
    if (jumpPending(g))
        return { error: 'Aguarde: janela de intromissão aberta' };
    if (g.drawn)
        return { error: 'Jogue a carta comprada' + (g.drawn.forced ? '' : ' ou guarde') };
    return null;
}

function validateJump(g, uid, index, color, deferChoice = false, target = undefined) {
    if (g.winner)
        return { error: 'Partida encerrada' };
    if (g.awaiting)
        return { error: 'Escolha pendente' };
    if (!g.players.includes(uid))
        return { error: 'Jogador inválido' };
    if (!jumpWindowOpen(g))
        return { error: 'Tarde demais para se intrometer' };
    // O próximo da vez não tem intromissão: joga a carta normalmente quando a animação e a janela terminarem.
    if (g.players[g.turn] === uid)
        return { error: 'Você é o próximo: aguarde a sua vez' };
    const card = g.hands[uid][index];
    const top = g.discard[g.discard.length - 1];
    if (!card || card.c !== top.c || card.v !== top.v || !canJumpOn(g, card))
        return { error: 'Só vale carta idêntica à da mesa' };
    if (isBlockedSkip(g, uid, card))
        return { error: 'Você foi bloqueado: não pode se intrometer com bloqueio' };
    if (card.c === 'wild' && !deferChoice && !COLORS.includes(color))
        return { error: 'Escolha uma cor' };
    if (card.v === '7' && g.opts.swapSeven && !deferChoice && (!g.players.includes(target) || target === uid))
        return { error: 'Escolha um jogador para trocar a mão' };
    return { card };
}

function validateKeep(g, uid) {
    if (g.winner)
        return { error: 'Partida encerrada' };
    if (g.awaiting)
        return { error: 'Escolha pendente' };
    if (g.players[g.turn] !== uid)
        return { error: 'Não é a sua vez' };
    if (!g.drawn || g.drawn.uid !== uid || g.drawn.forced)
        return { error: 'Não há carta para guardar' };
    return null;
}

function validateCallUno(g, uid) {
    if (g.winner || !g.opts.unoCall)
        return { error: 'UNO indisponível' };
    if (!g.hands[uid] || g.hands[uid].length > 2)
        return { error: 'Só vale com 2 cartas ou menos' };
    // Com 2 cartas, mantém-se a chamada antecipada. Depois de jogar e ficar com 1,
    // a chamada só é aceita dentro da janela curta iniciada pelo servidor.
    if (g.hands[uid].length === 1 && (g.unoGraceUid !== uid || Date.now() >= g.unoGraceUntil))
        return { error: 'O tempo para dizer UNO acabou' };
    return null;
}

function validateReportUno(g, uid) {
    if (g.winner || !g.opts.unoCall || !g.players.includes(uid))
        return { error: 'Denúncia indisponível' };
    if (!g.unoVuln || g.unoVuln === uid)
        return { error: 'Ninguém para denunciar' };
    if (g.unoGraceUid === g.unoVuln && Date.now() < g.unoGraceUntil)
        return { error: 'Aguarde a janela de UNO terminar' };
    return null;
}

function validateChallenge(g, uid) {
    if (g.winner)
        return { error: 'Partida encerrada' };
    if (g.players[g.turn] !== uid)
        return { error: 'Não é a sua vez' };
    if (!g.challenge)
        return { error: 'Não há +4 para desafiar' };
    return null;
}

module.exports = { validatePlay, validateDraw, validateJump, validateChallenge, validateKeep, validateCallUno, validateReportUno, JUMP_MS, UNO_GRACE_MS };
