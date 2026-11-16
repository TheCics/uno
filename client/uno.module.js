/**
 * ============================================================================
 * ARQUIVO: uno.module.js
 * LOCAL: client/src/features/games/uno/uno.module.js
 * ============================================================================
 *
 * DESCRIÇÃO:
 * Módulo de interface do Uno para o game.manager. Reúne tela, modais, ações, eventos
 * e campos de configuração do Uno atrás do mesmo formato que todo jogo deve seguir.
 *
 * DATA DE CRIAÇÃO: 08/11/2026 (Etapa 5).
 *
 * AUTOR: Viana-78
 *
 * ============================================================================
 */

import { unoState, resetUnoState } from './uno.state.js';
import { gameView, emptyTable } from './uno.view.js';
import { UNO_MODES, quickPreset, targetModal, colorModal, resultModal, unoConfigFields, unoModeSelector, readUnoConfig, unoRuleText } from './uno.components.js';
import { unoActions } from './uno.actions.js';
import { unoEvents } from './uno.events.js';
import { directPickMode } from './uno.perf.js';
import { stopUnoAnimations } from './uno.animations.js';
import { unoSfx } from './audio/uno.sfx.js';

const unoModule = {
    id: 'uno',
    // Ao sair da sala (ou a sala fechar) a trilha precisa parar junto com o estado da partida.
    reset() {
        stopUnoAnimations();
        resetUnoState();
        unoSfx.stopMusic();
    },
    hasGame: () => Boolean(unoState.game),
    clearResult() {
        unoState.result = null;
    },
    screen: gameView,
    emptyScreen: emptyTable,
    modal() {
        const game = unoState.game;
        // Cor/alvo só são pedidos depois que a animação da carta no monte termina.
        // PC: sem janela; a cor sai clicando na pizza que surge da carta e o alvo do 7, clicando no leque/chip do jogador.
        // Se a pizza não pôde ser mostrada (pickFailedN), a cor volta a ser pedida no modal.
        if (game?.awaiting && Date.now() >= unoState.busyUntil - 20) {
            const direct = directPickMode() && (game.awaiting.kind === 'target' || unoState.pickFailedN !== game.last?.n);
            if (direct)
                return '';
            return game.awaiting.kind === 'target' ? targetModal() : colorModal();
        }
        if (unoState.result && !game)
            return resultModal();
        return '';
    },
    actions: unoActions,
    events: unoEvents,
    modeSelector: unoModeSelector,
    configFields: unoConfigFields,
    readConfig: readUnoConfig,
    ruleText: unoRuleText,
    // Jogo rápido do lobby (o portal só desenha o que o jogo declara aqui).
    quick: { modes: UNO_MODES, preset: quickPreset, configFields: unoConfigFields, readConfig: readUnoConfig },
};

export { unoModule };
