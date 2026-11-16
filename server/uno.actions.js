/**
 * ============================================================================
 * ARQUIVO: uno.actions.js
 * LOCAL: server/games/uno/uno.actions.js
 * ============================================================================
 *
 * DESCRIÇÃO:
 * Aplicação das jogadas do Uno (jogar carta e comprar) sobre um estado mutável.
 *
 * RESPONSABILIDADES:
 * - Aplicar play/draw no estado recebido (a engine clona antes de chamar).
 * - Manter as regras exatamente como eram no motor antigo.
 * - NÃO conhecer sala, socket ou contrato: quem chama é uno.engine.js.
 *
 * DATA DE CRIAÇÃO: 07/11/2026 (subetapa 4.4, extraído de uno.engine.js).
 *
 * AUTOR: Viana-78
 *
 * ============================================================================
 */

const { advance, drawCards } = require('./uno.state');
const { canPlay, canStack, applyCardEffect, canJumpOn } = require('./uno.rules');
const { COLORS } = require('./uno.deck');
const bot = require('./uno.bot');
const { validatePlay, validateDraw, validateJump, validateChallenge, validateKeep, validateCallUno, validateReportUno, JUMP_MS, UNO_GRACE_MS } = require('./uno.validation');

// Contador de jogadas: o cliente só anima uma jogada quando o número muda.
function nextMove(g) {
    g.moves = (g.moves || 0) + 1;
    return g.moves;
}

// UNO: quem fica com 1 carta sem ter chamado fica "denunciável" até a próxima ação.
function clearUnoVulnerability(g) {
    g.unoVuln = null;
    g.unoGraceUid = null;
    g.unoGraceUntil = 0;
}

function trackUno(g, uid) {
    if (g.opts.unoCall && g.hands[uid].length === 1 && !g.uno[uid]) {
        g.unoVuln = uid;
        g.unoGraceUid = uid;
        g.unoGraceUntil = Date.now() + UNO_GRACE_MS;
    }
    if (g.hands[uid].length !== 1)
        g.uno[uid] = false;
}

// Tira a carta da mão, põe no descarte e zera o que depende da jogada anterior.
function place(g, uid, index) {
    const hand = g.hands[uid];
    const card = hand[index];
    const prevColor = g.color;
    hand.splice(index, 1);
    g.discard.push(card);
    g.challenge = null;
    g.jumpUntil = 0;
    g.jumpFrom = 0;
    clearUnoVulnerability(g);
    g.drawn = null;
    return { card, prevColor };
}

// Efeito comum de jogar uma carta (vez normal ou intromissão): remove da mão, aplica o efeito e registra a jogada.
function commitPlay(g, uid, index, color, target, jumped) {
    const { card, prevColor } = place(g, uid, index);
    if (!g.hands[uid].length) {
        g.color = card.c === 'wild' ? (color || prevColor) : card.c;
        g.winner = uid;
        g.last = { n: nextMove(g), type: 'play', playerId: uid, card, penalty: null, target: null, drawn: 0, event: jumped ? { kind: 'jump' } : null };
        return;
    }
    finishPlay(g, uid, card, color, target, prevColor, jumped, false);
}

// Aplica cor/efeito da carta que já está na mesa. `resolved` = a carta já pousou antes (escolha feita depois da animação).
function finishPlay(g, uid, card, color, target, prevColor, jumped, resolved) {
    g.color = card.c === 'wild' ? color : card.c;
    // Registro público da jogada (alimenta as animações do cliente): quem jogou, a carta e a punição aplicada.
    const n = g.players.length;
    const next = g.players[(((g.turn + g.dir) % n) + n) % n];
    const before = g.hands[next].length;
    const { deferred, event } = applyCardEffect(g, card, { uid, target, prevColor, jumped });
    const penalty = deferred ? null : ({ skip: 'skip', draw2: 'draw2', wild4: 'draw4' }[card.v] || null);
    g.last = {
        n: nextMove(g), type: 'play', playerId: uid, card, penalty, resolved,
        target: penalty ? next : null,
        drawn: penalty && penalty !== 'skip' ? g.hands[next].length - before : 0,
        event: event || (jumped ? { kind: 'jump' } : null),
    };
    if (jumped && event)
        g.last.jumped = true;
    if (g.opts.jumpIn && canJumpOn(g, card))
        g.jumpUntil = Date.now() + JUMP_MS;
    trackUno(g, uid);
}

// Coringa/7 sem escolha: a carta vai para a mesa primeiro (o cliente anima) e só depois o jogador escolhe cor/alvo.
function stagePlay(g, uid, index, jumped) {
    const { card, prevColor } = place(g, uid, index);
    const kind = card.c === 'wild' ? 'color' : 'target';
    if (kind === 'target')
        g.color = card.c;
    g.awaiting = { uid, kind, card, prevColor, jumped };
    g.last = { n: nextMove(g), type: 'play', playerId: uid, card, penalty: null, target: null, drawn: 0, event: null, awaiting: kind, jumped: Boolean(jumped) };
}

