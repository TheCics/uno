/**
 * ============================================================================
 * ARQUIVO: uno.events.js
 * LOCAL: client/src/features/games/uno/uno.events.js
 * ============================================================================
 *
 * DESCRIÇÃO:
 * Ganchos do Uno chamados pelo game.manager quando chegam eventos do servidor.
 *
 * RESPONSABILIDADES:
 * - Guardar a visão recebida e controlar o tempo das animações (a vez só libera depois delas).
 * - Animar a distribuição inicial das cartas e a revelação das mãos no fim da rodada.
 * - Manter o relógio de jogo (contagem regressiva visível nos últimos 7 s, com pulso a cada segundo).
 *
 * ATUALIZAÇÕES:
 * - 09/11/2026: Redesenho no fim da janela de intromissão e laço de movimento (uno.motion.js) para a barra e as setas.
 * - 10/11/2026: Áudio: som de jogar carta, som da vez (depois da animação) e cronômetro sonoro do jump-in; a lógica de janela/animação é a da versão aprovada.
 * - 10/11/2026: Trilha sonora (hanginoutuno.mp3) começa com a partida e para no fim/encerramento.
 * - 10/11/2026: Som do cronômetro do jump-in deixa de ser loop: toca uma vez, ajustado à duração da barra.
 * - 10/11/2026: Sons de interface: faixa de decisão aparecendo, hover no baralho/botões, clique de opção e clique na carta (PC).
 * - 08/11/2026: Turno de 12 s; a contagem pulsa a cada segundo (classe tick reiniciada no relógio).
 *
 * AUTOR: Viana-78
 *
 * ============================================================================
 */

import { unoState, clockSeconds, jumpWindowOpen, isJumpable } from './uno.state.js';
import { render } from './portal.js';
import { authState } from './portal.js';
import { roomsState } from './portal.js';
import { unoActions } from './uno.actions.js';
import { clearHeld, playUnoAnimations, unoAnimationMs, dealMs, pendingDraws, animateUnoDeclaration, stopUnoAnimations, resumeUnoAnimations } from './uno.animations.js';
import { startMotion } from './uno.motion.js';
import { unoSfx } from './audio/uno.sfx.js';

// Atualiza a contagem regressiva direto no DOM (sem redesenhar a mesa).
function tickClock() {
    const seconds = clockSeconds();
    document.querySelectorAll('.uclock').forEach((node) => {
        node.hidden = !seconds;
        if (!seconds) {
            delete node.dataset.sec;
            node.classList.remove('tick');
            return;
        }
        if (node.dataset.sec === String(seconds))
            return;
        // A cada segundo novo o número troca e o pulso (zoom, salto e giro) recomeça.
        node.dataset.sec = String(seconds);
        node.textContent = seconds;
        node.classList.remove('tick');
        void node.offsetWidth; // força o navegador a reiniciar a animação
        node.classList.add('tick');
    });
}

function startClock(game) {
    clearInterval(unoState.clock);
    const owner = roomsState.room?.players.find((player) => player.uid === game.turnUid);
    // O relógio vale para humanos; a vez dos bots não tem contagem.
    unoState.turnEnd = game.turnMs && owner && !owner.bot ? Date.now() + game.turnMs : 0;
    unoState.turnLimit = game.turnLimit || 12000;
    if (unoState.turnEnd)
        unoState.clock = setInterval(tickClock, 250);
}

// ---- Som do cronômetro do jump-in ----------------------------------------------------------------------
// Loop enquanto a barra amarela enche (só para quem tem carta para intrometer) e, se ela chegar a encher,
// o som final. A chave (n da jogada) impede que vistas repetidas da mesma jogada reiniciem o áudio.
function closeJumpAudio(expired) {
    clearTimeout(unoState.jumpSoundStartTimer);
    clearTimeout(unoState.jumpSoundEndTimer);
    unoState.jumpSoundStartTimer = null;
    unoState.jumpSoundEndTimer = null;
    unoState.jumpSoundHandle?.stop?.();
    unoState.jumpSoundHandle = null;
    const started = unoState.jumpSoundStarted;
    unoState.jumpSoundStarted = false;
    if (expired && started)
        unoSfx.playJumpTimerEnd();
}

