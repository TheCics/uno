/**
 * ============================================================================
 * ARQUIVO: uno.actions.js
 * LOCAL: client/src/features/games/uno/uno.actions.js
 * ============================================================================
 *
 * DESCRIÇÃO:
 * Ações de tela da partida de Uno.
 *
 * RESPONSABILIDADES:
 * - Enviar a intenção de jogar uma carta, escolher a cor do coringa e comprar do monte.
 * - Não decidir a validade das jogadas: o cliente só envia a intenção e o servidor confirma.
 *
 * DATA DE CRIAÇÃO: 07/11/2026 (extraído de client/src/main.js).
 *
 * ATUALIZAÇÕES:
 * - 07/11/2026: Extraído de main.js (play, color, draw, leaveGame, again, closeResult e settings).
 *
 * - 07/11/2026 (subetapa 4.5): Ações enviadas pelo evento genérico game:action.
 * - 08/11/2026: Ações genéricas (settings, sair, de novo, fechar resultado) movidas para game.manager.js.
 * - 10/11/2026: Sons de feedback ao apertar UNO, denunciar e escolher o jogador da troca do 7.
 *
 * AUTOR: Viana-78
 *
 * ============================================================================
 */

import { emit } from './portal.js';
import { unoState, isJumpable } from './uno.state.js';
import { unoSfx } from './audio/uno.sfx.js';
import { animateUnoButtonPress } from './uno.animations.js';
import { liteMode } from './uno.perf.js';

// Botões da faixa de decisão (desafiar/aceitar, jogar/guardar) levam data-snd="option": tocam o som de opção.
const optionClick = (data) => { if (data?.snd === 'option') unoSfx.playOption(); };

const unoActions = {
    play({ i, snd }) {
        const game = unoState.game;
        const card = game.hand[Number(i)];
        if (game.awaiting)
            return;
        // PC: o clique na carta soma o som de clique ao da carta caindo no monte (jogada automática, snd="none", e botão da faixa não contam).
        const click = () => {
            if (snd === 'option')
                unoSfx.playOption();
            else if (snd !== 'none' && liteMode())
                unoSfx.playCardClick();
        };
        // Intromissão: vale fora da vez e durante a animação (coringa: a cor é escolhida depois que a carta pousa).
        if (isJumpable(game, card)) {
            click();
            emit('game:action', { type: 'jump-in', payload: { index: Number(i) } });
            return;
        }
        if (Date.now() < unoState.busyUntil)
            return;
        click();
        // Coringa e 7: a carta pousa primeiro; o servidor pede a cor/o alvo em seguida.
        emit('game:action', { type: 'play-card', payload: { index: Number(i) } });
    },

    color({ c }) {
        if (Date.now() < unoState.busyUntil)
            return;
        emit('game:action', { type: 'choose', payload: { color: c } });
    },

    target({ u }) {
        if (Date.now() < unoState.busyUntil)
            return;
        unoSfx.playTargetPicked(); // 7: feedback de que o monte (jogador) para a troca foi escolhido
        emit('game:action', { type: 'choose', payload: { target: u } });
    },

    keep(data) {
        if (Date.now() < unoState.busyUntil)
            return;
        optionClick(data);
        emit('game:action', { type: 'keep-card' });
    },

    callUno() {
        if (unoState.callPending || Date.now() < unoState.busyUntil)
            return;
        unoState.callPending = true;
        animateUnoButtonPress(document.querySelector('.unocorner .unobtn'));
        unoSfx.playUnoPress();
        emit('game:action', { type: 'call-uno' });
    },

    reportUno() {
        if (unoState.reportPending || Date.now() < unoState.busyUntil || Date.now() < unoState.reportLockUntil)
            return;
        unoState.reportPending = true;
        emit('game:action', { type: 'report-uno' });
    },

    challenge(data) {
        if (Date.now() < unoState.busyUntil)
            return;
        optionClick(data);
        emit('game:action', { type: 'challenge-wild4' });
    },

    draw(data) {
        if (Date.now() < unoState.busyUntil)
            return;
        optionClick(data);
        emit('game:action', { type: 'draw-card' });
    },
};

export { unoActions };
