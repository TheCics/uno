/**
 * ============================================================================
 * ARQUIVO: uno.bot.js
 * LOCAL: packages/uno/server/uno.bot.js
 * ============================================================================
 *
 * DESCRIÇÃO:
 * Estratégia de decisão dos bots utilizada nas partidas de Uno.
 *
 * RESPONSABILIDADES:
 * - Disponibilizar os nomes usados pelos bots do modo rápido.
 * - Identificar as cartas válidas, avaliar ações e riscos e escolher carta e cor.
 * - Retornar a decisão ao servidor, sem executar a jogada diretamente.
 *
 * DATA DE CRIAÇÃO: 07/11/2026 (extração para o módulo independente).
 *
 * ATUALIZAÇÕES:
 * - 07/11/2026: Movido de games/uno/bot.js para bots/uno/uno.bot.js sem alteração da estratégia.
 *
 * AUTOR: Viana-78
 *
 * ============================================================================
 */

const { canPlay, canStack } = require('./uno.rules');
// Identidades visuais usadas no modo rápido do Uno.
const BOT_NAMES = ['Ana', 'Beto', 'Cris', 'Duda', 'Edu', 'Fê', 'Gabi', 'Hugo'];
const ACTIONS = ['skip', 'reverse', 'draw2'];

// Estratégia específica do Uno: escolhe uma carta válida e, quando necessário,
// a cor que o bot deseja definir. A execução da jogada continua no servidor.
function chooseMove(g, uid) {
    const hand = g.hands[uid];
    const top = g.discard[g.discard.length - 1];
    let opts = hand.map((card, index) => ({ card, index })).filter((o) => (g.pending ? canStack(g, o.card) : canPlay(o.card, top, g.color)));
    if (g.drawn && g.drawn.uid === uid)
        opts = opts.filter((o) => o.index === g.drawn.index);
    if (!opts.length)
        return null;
    const next = g.players[(((g.turn + g.dir) % g.players.length) + g.players.length) % g.players.length];
    const danger = g.hands[next].length <= 2; // próximo está quase ganhando: usa carta de ataque
    // Alvo da troca do 7: quem tem menos cartas.
    const others = g.players.filter((id) => id !== uid).sort((a, b) => g.hands[a].length - g.hands[b].length);
    const swapGood = g.opts.swapSeven && g.hands[others[0]].length < hand.length - 1;
    const score = ({ card }) => {
        if (card.v === '7' && g.opts.swapSeven)
            return swapGood ? 9.5 : 2;
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
    const target = pick.card.v === '7' && g.opts.swapSeven ? others[0] : undefined;
    return { index: pick.index, color, target };
}

// Cor preferida para um coringa jogado por intromissão.
function pickColor(g, uid, skipIndex) {
    const count = { red: 0, yellow: 0, green: 0, blue: 0 };
    g.hands[uid].forEach((c, i) => {
        if (i !== skipIndex && count[c.c] !== undefined)
            count[c.c]++;
    });
    return Object.keys(count).sort((a, b) => count[b] - count[a])[0];
}

// Esquecimento "humano" do UNO: em algumas jogadas o bot não grita (determinístico por contador de jogadas).
const forgetsUno = (g) => (g.moves || 0) % 6 === 5;

module.exports = { BOT_NAMES, chooseMove, pickColor, forgetsUno };