function stopJumpAudio() {
    closeJumpAudio(false);
    unoState.jumpSoundKey = null;
}

function armJumpStart(key) {
    clearTimeout(unoState.jumpSoundStartTimer);
    unoState.jumpSoundStartTimer = setTimeout(() => {
        const current = unoState.game;
        if (unoState.jumpSoundKey !== key || !current)
            return;
        if (Date.now() < unoState.jumpStart - 30)
            return armJumpStart(key); // o início da janela foi adiado por uma vista repetida
        if (unoState.jumpSoundStarted || !jumpWindowOpen(current) || !current.hand?.some((card) => isJumpable(current, card)))
            return;
        // O som dura o mesmo que o resto da barra (antes era em loop de 1,6 s e repetia no fim).
        unoState.jumpSoundHandle = unoSfx.playJumpTimer(Math.max(1, unoState.jumpEnd - Date.now()));
        unoState.jumpSoundStarted = true;
    }, Math.max(0, unoState.jumpStart - Date.now()) + 5);
}

function armJumpEnd(key) {
    clearTimeout(unoState.jumpSoundEndTimer);
    unoState.jumpSoundEndTimer = setTimeout(() => {
        if (unoState.jumpSoundKey !== key)
            return;
        if (Date.now() < unoState.jumpEnd - 30)
            return armJumpEnd(key); // a janela foi estendida por uma vista repetida
        closeJumpAudio(true);
    }, Math.max(0, unoState.jumpEnd - Date.now()) + 5);
}

function syncJumpAudio(game, previousJumpEnd) {
    const last = game.last;
    const jumped = Boolean(last?.jumped) || last?.event?.kind === 'jump';
    const eligible = Boolean(game.rules?.jumpIn) && game.jumpMs > 0 && last?.n != null && !last.awaiting && !jumped;
    const key = eligible ? last.n : null;
    const sameMove = last?.n != null && last.n === unoState.jumpSoundKey;
    if (sameMove && key !== null)
        return; // mesma janela repetida: não reinicia o som
    const expired = unoState.jumpSoundKey !== null && Date.now() >= previousJumpEnd;
    closeJumpAudio(expired); // encerra a janela anterior (som final só se ela realmente esgotou)
    if (sameMove)
        return; // a mesma jogada voltou sem janela: a chave continua registrada para não recomeçar
    unoState.jumpSoundKey = key;
    if (key === null)
        return;
    armJumpStart(key);
    armJumpEnd(key);
}

// ---- Sons de interface (PC) -------------------------------------------------------------------------------
// Faixa de decisão (desafiar/aceitar, jogar/guardar): som quando ela aparece. O DOM é redesenhado a cada vista,
// então o observador compara "tinha faixa / tem faixa" em vez de depender de um ponto único de desenho.
let bandShown = false;
let bandObserver = null;
let lastHoverAt = 0;
let uiSoundsReady = false;

function watchBand() {
    if (bandObserver)
        return;
    const screen = document.getElementById('screen');
    if (!screen)
        return;
    bandObserver = new MutationObserver(() => {
        const shown = Boolean(screen.querySelector('.decband'));
        if (shown && !bandShown)
            unoSfx.playDecision();
        bandShown = shown;
    });
    bandObserver.observe(screen, { childList: true, subtree: true });
}

// Hover no baralho (só na minha vez) e nos botões da faixa de decisão. Só em aparelhos com mouse; o intervalo mínimo evita
// repetir o som quando o redesenho da mesa recria o elemento debaixo do cursor.
function installUiSounds() {
    if (uiSoundsReady)
        return;
    uiSoundsReady = true;
    document.addEventListener('mouseover', (event) => {
        const game = unoState.game;
        if (!game || !window.matchMedia('(hover: hover)').matches)
            return;
        const target = event.target.closest?.('.pile, .dbtn');
        if (!target || target.contains(event.relatedTarget))
            return;
        if (target.matches('.pile') && game.realTurnUid !== authState.uid)
            return;
        if (Date.now() - lastHoverAt < 350)
            return;
        lastHoverAt = Date.now();
        unoSfx.playHover();
    });
}


