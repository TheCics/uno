/**
 * ============================================================================
 * ARQUIVO: uno.cards.js
 * LOCAL: client/src/features/games/uno/uno.cards.js
 * ============================================================================
 *
 * DESCRIÇÃO:
 * Desenho das cartas do Uno (HTML/CSS puro) e helpers visuais.
 *
 * RESPONSABILIDADES:
 * - Definir as cores e os nomes de cor das cartas.
 * - Gerar o HTML da frente (cardFace) e do verso (cardBack) de uma carta.
 * - Indicar visualmente se uma carta parece jogável (canPlay). O servidor continua sendo a autoridade sobre a jogada.
 *
 * DATA DE CRIAÇÃO: 07/11/2026 (extraído de client/src/cards.js).
 *
 * ATUALIZAÇÕES:
 * - 07/11/2026: Movido de cards.js; esc e avatar foram para shared/ por serem usados fora do Uno.
 *
 * AUTOR: Viana-78
 *
 * ============================================================================
 */

const COLORS = {
    red: '#d32f2f',
    yellow: '#f2b705',
    green: '#2f9e44',
    blue: '#1d6fd1',
    wild: '#161616',
};

const COLOR_NAMES = {
    red: 'Vermelho',
    yellow: 'Amarelo',
    green: 'Verde',
    blue: 'Azul',
};

const SYMBOLS = {
    skip: '⊘',
    reverse: '⇄',
    draw2: '+2',
    wild: '★',
    wild4: '+4',
};

function sym(value) {
    return SYMBOLS[value] || value;
}

function corner(value) {
    return value === 'wild' ? 'W' : sym(value);
}

// Só indica jogadas possíveis na interface; a validação definitiva é do servidor.
function canPlay(card, top, color) {
    return card.c === 'wild' || card.c === color || card.v === top.v;
}

// Carta com a frente virada para cima.
function cardFace(card, { cls = '', attrs = '', style = '' } = {}) {
    return `
        <div class="uc ${card.c} ${cls}" style="${style}" ${attrs}>
            <i class="corner tl">${corner(card.v)}</i><div class="oval"><span class="big">${sym(card.v)}</span></div><i class="corner br">${corner(card.v)}</i>
        </div>`;
}

// Carta com o verso para cima (usada na mão dos oponentes e no monte).
function cardBack({ cls = '', attrs = '', style = '' } = {}) {
    return `<div class="ub ${cls}" style="${style}" ${attrs}><span>UNO</span></div>`;
}

export { COLORS, COLOR_NAMES, sym, canPlay, cardFace, cardBack };
