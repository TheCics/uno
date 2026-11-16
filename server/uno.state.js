/**
 * ============================================================================
 * ARQUIVO: uno.state.js
 * LOCAL: server/games/uno/uno.state.js
 * ============================================================================
 *
 * DESCRIÇÃO:
 * Criação e manipulação básica do estado de uma partida de Uno.
 *
 * RESPONSABILIDADES:
 * - Criar o estado inicial (mãos, monte, descarte, turno e direção).
 * - Avançar o turno respeitando a direção atual.
 * - Distribuir cartas do monte, reembaralhando o descarte quando necessário.
 *
 * DATA DE CRIAÇÃO: 07/11/2026 (divisão de games/uno/engine.js na Etapa 8).
 *
 * ATUALIZAÇÕES:
 * - 07/11/2026: Extraído de games/uno/engine.js sem alteração das regras do jogo.
 *
 * AUTOR: Viana-78
 *
 * ============================================================================
 */

const { buildDeck, shuffle } = require('./uno.deck');

function newGame(playerIds, opts = {}) {
    const g = {
        players: [...playerIds], hands: {}, deck: shuffle(buildDeck()), discard: [], turn: Math.floor(Math.random() * playerIds.length), dir: 1, // quem começa é sorteado SEMPRE
        color: null, winner: null,
        opts: {
            initialCards: opts.initialCards || 7,
            drawUntilPlay: !!opts.drawUntilPlay,
            stackDraw2: !!opts.stackDraw2, // +2 sobre +2 (acumula)
            stackWild4: !!opts.stackWild4, // +4 sobre +4 (acumula)
            challengeWild4: !!opts.challengeWild4, // desafiar quem jogou +4
            jumpIn: !!opts.jumpIn, // intromissão com carta idêntica
            swapSeven: !!opts.swapSeven, // 7 troca a mão com outro jogador
            rotateZero: !!opts.rotateZero, // 0 gira as mãos
            unoCall: !!opts.unoCall, // gritar UNO / denunciar esquecimento (+2)
            autoPlayDrawn: !!opts.autoPlayDrawn, // carta comprada jogável é jogada obrigatoriamente
            choosePlayDrawn: !!opts.choosePlayDrawn, // ... ou o jogador escolhe jogar/guardar
        },
        pending: null, // { v: 'draw2'|'wild4', total } compra acumulada aguardando o jogador da vez
        challenge: null, // { by, prevColor } +4 que ainda pode ser desafiado
        uno: {}, // { [uid]: true } quem já chamou UNO
        unoVuln: null, // uid que ficou com 1 carta sem chamar UNO (pode ser denunciado)
        unoGraceUid: null, // jogador que está na janela de 300 ms para chamar UNO depois de jogar
        unoGraceUntil: 0, // timestamp (ms) em que a janela curta de UNO termina
        actionLockUntil: 0, // bloqueio global de ações durante a sequência visual de denúncia
        drawn: null, // { uid, index, forced } carta recém-comprada aguardando jogar/guardar
        jumpUntil: 0, // timestamp (ms) até quando a intromissão está aberta
        jumpFrom: 0, // timestamp (ms) em que ela abre (0 = já na jogada; no 7 com troca, só depois da animação)
        autoDraw: false, // +2 acumulado que o jogador da vez não pode empilhar: o servidor compra por ele depois de 2 s
        awaiting: null, // { uid, kind: 'color'|'target', card, prevColor, jumped } carta já está na mesa; falta a escolha
        turnEnd: 0, // timestamp (ms) em que o jogador da vez perde o tempo e o servidor joga por ele
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

module.exports = { newGame, advance, drawCards };
