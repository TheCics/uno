/**
 * ============================================================================
 * ARQUIVO: uno.engine.js
 * LOCAL: server/games/uno/uno.engine.js
 * ============================================================================
 *
 * DESCRIÇÃO:
 * Engine do Uno que cumpre o contrato universal (game.contract).
 *
 * RESPONSABILIDADES:
 * - Expor metadados, esquema de configuração, validação de jogadores e partida.
 * - Interpretar os comandos do Uno: 'play-card' { index, color?, target? }, 'draw-card',
 * 'jump-in' { index } e 'challenge-wild4'.
 * - Devolver transições sem alterar o estado recebido (clona antes de aplicar).
 * - Fornecer visão por jogador e a ação do bot (capacidade 'bots').
 * - NÃO conhecer socket, sala, Firebase nem outras engines.
 *
 * DATA DE CRIAÇÃO: 07/11/2026 (subetapa 4.4, substitui a interface newGame/play/draw/view).
 *
 * AUTOR: Viana-78
 *
 * ============================================================================
 */

const { ok, fail, transition, ERROR_CODES } = require('@bardotiao/game-contract');
const { normalizeBySchema } = require('@bardotiao/game-contract');
const { newGame } = require('./uno.state');
const { play, choose, autoTurn, draw, jumpIn, challenge, keep, callUno, reportUno } = require('./uno.actions');
const { view } = require('./uno.view');
const { canJumpOn, isBlockedSkip, canStack } = require('./uno.rules');
const { JUMP_MS } = require('./uno.validation');
const bot = require('./uno.bot');

const TURN_MS = 12000; // tempo para jogar; esgotado, o servidor joga pelo jogador
const CHOICE_MS = 10000; // tempo para escolher cor/alvo; esgotado, o servidor escolhe
const TURN_ACTIONS = ['play-card', 'jump-in', 'draw-card', 'keep-card', 'choose', 'auto-turn', 'challenge-wild4'];
// Duração estimada da animação de distribuição das cartas (espelha dealMs do cliente).
const dealMs = (state) => {
    const total = state.players.length * state.opts.initialCards;
    return Math.min(170, Math.max(90, 4760 / total)) * (total - 1) + 3570;
};

const AUTO_DRAW_MS = 2000; // +2 acumulado que ninguém pode empilhar: o número fica na mesa por 2 s e a compra é automática

const UNO_REPORT_ANIMATION_MS = 4440; // balão (2,02 s), respiros, +2 mágico e compra das duas cartas
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 10;

const CONFIG_SCHEMA = {
    initialCards: { type: 'integer', min: 3, max: 10, default: 7 },
    drawUntilPlay: { type: 'boolean', default: false },
    stackDraw2: { type: 'boolean', default: false },
    stackWild4: { type: 'boolean', default: false },
    challengeWild4: { type: 'boolean', default: false },
    jumpIn: { type: 'boolean', default: false },
    swapSeven: { type: 'boolean', default: false },
    rotateZero: { type: 'boolean', default: false },
    unoCall: { type: 'boolean', default: false },
    autoPlayDrawn: { type: 'boolean', default: false },
    choosePlayDrawn: { type: 'boolean', default: false },
};

const result = (state) => (state.winner ? { winners: [state.winner] } : null);

