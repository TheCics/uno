/**
 * ============================================================================
 * ARQUIVO: uno.deck.js
 * LOCAL: server/games/uno/uno.deck.js
 * ============================================================================
 *
 * DESCRIÇÃO:
 * Baralho do Uno: cores, construção das 108 cartas e embaralhamento.
 *
 * RESPONSABILIDADES:
 * - Definir as cores válidas do jogo.
 * - Construir o baralho completo de 108 cartas.
 * - Embaralhar listas de cartas.
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

const COLORS = ['red', 'yellow', 'green', 'blue'];

function buildDeck() {
    const d = [];
    for (const c of COLORS) {
        d.push({ c, v: '0' });
        for (let n = 1; n <= 9; n++)
            d.push({ c, v: String(n) }, { c, v: String(n) });
        for (const v of ['skip', 'reverse', 'draw2'])
            d.push({ c, v }, { c, v });
    }
    for (let i = 0; i < 4; i++)
        d.push({ c: 'wild', v: 'wild' }, { c: 'wild', v: 'wild4' });
    return d; // 108 cartas
}

function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

module.exports = { COLORS, buildDeck, shuffle };
