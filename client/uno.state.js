/**
 * ============================================================================
 * ARQUIVO: uno.state.js
 * LOCAL: client/src/features/games/uno/uno.state.js
 * ============================================================================
 *
 * DESCRIÇÃO:
 * Estado da interface da partida de Uno.
 *
 * RESPONSABILIDADES:
 * - Guardar a visão da partida recebida do servidor (mão do jogador, topo, cor, turno e contagens).
 * - Guardar a carta coringa aguardando escolha de cor e o resultado final exibido ao jogador.
 * - Guardar a assinatura da última mesa desenhada, usada para animar a carta do topo.
 *
 * DATA DE CRIAÇÃO: 07/11/2026 (extraído de client/src/state.js).
 *
 * ATUALIZAÇÕES:
 * - 07/11/2026: Extraído do objeto global S (game, pick, result e topKey).
 * - 09/11/2026: jumpStart (janela abre depois da troca do 7), 7 aceita intromissão e block (leque cinza só enquanto o símbolo de bloqueio está sobre ele).
 * - 09/11/2026: isJumpable recusa o próximo da vez (realTurnUid): sem jogada rápida, ele espera a animação e a janela.
 * - 09/11/2026: symbolN controla quando o +N fixo da mesa aparece.
 * - 09/11/2026: jumpTimer (redesenho no fim da janela) e pickFailedN (cor escolhida no modal quando a pizza clicável do PC falha).
 * - 10/11/2026: campos de áudio (som da vez, cronômetro do jump-in, última jogada sonorizada).
 * - 08/11/2026: Turno de 12 s com contagem visível só nos últimos 7 s; coringa ainda sem cor escolhida bloqueia a intromissão no cliente.
 *
 * AUTOR: Viana-78
 *
 * ============================================================================
 */

import { authState } from './portal.js';

const unoState = {
    game: null,
    animationsStopped: false,
    jumpEnd: 0,
    jumpStart: 0, // quando a janela de intromissão abre (no 7 com troca, só depois da animação)
    block: null, // { uid, n }: quem está com o leque cinza agora (do instante em que o símbolo de bloqueio chega no leque até ele sumir)
    result: null,
    topKey: undefined,
    animKey: null,
    prevTop: null,
    prevColor: null, // cor da mesa antes da última jogada (pinta o coringa que fica embaixo do monte)
    busyUntil: 0,
    turnTimer: null,
    jumpTimer: null, // redesenha a mesa quando a janela de intromissão fecha (some a barra e as cartas voltam ao normal)
    pickFailedN: null, // n da jogada cuja pizza clicável (PC) não pôde ser mostrada: aí vale o modal de cor
    dealt: false, // a distribuição das cartas já foi animada nesta rodada
    dealing: false,
    dealHide: false, // durante a distribuição os leques reais ficam escondidos (a animação monta os leques)
    revealAt: 0, // quando as mãos de todos aparecem (fim da rodada)
    turnEnd: 0, // relógio do jogador da vez (ms) e limite usado para saber quando mostrar a contagem
    turnLimit: 12000,
    symbolN: null, // n da jogada cujo símbolo +N já surgiu (o +N fixo da mesa só aparece depois da animação)
    clock: null,
    turnSoundTimer: null, // agenda o som da vez para depois da animação de entrada do turno
    jumpSoundKey: null, // n da jogada cuja janela de jump-in já foi sonorizada (não reinicia em vistas repetidas)
    jumpSoundStarted: false, // o cronômetro sonoro realmente começou (só então o som final faz sentido)
    jumpSoundStartTimer: null,
    jumpSoundEndTimer: null,
    jumpSoundHandle: null, // permite parar só o loop do cronômetro
    lastSoundMoveN: null, // n da última jogada que já tocou o som de carta
    unoFxKeys: {}, // chave da declaração já animada, separada por jogador
    unoFxReady: {}, // quem já terminou o gatilho visual/sonoro e pode exibir o selo no chip
    pendingUnoDeclaration: null, // declaração pós-jogada aguardando o DOM do chip
    drawing: null, // { uid: { n, arrived } }: cartas compradas que ainda não chegaram (não aparecem na mão/contagem)
    hold: null, // { counts, hand }: estado anterior mantido na tela até a animação (troca/giro/desafio) terminar
};