// Tempo (ms) que o cliente leva animando a última jogada (sem contar a janela de intromissão).
function animMs(state) {
    const last = state.last;
    const draws = (n) => 520 + Math.min(150 * (Math.max(n, 1) - 1), 1600);

    if (!last) {
        return dealMs(state); // início da rodada: espera a distribuição das cartas
    }

    const event = last.event;

    if (event && event.kind === 'uno-report') {
        return UNO_REPORT_ANIMATION_MS;
    }

    if (event && event.kind === 'challenge') {
        // +4 sobre +4 com desafio ganho: um +4 surge sobre cada um dos dois que pagam, e só depois vem a compra (520 + 120 + 450 + 380 + 320 + 220).
        const pairPlus = event.success && event.draws.length > 1 ? 2010 : 0;

        return 1500 + 3300 + 1400 + pairPlus + Math.max(...event.draws.map((d) => draws(d.n))) + 500;
    }

    if (last.type === 'draw') {
        return draws(last.drawn) + 500 + (last.pendingTaken ? 450 + 920 : 0);
    }

    const auto = last.autoDrawn ? draws(last.autoDrawn) : 0;
    const play = last.resolved ? 0 : 650;

    // Espelha o cliente: 0/7 grande parado 1 s (520 + 1000 + 380); pizza de cores do coringa já escolhido (520 + 1100 + 380).
    // 7/pizza que esperam a escolha ficam parados (520) e o modal entra logo depois (80); com a escolha feita voltam para a carta.
    const card = last.card;
    const isWild = Boolean(card) && card.v === 'wild';
    const stays = !last.resolved && Boolean(card) && ((isWild && last.awaiting === 'color') || (card.v === '7' && last.awaiting === 'target'));
    const numFx = !last.resolved && card && (card.v === '7' && (last.awaiting === 'target' || (last.event && last.event.kind === 'swap')) || card.v === '0' && last.event && last.event.kind === 'rotate') ? 1900 : 0;
    const wheel = isWild && !last.awaiting && !last.resolved ? 2000 : 0;
    const isWild4 = Boolean(card) && card.v === 'wild4';
    const back = last.resolved && card ? (isWild || isWild4 ? 680 : (card.v === '7' && last.event && last.event.kind === 'swap' ? 380 : 0)) : 0;

    if (last.awaiting) {
        // +4 esperando a cor: no PC quem escolhe vê o +4, ele some e a pizza surge da carta (520 + 500 + 380 + 520 + 80); no celular vai direto ao modal.
        return auto + play + (isWild4 ? 2000 : stays ? 600 : 500);
    }

    let extra = 0;

    if (event && event.kind === 'swap') {
        extra = 1600;
    }
    else if (event && event.kind === 'rotate') {
        extra = 1600;
    }

    extra += numFx && extra ? numFx : 0;
    extra += wheel + back;

    // Bloqueio: símbolo sobe da carta (520 + 120), voa até o leque (450), zoom (380), fica sobre o leque com ele cinza (900),
    // some (220) e ainda há um respiro (800) antes de o próximo jogar. Espelha o cliente (BLOCK_MS + T.blockBreath).
    if (last.penalty === 'skip') {
        return auto + play + 520 + 120 + 450 + 380 + 900 + 220 + 800;
    }

    // +2/+4 acumulado (sem compra imediata) e inversão também têm o símbolo surgindo no centro (espelha o cliente).
    const symbol = !last.penalty && card && (card.v === 'draw2' || card.v === 'wild4') ? 520 : card && card.v === 'reverse' ? 1240 : 0;

    return auto + play + extra + symbol + (last.penalty ? 320 + 450 + 920 + draws(last.drawn) + 500 : 500);
}

