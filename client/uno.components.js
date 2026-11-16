/**
 * ============================================================================
 * ARQUIVO: uno.components.js
 * LOCAL: client/src/features/games/uno/uno.components.js
 * ============================================================================
 *
 * DESCRIÇÃO:
 * Componentes visuais do Uno usados fora da mesa: fundo, modos, configurações e modais de cor e resultado.
 *
 * RESPONSABILIDADES:
 * - Montar o fundo decorativo com cartas usado nas telas de login e de menu.
 * - Descrever os modos do jogo rápido e o resumo de regras de uma sala.
 * - Montar e ler o formulário de configurações da sala (rounds, máximo, cartas iniciais, compra até jogar).
 * - Montar os modais de escolha de cor do coringa e de resultado.
 *
 * DATA DE CRIAÇÃO: 07/11/2026 (extraído de client/src/views.js).
 *
 * ATUALIZAÇÕES:
 * - 08/11/2026: clockHtml marca o segundo atual (data-sec) para o pulso da contagem não reiniciar em cada redesenho.
 * - 07/11/2026: Logotipo UNO removido; a marca da plataforma passou a ser shared/components/brand.js (Bar do Tião).
 * - 07/11/2026: Extraído de views.js (bgCards, MODES, ruleText, colorModal, resultModal e o formulário de configurações da roomView).
 * - 07/11/2026: Pendência: logotipo, fundo e formulário de configurações são importados por telas da plataforma; revisar quando houver um segundo jogo.
 *
 * AUTOR: Viana-78
 *
 * ============================================================================
 */

import { modalShell } from '@bardotiao/ui';
import { val } from '@bardotiao/ui';
import { COLORS, COLOR_NAMES, cardFace } from './uno.cards.js';
import { unoState, clockSeconds } from './uno.state.js';
import { esc } from '@bardotiao/ui';
import { authState } from './portal.js';
import { roomsState, nickOf } from './portal.js';
import { matchResultModal } from './portal.js';

const UNO_MODES = {
    quick: { name: 'Rápido', desc: 'Gritar UNO e jogar automaticamente a carta comprada.', icon: '⚡' },
    classic: { name: 'Clássico', desc: 'UNO, +2 sobre +2, +4 sobre +4 e jogar carta comprada.', icon: '🃏' },
    hard: { name: 'Difícil', desc: 'Comprar até jogar, desafios, Jump-in e escolher jogar ou guardar.', icon: '💀' },
    marginal: { name: 'Marginal', desc: 'Todas as regras especiais, incluindo troca com 7 e giro com 0.', icon: '🔥' },
    custom: { name: 'Personalizado', desc: 'Escolha livremente as regras e a quantidade de cartas iniciais.', icon: '⚙️' },
};

const QUICK_PRESETS = {
    quick: { initialCards: 7, drawUntilPlay: false, stackDraw2: false, stackWild4: false, challengeWild4: false, jumpIn: false, swapSeven: false, rotateZero: false, unoCall: true, autoPlayDrawn: true, choosePlayDrawn: false },
    classic: { initialCards: 7, drawUntilPlay: false, stackDraw2: true, stackWild4: true, challengeWild4: false, jumpIn: false, swapSeven: false, rotateZero: false, unoCall: true, autoPlayDrawn: true, choosePlayDrawn: false },
    hard: { initialCards: 7, drawUntilPlay: true, stackDraw2: true, stackWild4: true, challengeWild4: true, jumpIn: true, swapSeven: false, rotateZero: false, unoCall: true, autoPlayDrawn: false, choosePlayDrawn: true },
    marginal: { initialCards: 7, drawUntilPlay: true, stackDraw2: true, stackWild4: true, challengeWild4: true, jumpIn: true, swapSeven: true, rotateZero: true, unoCall: true, autoPlayDrawn: false, choosePlayDrawn: true },
    custom: { initialCards: 7, drawUntilPlay: false, stackDraw2: false, stackWild4: false, challengeWild4: false, jumpIn: false, swapSeven: false, rotateZero: false, unoCall: true, autoPlayDrawn: false, choosePlayDrawn: false },
};

function quickPreset(mode) { return { ...(QUICK_PRESETS[mode] || QUICK_PRESETS.classic) }; }

function unoModeSelector(settings, disabled = '') {
    const selected = settings.mode || 'classic';
    const choices = Object.entries(UNO_MODES).map(([key, mode]) => `
        <button type="button" class="room-mode-card ${selected === key ? 'sel' : ''}" data-act="selectRoomMode" data-v="${key}" ${disabled} aria-pressed="${selected === key}">
            <span class="room-mode-icon">${mode.icon}</span>
            <span class="room-mode-copy"><b>${mode.name}</b><small>${mode.desc}</small></span>
            <span class="room-mode-check">${selected === key ? '✓' : ''}</span>
        </button>`).join('');
    return `<div class="room-modes"><p class="mode-caption">Modo de jogo</p><div class="room-mode-grid">${choices}</div></div>`;
}