function resetUnoState() {
    unoState.animationsStopped = true;
    unoState.game = null;
    unoState.result = null;
    unoState.jumpEnd = 0;
    unoState.jumpStart = 0;
    unoState.unoGraceUid = null;
    unoState.unoGraceEnd = 0;
    unoState.unoGraceKey = null;
    unoState.callPending = false;
    unoState.reportPending = false;
    unoState.reportLockUntil = 0;
    unoState.reportLockKey = null;
    unoState.block = null;
    unoState.animKey = null;
    unoState.busyUntil = 0;
    unoState.dealt = false;
    unoState.dealing = false;
    unoState.dealHide = false;
    unoState.revealAt = 0;
    unoState.turnEnd = 0;
    unoState.symbolN = null;
    unoState.hold = null;
    unoState.drawing = null;
    unoState.pickFailedN = null;
    clearTimeout(unoState.turnTimer);
    clearTimeout(unoState.jumpTimer);
    clearTimeout(unoState.unoGraceTimer);
    clearTimeout(unoState.reportLockTimer);
    clearInterval(unoState.clock);
    clearTimeout(unoState.turnSoundTimer);
    clearTimeout(unoState.jumpSoundStartTimer);
    clearTimeout(unoState.jumpSoundEndTimer);
    unoState.jumpSoundHandle?.stop?.();
    unoState.turnSoundTimer = null;
    unoState.jumpSoundKey = null;
    unoState.jumpSoundStarted = false;
    unoState.jumpSoundStartTimer = null;
    unoState.jumpSoundEndTimer = null;
    unoState.jumpSoundHandle = null;
    unoState.lastSoundMoveN = null;
    unoState.unoFxKeys = {};
    unoState.unoFxReady = {};
    unoState.pendingUnoDeclaration = null;
}

// Carta idêntica à da mesa durante a janela de intromissão (regra do lobby). O 7 também vale (depois da troca das mãos).
const JUMPABLE = ['skip', 'reverse', 'draw2', 'wild', 'wild4'];

function jumpWindowOpen(game) {
    return Boolean(game.rules?.jumpIn) && Date.now() >= unoState.jumpStart && Date.now() < unoState.jumpEnd && Boolean(game.top);
}

function isJumpable(game, card) {
    const rules = game.rules || {};
    if (Date.now() < unoState.reportLockUntil)
        return false;
    if (!jumpWindowOpen(game))
        return false;
    if (game.last?.awaiting)
        return false; // coringa/7 ainda sem cor/alvo escolhido: ninguém se intromete antes da escolha
    if (game.realTurnUid === authState.uid)
        return false; // o próximo da vez não tem jump-in: joga normal, depois da animação e da janela
    if (card.c !== game.top.c || card.v !== game.top.v || !(/^[0-9]$/.test(card.v) || JUMPABLE.includes(card.v)))
        return false;
    if (card.v === 'skip' && game.last?.penalty === 'skip' && game.last.target === authState.uid)
        return false; // quem foi bloqueado não se intromete com bloqueio
    return !(card.v === '0' && rules.rotateZero);
}

// Jogável na vez: com compra acumulada só vale empilhar carta igual (se a regra permitir).
function isPlayable(game, card, canPlay, index) {
    if (game.drawn && index !== game.drawn.index)
        return false;
    const pending = game.pending;
    if (pending) {
        const allowed = pending.v === 'draw2' ? game.rules?.stackDraw2 : game.rules?.stackWild4;
        return Boolean(allowed) && card.v === pending.v;
    }
    return canPlay(card, game.top, game.color);
}

// Contagem regressiva do relógio de jogo: só aparece a partir dos 5 s de espera (7 s para jogar, 10 s para escolher).
// A contagem regressiva só aparece quando restam 7 s ou menos.
const CLOCK_SHOW_MS = 7000;

function clockSeconds() {
    const left = unoState.turnEnd - Date.now();
    return unoState.turnEnd > 0 && left > 0 && left <= CLOCK_SHOW_MS ? Math.ceil(left / 1000) : 0;
}

export { unoState, resetUnoState, isJumpable, isPlayable, jumpWindowOpen, clockSeconds };