const unoEngine = {
    id: 'uno',
    version: 1,
    capabilities: ['bots'],

    getMetadata() {
        return {
            id: 'uno',
            name: 'Uno',
            description: 'Cartas, estratégia e diversão com os amigos.',
            icon: '🃏',
            minPlayers: MIN_PLAYERS,
            maxPlayers: MAX_PLAYERS,
            botNames: bot.BOT_NAMES,
        };
    },

    getConfigSchema() {
        return CONFIG_SCHEMA;
    },

    normalizeConfig(config) {
        return ok({ config: normalizeBySchema(CONFIG_SCHEMA, config) });
    },

    validatePlayers(players) {
        if (!Array.isArray(players) || players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
            return fail(ERROR_CODES.INVALID_PLAYERS, `Use de ${MIN_PLAYERS} a ${MAX_PLAYERS} jogadores.`);
        }

        return ok();
    },

    createMatch({ config, players }) {
        const state = newGame(players.map((player) => player.id), config);

        return transition({ state, events: [{ type: 'match-created' }] });
    },

    startMatch({ state }) {
        state.turnEnd = Date.now() + dealMs(state) + TURN_MS;

        return transition({ state, events: [{ type: 'match-started' }] });
    },

    handleAction({ state }, command) {
        const { playerId, type } = command || {};
        const payload = command && command.payload ? command.payload : {};
        if (state.actionLockUntil && Date.now() < state.actionLockUntil)
            return fail(ERROR_CODES.INVALID_ACTION, 'Aguarde a animação da denúncia terminar.');
        const next = structuredClone(state);
        let outcome;

        if (type === 'play-card') {
            outcome = Number.isInteger(payload.index)
                ? play(next, playerId, payload.index, payload.color, payload.target)
                : { error: 'Carta inválida' };
        }
        else if (type === 'draw-card') {
            outcome = draw(next, playerId);
        }
        else if (type === 'jump-in') {
            outcome = Number.isInteger(payload.index) ? jumpIn(next, playerId, payload.index, payload.color, payload.target) : { error: 'Carta inválida' };
        }
        else if (type === 'keep-card') {
            outcome = keep(next, playerId) || { ok: true };
        }
        else if (type === 'call-uno') {
            outcome = callUno(next, playerId);
        }
        else if (type === 'report-uno') {
            outcome = reportUno(next, playerId);
        }
        else if (type === 'challenge-wild4') {
            outcome = challenge(next, playerId);
        }
        else if (type === 'choose') {
            outcome = choose(next, playerId, payload.color, payload.target);
        }
        else if (type === 'auto-turn') {
            outcome = autoTurn(next, playerId);
        }
        else {
            return fail(ERROR_CODES.UNKNOWN_ACTION, 'Ação desconhecida.');
        }

        if (outcome.error) {
            const code = state.winner ? ERROR_CODES.MATCH_FINISHED : ERROR_CODES.INVALID_ACTION;

            return fail(code, outcome.error);
        }

        // A denúncia é aplicada no estado imediatamente, mas todas as ações ficam bloqueadas
        // enquanto o cliente apresenta o balão, o +2 e o voo das duas cartas.
        if (type === 'report-uno') {
            const now = Date.now();
            next.actionLockUntil = now + UNO_REPORT_ANIMATION_MS;
            next.turnEnd = Math.max(next.turnEnd || 0, now) + UNO_REPORT_ANIMATION_MS;
        }

        // 7 com troca de mãos, coringa/7 com a escolha (cor/alvo) recém-feita, bloqueio e +2/+4 com compra imediata: a janela de
        // intromissão só abre depois da animação (as mãos já mudaram de dono / a pizza voltou para a carta / o símbolo já sumiu).
        // Antes a janela corria junto com a animação e fechava (2 s) com o bloqueio ainda voando; agora a janela é o respiro
        // (cooldown) entre a animação e a vez do próximo.
        const last = next.last;
        if (!next.winner && next.opts.jumpIn && next.jumpUntil && last && last.type === 'play' && ((last.event && last.event.kind === 'swap') || last.resolved || last.penalty)) {
            next.jumpFrom = Date.now() + animMs(next);
            next.jumpUntil = next.jumpFrom + JUMP_MS;
        }

        // +2 acumulado e o próximo jogador não tem como empilhar: nada a decidir, a compra é automática depois de 2 s.
        next.autoDraw = false;
        if (!next.winner && next.pending && next.pending.v === 'draw2' && !next.awaiting) {
            const owner = next.players[next.turn];
            next.autoDraw = !next.hands[owner].some((card) => canStack(next, card));
        }

        // Cada ação que muda a vez reinicia o relógio (depois do tempo das animações no cliente).
        if (TURN_ACTIONS.includes(type) && !next.winner) {
            if (next.autoDraw) {
                const windowLeft = next.jumpUntil ? next.jumpUntil - Date.now() + 100 : 0; // a compra espera a janela de intromissão fechar
                next.turnEnd = Date.now() + Math.max(animMs(next) + AUTO_DRAW_MS, windowLeft);
            }
            else {
                next.turnEnd = Date.now() + this.getPaceMs({ state: next }) + (next.awaiting ? CHOICE_MS : TURN_MS);
            }
        }

        return transition({
            state: next,
            events: [{ type: { 'play-card': 'card-played', 'jump-in': 'card-played', 'challenge-wild4': 'wild4-challenged', 'call-uno': 'uno-called', 'report-uno': 'uno-reported', 'keep-card': 'card-kept', choose: 'card-played', 'auto-turn': 'card-played' }[type] || 'card-drawn', payload: { playerId } }],
            result: result(next),
        });
    },

    // Espectador: ninguém é o dono da mão, então a mão vem vazia.
    getPublicState({ state }) {
        return view(state, null);
    },

    getPlayerView({ state }, playerId) {
        return view(state, playerId);
    },

    isFinished({ state }) {
        return Boolean(state.winner);
    },

    getResult({ state }) {
        return result(state);
    },

    // Tempo (ms) que o cliente leva animando a última jogada; o bot espera para a vez não "atropelar".
    // Espelha unoAnimationMs do cliente (um pouco acima, para não cortar a animação).
    getPaceMs({ state }) {
        const jumpLeft = state.opts.jumpIn && state.jumpUntil ? state.jumpUntil - Date.now() : 0;

        // O próximo espera a janela de intromissão fechar E a animação terminar (antes só valia a janela e a vez
        // chegava com a animação ainda tocando, p. ex. no bloqueio).
        const reportLeft = state.actionLockUntil ? state.actionLockUntil - Date.now() : 0;
        return Math.max(animMs(state), jumpLeft > 0 ? jumpLeft + 100 : 0, reportLeft > 0 ? reportLeft : 0);
    },

    // Relógio do jogador da vez (ou de quem precisa escolher cor/alvo). O serviço de partidas só agenda para humanos.
    getTimeoutAction({ state }) {
        if (state.winner || !state.turnEnd) {
            return null;
        }

        const playerId = state.awaiting ? state.awaiting.uid : state.players[state.turn];

        return { playerId, type: 'auto-turn', payload: {}, delay: Math.max(0, state.turnEnd - Date.now()) };
    },

    // Quando o bot pode tentar reagir: a janela de intromissão pode abrir depois da animação (jumpFrom).
    getReactionDelayMs({ state }) {
        const now = Date.now();
        const jumpLeft = state.jumpFrom ? state.jumpFrom - now : 0;
        const graceLeft = state.unoGraceUid ? state.unoGraceUntil - now : 0;
        const reportLeft = state.actionLockUntil ? state.actionLockUntil - now : 0;
        return Math.max(0, jumpLeft, graceLeft, reportLeft);
    },

    // Depois da última carta, o cliente anima a jogada e mostra as mãos de todos antes de fechar a rodada.
    getFinishDelayMs({ state }) {
        return state.winner ? 700 + 4300 : 0;
    },

    // null = não é a vez deste jogador.
    createBotAction({ state }, playerId) {
        if (state.winner || state.players[state.turn] !== playerId) {
            return null;
        }

        const hand = state.hands[playerId];

        // Grita UNO antes de ficar com 1 carta (às vezes esquece, e aí pode ser denunciado).
        if (state.opts.unoCall && hand.length === 2 && !state.uno[playerId] && !bot.forgetsUno(state)) {
            return { playerId, type: 'call-uno', payload: {} };
        }

        // Desafia o +4 de vez em quando.
        if (state.challenge && Math.random() < 0.4) {
            return { playerId, type: 'challenge-wild4', payload: {} };
        }

        const choice = bot.chooseMove(state, playerId);

        if (!choice && state.drawn && state.drawn.uid === playerId) {
            return { playerId, type: 'keep-card', payload: {} };
        }

        return choice
            ? { playerId, type: 'play-card', payload: { index: choice.index, color: choice.color, target: choice.target } }
            : { playerId, type: 'draw-card', payload: {} };
    },
};