function syncUnoGrace(game) {
    const uid = game.unoGraceUid || null;
    const remaining = Math.max(0, Number(game.unoGraceMs) || 0);
    const key = uid ? `${uid}:${game.last?.n ?? 'hand'}` : null;
    clearTimeout(unoState.unoGraceTimer);
    if (!uid) {
        unoState.unoGraceUid = null;
        unoState.unoGraceEnd = 0;
        unoState.unoGraceKey = null;
        return;
    }
    if (key !== unoState.unoGraceKey) {
        unoState.unoGraceKey = key;
        unoState.unoGraceUid = uid;
        unoState.unoGraceEnd = remaining > 0 ? Date.now() + remaining : 0;
    } else if (remaining > 0) {
        const reportedEnd = Date.now() + remaining;
        unoState.unoGraceEnd = unoState.unoGraceEnd ? Math.min(unoState.unoGraceEnd, reportedEnd) : reportedEnd;
    }
    if (unoState.unoGraceEnd > Date.now()) {
        unoState.unoGraceTimer = setTimeout(() => {
            unoState.unoGraceEnd = 0;
            if (unoState.game === game)
                render();
        }, Math.max(0, unoState.unoGraceEnd - Date.now()) + 20);
    } else {
        unoState.unoGraceEnd = 0;
    }
}

function syncReportLock(game, animMs) {
    const isNewReport = game.last?.event?.kind === 'uno-report' && game.last.n !== unoState.reportLockKey;
    if (isNewReport) {
        const duration = Math.max(animMs, Number(game.actionLockMs) || 0, 0);
        unoState.reportLockKey = game.last.n;
        unoState.reportLockUntil = Date.now() + duration;
        unoState.reportPending = false;
        clearTimeout(unoState.reportLockTimer);
        unoState.reportLockTimer = setTimeout(() => {
            if (unoState.reportLockKey === game.last?.n) {
                unoState.reportLockUntil = 0;
                render();
            }
        }, duration + 30);
    } else if (Number(game.actionLockMs) > 0) {
        unoState.reportLockUntil = Math.max(unoState.reportLockUntil, Date.now() + Number(game.actionLockMs));
    }
    if (game.unoCalled)
        unoState.callPending = false;
    if (unoState.callPending && game.unoGraceUid !== authState.uid && !game.unoCalled)
        unoState.callPending = false;
}