const needsChoice = (g, card, color, target) => Boolean(card) && (
    (card.c === 'wild' && color === undefined) || (card.v === '7' && g.opts.swapSeven && target === undefined));

function play(g, uid, index, color, target) {
    const card = g.hands[uid] && g.hands[uid][index];
    const defer = needsChoice(g, card, color, target);
    const check = validatePlay(g, uid, index, color, target, defer);
    if (check.error)
        return { error: check.error };
    if (defer && g.hands[uid].length > 1)
        stagePlay(g, uid, index, false);
    else
        commitPlay(g, uid, index, color, target, false);
    return { ok: true };
}

// Segunda etapa da jogada: cor do coringa ou alvo do 7.
function choose(g, uid, color, target) {
    const aw = g.awaiting;
    if (!aw || aw.uid !== uid)
        return { error: 'Nada para escolher' };
    if (aw.kind === 'color' && !COLORS.includes(color))
        return { error: 'Escolha uma cor' };
    if (aw.kind === 'target' && (!g.players.includes(target) || target === uid))
        return { error: 'Escolha um jogador para trocar a mão' };
    g.awaiting = null;
    finishPlay(g, uid, aw.card, color, target, aw.prevColor, aw.jumped, true);
    return { ok: true };
}

// Intromissão: qualquer jogador fora da vez (inclusive quem acabou de jogar) joga carta idêntica à da mesa
// dentro da janela de 2 s; a vez passa para o jogador seguinte a ele e a janela reabre (encadeia repetidas).
// Quem é o próximo da vez NÃO se intromete (validateJump recusa): ele joga normalmente, só depois da animação e da janela fecharem.
// +2/+4 em intromissão não soma (ver uno.rules).
function jumpIn(g, uid, index, color, target) {
    const card = g.hands[uid] && g.hands[uid][index];
    // Coringa sem cor ou 7 sem alvo: a carta pousa primeiro e a escolha vem depois.
    const defer = Boolean(card) && ((card.c === 'wild' && color === undefined) || (card.v === '7' && g.opts.swapSeven && target === undefined));
    const check = validateJump(g, uid, index, color, defer, target);
    if (check.error)
        return { error: check.error };
    g.turn = g.players.indexOf(uid);
    if (defer && g.hands[uid].length > 1)
        stagePlay(g, uid, index, true);
    else
        commitPlay(g, uid, index, color, target, true);
    return { ok: true };
}

// Escolhas automáticas (tempo esgotado): cor mais numerosa da mão e, no 7, quem tem menos cartas.
function autoChoice(g, uid, index) {
    const card = g.hands[uid][index];
    const color = card.c === 'wild' ? bot.pickColor(g, uid, index) : undefined;
    const others = g.players.filter((id) => id !== uid).sort((a, b) => g.hands[a].length - g.hands[b].length);
    return { color, target: card.v === '7' && g.opts.swapSeven ? others[0] : undefined };
}

// Tempo esgotado: escolhe cor/alvo pendente; senão joga uma carta válida aleatória;
// sem carta válida, compra até aparecer a primeira jogável e a joga.
function autoTurn(g, uid) {
    if (g.winner)
        return { error: 'Partida encerrada' };
    if (g.awaiting) {
        if (g.awaiting.uid !== uid)
            return { error: 'Nada para escolher' };
        const others = g.players.filter((id) => id !== uid).sort((a, b) => g.hands[a].length - g.hands[b].length);
        return choose(g, uid, bot.pickColor(g, uid, -1), others[0]);
    }
    if (g.players[g.turn] !== uid)
        return { error: 'Não é a sua vez' };
    g.jumpUntil = 0;
    g.jumpFrom = 0;
    if (g.drawn && g.drawn.uid === uid) {
        const c = autoChoice(g, uid, g.drawn.index);
        return play(g, uid, g.drawn.index, c.color, c.target);
    }
    const top = g.discard[g.discard.length - 1];
    const hand = g.hands[uid];
    const options = hand.map((card, i) => i).filter((i) => (g.pending ? canStack(g, hand[i]) : canPlay(hand[i], top, g.color)));
    if (options.length) {
        const i = options[Math.floor(Math.random() * options.length)];
        const c = autoChoice(g, uid, i);
        return play(g, uid, i, c.color, c.target);
    }
    if (g.pending)
        return draw(g, uid);
    const handBefore = hand.length;
    g.challenge = null;
    clearUnoVulnerability(g);
    g.uno[uid] = false;
    let found = -1;
    while (found < 0) {
        const before = hand.length;
        drawCards(g, uid, 1);
        if (hand.length === before)
            break; // baralho acabou
        if (canPlay(hand[hand.length - 1], top, g.color))
            found = hand.length - 1;
    }
    const got = hand.length - handBefore;
    if (found < 0) {
        advance(g, 1);
        g.last = { n: nextMove(g), type: 'draw', playerId: uid, drawn: got };
        return { ok: true };
    }
    const c = autoChoice(g, uid, found);
    const result = play(g, uid, found, c.color, c.target);
    if (g.last)
        g.last.autoDrawn = got; // cartas compradas antes de jogar (o cliente anima a compra e depois a jogada)
    return result;
}

