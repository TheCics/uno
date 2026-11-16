/**
 * ============================================================================
 * ARQUIVO: bot.js
 * LOCAL: server/games/uno/bot.js
 * ============================================================================
 *
 * DESCRIÇÃO:
 * Estratégia de decisão dos bots utilizada nas partidas de Uno.
 *
 * RESPONSABILIDADES:
 * - Disponibilizar os nomes usados pelos bots do modo rápido.
 * - Identificar as cartas válidas para a jogada atual.
 * - Avaliar cartas de ação e situações de risco dos adversários.
 * - Escolher uma carta e, quando necessário, a cor desejada.
 * - Retornar a decisão ao servidor, sem executar a jogada diretamente.
 *
 * DATA DE CRIAÇÃO: 07/11/2026 (extração para o módulo independente).
 *
 * ATUALIZAÇÕES:
 * - 07/11/2026: Estratégia separada do coordenador principal do servidor.
 * - 07/11/2026: Formatação e cabeçalho documental padronizados.
 *
 * AUTOR: Viana-78
 *
 * ============================================================================
 */

const uno = require('./engine');
// Identidades visuais usadas no modo rápido do Uno.
const BOT_NAMES = ['Ana', 'Beto', 'Cris', 'Duda', 'Edu', 'Fê', 'Gabi', 'Hugo'];
const ACTIONS = ['skip', 'reverse', 'draw2'];

// Estratégia específica do Uno: escolhe uma carta válida e, quando necessário,
// a cor que o bot deseja definir. A execução da jogada continua no servidor.
function chooseMove(g, uid) {
    const hand = g.hands[uid];
    const top = g.discard[g.discard.length - 1];
    const opts = hand.map((card, index) => ({ card, index })).filter((o) => uno.canPlay(o.card, top, g.color));
    if (!opts.length)
        return null;
    const next = g.players[(((g.turn + g.dir) % g.players.length) + g.players.length) % g.players.length];
    const danger = g.hands[next].length <= 2; // próximo está quase ganhando: usa carta de ataque
    const score = ({ card }) => {
        if (card.c === 'wild')
            return card.v === 'wild4' ? (danger ? 8 : 0.5) : 1;
        if (ACTIONS.includes(card.v))
            return danger ? 9 : 4;
        return 5 + Math.random();
    };
    opts.sort((a, b) => score(b) - score(a));
    const pick = opts[0];
    let color;
    if (pick.card.c === 'wild') {
        const count = { red: 0, yellow: 0, green: 0, blue: 0 };
        hand.forEach((c, i) => {
            if (i !== pick.index && count[c.c] !== undefined)
                count[c.c]++;
        });
        color = Object.keys(count).sort((a, b) => count[b] - count[a])[0];
    }
    return { index: pick.index, color };
}

module.exports = { BOT_NAMES, chooseMove };