// Ganchos chamados pelo game.manager (eventos de transporte genéricos do servidor).
const unoEvents = {
    onView(game) {
        resumeUnoAnimations();
        const previousGame = unoState.game;
        const previousJumpEnd = unoState.jumpEnd; // lido antes de a janela ser recalculada abaixo
        game.realTurnUid = game.turnUid; // turnUid fica null durante a animação; isJumpable precisa saber de quem é a vez de verdade
        clearTimeout(unoState.turnTimer);
        unoState.prevTop = previousGame?.top || null;
        unoState.prevColor = previousGame?.color || null; // cor da mesa antes desta jogada (o coringa que mudou a cor continua dessa cor embaixo)
        startClock(game);
        // Início da rodada: o monte distribui as cartas antes de a vez liberar.
        let animMs = 0;
        if (game.allHands) {
            unoState.dealt = false; // a próxima rodada distribui de novo
        } else if (!game.last && !unoState.dealt) {
            unoState.dealt = true;
            unoState.dealing = true;
            unoState.dealHide = true;
            animMs = dealMs(game);
        }
        // Jogada nova: a vez só passa (e libera as ações) depois da animação terminar.
        if (game.last && game.last.n !== unoState.animKey)
            animMs = unoAnimationMs(game.last);
        unoState.jumpEnd = Date.now() + (game.jumpMs || 0);
        unoState.jumpStart = Date.now() + (game.jumpDelayMs || 0);
        // Janela fechou: redesenha para a barra sumir e as cartas voltarem ao normal (antes só mudavam no próximo evento).
        clearTimeout(unoState.jumpTimer);
        if (game.jumpMs > 0)
            unoState.jumpTimer = setTimeout(() => { if (unoState.game === game) render(); }, game.jumpMs + 40);
        startMotion(); // setas e barra do jump-in (relógio, não animação CSS)
        // 7 com troca: a janela de intromissão abre depois da animação; a mesa é redesenhada nesse instante.
        if (game.jumpDelayMs > 0)
            setTimeout(() => { if (unoState.game === game) render(); }, game.jumpDelayMs + 30);
        // Fim da rodada: as mãos de todos aparecem depois da animação da última carta.
        if (game.allHands)
            unoState.revealAt = Date.now() + animMs - 30;
        syncUnoGrace(game);
        syncReportLock(game, animMs);
        const ms = Math.max(animMs, game.jumpMs || 0, Number(game.actionLockMs) || 0, unoState.reportLockUntil - Date.now());
        if (ms > 0) {
            const realTurn = game.turnUid;
            game.turnUid = null;
            unoState.busyUntil = Date.now() + ms;
            unoState.turnTimer = setTimeout(() => {
                if (unoState.game === game) {
                    unoState.hold = null;
                    unoState.drawing = null;
                    unoState.dealHide = false;
                    if (!game.allHands)
                        game.turnUid = realTurn;
                    render();
                }
            }, ms);
        }
        // Troca/giro/desafio: contagens e mão ficam como antes até a animação mostrar o resultado.
        unoState.hold = null;
        const prev = previousGame;
        // Som de jogar carta: uma vez por jogada nova (a intromissão usa o próprio som, no impacto da animação; as cartas especiais somam o delas).
        if (game.last && game.last.n !== unoState.lastSoundMoveN) {
            unoState.lastSoundMoveN = game.last.n;
            const jumped = Boolean(game.last.jumped) || game.last.event?.kind === 'jump';
            // O som especial da carta (uno.animations.js) toca no impacto, junto com este som genérico.
            if (game.last.type === 'play' && !game.last.resolved && !jumped)
                unoSfx.playCard();
        }
        // Som da vez: só para o dono do turno, depois da animação de entrada, e só quando o turno realmente muda para ele.
        const previousTurnUid = previousGame?.realTurnUid ?? previousGame?.turnUid;
        clearTimeout(unoState.turnSoundTimer);
        unoState.turnSoundTimer = null;
        if (game.realTurnUid === authState.uid && (!prev || previousTurnUid !== authState.uid)) {
            unoState.turnSoundTimer = setTimeout(() => {
                if (unoState.game === game && game.realTurnUid === authState.uid)
                    unoSfx.playTurn();
            }, Math.max(animMs, game.jumpMs || 0) + 80);
        }
        const kind = game.last?.event?.kind;
        if (prev && game.last && game.last.n !== unoState.animKey && ['swap', 'rotate', 'challenge'].includes(kind)) {
            const counts = Object.fromEntries(prev.players.map((player) => [player.uid, player.count]));
            let hand = prev.hand;
            if (game.last.type === 'play') {
                counts[game.last.playerId] -= 1; // a carta jogada já saiu da mão
                if (game.last.playerId === authState.uid) {
                    const k = hand.findIndex((c) => c.c === game.last.card.c && c.v === game.last.card.v);
                    hand = hand.filter((_, i) => i !== k);
                }
            }
            unoState.hold = { counts, hand };
        }
        // Cartas compradas só aparecem (na ordem certa) conforme chegam: nada de leque pré-montado.
        unoState.drawing = null;
        const draws = game.last && game.last.n !== unoState.animKey ? pendingDraws(game.last) : null;
        if (draws)
            unoState.drawing = Object.fromEntries(Object.entries(draws).map(([uid, n]) => [uid, { n, arrived: 0 }]));
        // Se a pessoa jogou com uma carta e só então clicou no botão, a última jogada não muda;
        // detectamos a transição false -> true e disparamos o UNO depois que o chip foi redesenhado.
        const previousUnoPlayer = previousGame?.players?.find((player) => player.uid === game.last?.playerId);
        const currentUnoPlayer = game.players?.find((player) => player.uid === game.last?.playerId);
        const calledAfterPlay = Boolean(game.rules?.unoCall && game.last?.type === 'play' && previousGame?.last?.n === game.last.n
            && currentUnoPlayer?.count === 1 && currentUnoPlayer.unoCalled && !previousUnoPlayer?.unoCalled
            && !game.winner && !['swap', 'rotate'].includes(game.last.event?.kind));
        if (calledAfterPlay)
            unoState.pendingUnoDeclaration = { uid: game.last.playerId, n: game.last.n };
        // O status público pode continuar verdadeiro por vários turnos; só removemos o selo local
        // quando o jogador deixa de ter exatamente uma carta declarada.
        const ready = { ...(unoState.unoFxReady || {}) };
        // Em uma entrada/reconexão no meio da partida, o jogador pode já ter declarado UNO.
        // Nesse caso, apenas hidratamos o selo: não repetimos explosão nem SFX de uma ação passada.
        if (!previousGame) {
            for (const player of game.players || []) {
                if (player.count === 1 && player.unoCalled)
                    ready[player.uid] = true;
            }
        }
        for (const player of game.players || []) {
            if (player.count !== 1 || !player.unoCalled)
                delete ready[player.uid];
        }
        unoState.unoFxReady = ready;
        unoState.game = game;
        watchBand();
        installUiSounds();
        unoSfx.startMusic(); // trilha sonora de fundo enquanto a partida existe (ignora se já estiver tocando)
        syncJumpAudio(game, previousJumpEnd);
        // Carta comprada jogável: no modo obrigatório ela é jogada sozinha, depois da animação.
        if (game.drawn && game.drawn.forced && game.turnUid !== undefined) {
            const index = game.drawn.index;
            setTimeout(() => {
                if (unoState.game === game && game.drawn?.index === index && game.turnUid === authState.uid)
                    unoActions.play({ i: index, snd: 'none' });
            }, ms + 120);
        }
        unoState.result = null;
        if (!game.last)
            unoState.animKey = null;
    },

    // Depois que a mesa foi desenhada (precisa das posições reais dos elementos).
    afterRender(game) {
        playUnoAnimations(game);
        const pending = unoState.pendingUnoDeclaration;
        if (pending && pending.n === game.last?.n) {
            unoState.pendingUnoDeclaration = null;
            animateUnoDeclaration(pending.uid, pending.n);
        }
    },

    onActionError() {
        unoState.callPending = false;
        unoState.reportPending = false;
    },

    onEnded() {
        stopUnoAnimations();
        clearTimeout(unoState.jumpTimer);
        clearTimeout(unoState.unoGraceTimer);
        clearTimeout(unoState.reportLockTimer);
        unoState.unoGraceUid = null;
        unoState.unoGraceEnd = 0;
        unoState.unoGraceKey = null;
        unoState.reportLockUntil = 0;
        unoState.callPending = false;
        unoState.reportPending = false;
        unoState.unoFxKeys = {};
        unoState.unoFxReady = {};
        unoState.pendingUnoDeclaration = null;
        clearHeld(false);
        unoState.game = null;
        unoState.dealt = false;
        clearInterval(unoState.clock);
        clearTimeout(unoState.turnSoundTimer);
        stopJumpAudio();
        unoSfx.stopMusic();
        bandShown = false;
    },

    onOver(result) {
        clearTimeout(unoState.jumpTimer);
        clearTimeout(unoState.unoGraceTimer);
        clearTimeout(unoState.reportLockTimer);
        unoState.unoGraceUid = null;
        unoState.unoGraceEnd = 0;
        unoState.unoGraceKey = null;
        unoState.reportLockUntil = 0;
        unoState.callPending = false;
        unoState.reportPending = false;
        unoState.unoFxKeys = {};
        unoState.unoFxReady = {};
        unoState.pendingUnoDeclaration = null;
        clearHeld(false);
        unoState.game = null;
        unoState.dealt = false;
        unoState.result = result;
        clearInterval(unoState.clock);
        clearTimeout(unoState.turnSoundTimer);
        stopJumpAudio();
        unoSfx.stopMusic();
    },
};

export { unoEvents };