// Reações fora da vez (o núcleo tenta uma vez por jogada, durante a janela de intromissão).
unoEngine.createBotReaction = function createBotReaction({ state }, playerId) {
    if (state.winner || !state.hands[playerId]) {
        return null;
    }

    if (state.unoVuln && state.unoVuln !== playerId && Math.random() < 0.7) {
        return { playerId, type: 'report-uno', payload: {} };
    }

    if (state.opts.jumpIn && state.jumpUntil && Date.now() >= (state.jumpFrom || 0) && Date.now() < state.jumpUntil && Math.random() < 0.55) {
        const top = state.discard[state.discard.length - 1];
        const hand = state.hands[playerId];
        const index = hand.findIndex((card) => card.c === top.c && card.v === top.v);

        // O próximo da vez não se intromete: joga normal, na hora dele.
        if (index >= 0 && state.players[state.turn] !== playerId && canJumpOn(state, hand[index]) && !isBlockedSkip(state, playerId, hand[index])) {
            // 7 com troca de mãos: o bot já escolhe com quem trocar (quem tem menos cartas).
            const others = state.players.filter((id) => id !== playerId).sort((a, b) => state.hands[a].length - state.hands[b].length);

            return {
                playerId,
                type: 'jump-in',
                payload: {
                    index,
                    color: hand[index].c === 'wild' ? bot.pickColor(state, playerId, index) : undefined,
                    target: hand[index].v === '7' && state.opts.swapSeven ? others[0] : undefined,
                },
            };
        }
    }

    return null;
};

module.exports = unoEngine;