// Padrão: comprar 1 carta encerra a vez. Com drawUntilPlay: compra até sair uma carta jogável e mantém a vez.
// Com autoPlayDrawn/choosePlayDrawn: se a carta comprada puder ser jogada, o jogador mantém a vez e deve jogá-la
// (ou, no modo escolha, pode guardá-la).
function draw(g, uid) {
    const error = validateDraw(g, uid);
    if (error)
        return error;
    const handBefore = g.hands[uid].length;
    g.jumpUntil = 0;
    g.jumpFrom = 0;
    g.challenge = null;
    clearUnoVulnerability(g);
    g.uno[uid] = false;
    const record = () => {
        g.last = { n: nextMove(g), type: 'draw', playerId: uid, drawn: g.hands[uid].length - handBefore };
    };
    if (g.pending) {
        drawCards(g, uid, g.pending.total);
        g.pending = null;
        advance(g, 1);
        record();
        g.last.pendingTaken = true; // o cliente anima o +N indo até quem compra
        return { ok: true };
    }
    const feature = g.opts.autoPlayDrawn || g.opts.choosePlayDrawn;
    const setDrawn = () => {
        g.drawn = { uid, index: g.hands[uid].length - 1, forced: !g.opts.choosePlayDrawn };
    };
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
        else if (feature)
            setDrawn();
        record();
        return { ok: true };
    }
    drawCards(g, uid, 1);
    const last = g.hands[uid][g.hands[uid].length - 1];
    if (feature && g.hands[uid].length > handBefore && canPlay(last, g.discard[g.discard.length - 1], g.color))
        setDrawn();
    else
        advance(g, 1);
    record();
    return { ok: true };
}

// Guardar a carta comprada (só no modo escolha): encerra a vez.
function keep(g, uid) {
    const error = validateKeep(g, uid);
    if (error)
        return error;
    g.drawn = null;
    advance(g, 1);
    g.last = { n: nextMove(g), type: 'draw', playerId: uid, drawn: 0, event: { kind: 'keep' } };
    return { ok: true };
}

// Desafio do +4 (vale também contra +4 sobre +4: o alvo é quem jogou o último +4).
// O desafiante vê a mão do alvo. Se o alvo tinha a cor da mesa: ele compra 4 e o desafiante paga o resto
// da pilha (com +4 e +4, cada um compra 4) e o desafiante continua com a vez. Se não tinha, o desafiante compra a pilha + 2 e perde a vez.
function challenge(g, uid) {
    const error = validateChallenge(g, uid);
    if (error)
        return error;
    const { by, prevColor } = g.challenge;
    const guilty = g.hands[by].some((c) => c.c === prevColor);
    const reveal = { to: uid, of: by, color: prevColor, cards: structuredClone(g.hands[by]) };
    const total = g.pending.total;
    const plan = guilty
        ? [{ uid: by, n: 4 }, ...(total > 4 ? [{ uid, n: total - 4 }] : [])]
        : [{ uid, n: total + 2 }];
    g.challenge = null;
    g.pending = null;
    g.jumpUntil = 0;
    clearUnoVulnerability(g);
    const draws = plan.map(({ uid: who, n }) => {
        const before = g.hands[who].length;
        drawCards(g, who, n);
        g.uno[who] = false;
        return { uid: who, n: g.hands[who].length - before };
    });
    // Desafio ganho: quem desafiou paga a sua parte (no +4 sobre +4 são 4), mas continua com a vez e pode jogar.
    // Desafio perdido: compra a pilha + 2 e perde a vez.
    if (!guilty)
        advance(g, 1);
    g.last = {
        n: nextMove(g), type: 'draw', playerId: draws[0].uid, drawn: draws[0].n,
        event: { kind: 'challenge', by: uid, target: by, success: guilty, color: prevColor, draws }, reveal,
    };
    return { ok: true };
}

// Gritar UNO antes de ficar com 1 carta (ou logo depois, se ainda ninguém denunciou).
function callUno(g, uid) {
    const error = validateCallUno(g, uid);
    if (error)
        return error;
    g.uno[uid] = true;
    if (g.unoVuln === uid)
        clearUnoVulnerability(g);
    return { ok: true, silent: true };
}

// Denúncia: quem esqueceu o UNO compra 2 cartas.
function reportUno(g, uid) {
    const error = validateReportUno(g, uid);
    if (error)
        return error;
    const culprit = g.unoVuln;
    const before = g.hands[culprit].length;
    clearUnoVulnerability(g);
    g.uno[culprit] = false;
    drawCards(g, culprit, 2);
    g.last = {
        n: nextMove(g), type: 'draw', playerId: culprit, drawn: g.hands[culprit].length - before,
        event: { kind: 'uno-report', by: uid, target: culprit },
    };
    return { ok: true };
}

module.exports = { play, choose, autoTurn, draw, jumpIn, challenge, keep, callUno, reportUno };