// [cor, valor, esquerda %, topo %, rotação em graus]
const BACKGROUND_CARDS = [
    ['red', '7', 8, 14, -18],
    ['blue', 'reverse', 84, 12, 14],
    ['green', 'skip', 12, 68, 10],
    ['yellow', 'draw2', 80, 64, -12],
    ['wild', 'wild4', 46, 84, 6],
];

function unoBackground() {
    const cards = BACKGROUND_CARDS.map(([c, v, x, y, r]) => cardFace(
        { c, v },
        { cls: 'bgc', style: `left:${x}%;top:${y}%;--r:${r}deg` },
    )).join('');
    return `<div class="bgcards" aria-hidden="true">${cards}</div>`;
}

// [chave da config, rótulo no lobby]
const RULES = [
    ['stackDraw2', '+2 sobre +2'],
    ['stackWild4', '+4 sobre +4'],
    ['challengeWild4', 'Desafiar +4'],
    ['jumpIn', 'Jump-in'],
    ['swapSeven', '7 troca a mão'],
    ['rotateZero', '0 gira as mãos'],
    ['unoCall', 'Gritar UNO'],
    ['autoPlayDrawn', 'Jogar carta comprada'],
    ['choosePlayDrawn', 'Escolher jogar/guardar'],
];

function unoRuleText(settings) {
    const rounds = `${settings.rounds} round${settings.rounds > 1 ? 's' : ''}`;
    const config = settings.config || {};
    const draw = config.drawUntilPlay ? ' · compra até jogar' : '';
    const active = RULES.filter(([key]) => config[key]).map(([, label]) => label);
    const extra = active.length ? ` · ${active.join(', ')}` : '';
    return `${rounds} · ${config.initialCards} cartas${draw}${extra}`;
}

// Campos de configuração exclusivos do Uno (o formulário genérico da sala fica em rooms.view).
function unoConfigFields(settings, disabled) {
    return `
        <label>Cartas iniciais <input id="s-cards" data-sync="1" data-change type="number" min="3" max="10" value="${settings.config?.initialCards}" ${disabled}></label>
        <label class="chk"><input id="s-draw" data-sync="1" data-change type="checkbox" ${settings.config?.drawUntilPlay ? 'checked' : ''} ${disabled}> Comprar até poder jogar</label>
        ${RULES.map(([key, label]) => `<label class="chk"><input id="s-${key}" data-sync="1" data-change type="checkbox" ${settings.config?.[key] ? 'checked' : ''} ${disabled}> ${label}</label>`).join('')}`;
}

function readUnoConfig() {
    return {
        initialCards: val('s-cards'),
        drawUntilPlay: !!document.getElementById('s-draw')?.checked,
        ...Object.fromEntries(RULES.map(([key]) => [key, !!document.getElementById(`s-${key}`)?.checked])),
    };
}

// Contagem regressiva (aparece só nos últimos 7 s); o relógio do cliente atualiza o texto e o pulso sem redesenhar.
function clockHtml(extra = '') {
    const seconds = clockSeconds();
    return `<div class="uclock ${extra}${seconds ? ' tick' : ''}" ${seconds ? `data-sec="${seconds}"` : 'hidden'}>${seconds || ''}</div>`;
}

// Só aparece depois da animação da carta no monte e não tem como cancelar.
function colorModal() {
    const buttons = ['red', 'yellow', 'green', 'blue'].map((color) => `
        <button class="colorbtn" data-act="color" data-c="${color}" style="--cc:${COLORS[color]}"><span>${COLOR_NAMES[color]}</span></button>`).join('');
    return modalShell('Escolha a cor', `<div class="colors">${buttons}</div>${clockHtml('inmodal')}`, { close: false });
}

// 7: escolher com quem trocar a mão (depois que o 7 pousou no monte).
function targetModal() {
    const others = unoState.game.players.filter((player) => player.uid !== authState.uid);
    const buttons = others.map((player) => `
        <button class="btn" data-act="target" data-u="${esc(player.uid)}">${esc(nickOf(player.uid))} (${player.count})</button>`).join('');
    return modalShell('Trocar a mão com quem?', `<div class="colors">${buttons}</div>${clockHtml('inmodal')}`, { close: false });
}

function resultModal() {
    return matchResultModal(unoState.result);
}

export {
    UNO_MODES,
    unoBackground,
    unoRuleText,
    unoConfigFields,
    quickPreset,
    unoModeSelector,
    readUnoConfig,
    colorModal,
    targetModal,
    clockHtml,
    resultModal,
};
