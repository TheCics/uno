/**
 * ============================================================================
 * ARQUIVO: uno.symbols.js
 * LOCAL: client/src/features/games/uno/uno.symbols.js
 * ============================================================================
 *
 * DESCRIÇÃO:
 * Símbolos das cartas especiais (+N, bloqueio e inversão) usados nas animações.
 *
 * RESPONSABILIDADES:
 * - Montar o HTML do símbolo a partir de um único molde (tipo, texto e cor).
 * - Escolher a cor do símbolo: a da carta jogada (coringa/+4 = branco).
 * - Setas de sentido do jogo (dirRingHtml no PC, dirArrowHtml no celular): cor sólida e viradas para o sentido certo.
 * - Pizza de cores do coringa em vetor com volume, no mesmo estilo dos outros símbolos (cor lisa + lateral escura, sem contorno de desenho animado).
 *
 * DATA DE CRIAÇÃO: 09/11/2026.
 *
 * ATUALIZAÇÕES:
 * - 09/11/2026: Setas de sentido em cor sólida (sem halo/transparência), espelhadas no sentido anti-horário e giradas por uno.motion.js.
 *
 * AUTOR: Viana-78
 *
 * ============================================================================
 */

import { esc } from '@bardotiao/ui';
import { COLORS } from './uno.cards.js';
import { liteMode } from './uno.perf.js';
import { RING_MS, DIR_MS, spinDeg } from './uno.motion.js';

const BLOCK_SVG = '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="13" stroke-linecap="round"><circle cx="50" cy="50" r="38"/><path d="M23 77 77 23"/></svg>';
const REVERSE_SVG = '<svg viewBox="0 0 120 100" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"><path d="M18 36h70M70 16l20 20-20 20"/><path d="M102 66H32M50 46 30 66l20 20"/></svg>';

// Pizza de cores do coringa (vermelho, azul, verde, amarelo): mesma linguagem dos outros símbolos (+N, bloqueio, inversão):
// cor lisa com a lateral extrudada num tom 50% mais escuro (igual ao --sd do CSS), sem contorno preto nem brilho de desenho
// animado; só um fio claro separando as fatias e o brilho em volta (no CSS). A perspectiva já está desenhada (elipse).
const PIE = { cx: 50, cy: 33, rx: 44, ry: 28, depth: 8, gap: 1.4 };
const rad = (deg) => (deg * Math.PI) / 180;
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const tint = (hex, k, to = 0) => `rgb(${rgb(hex).map((v) => Math.round(v * k + to * (1 - k))).join(',')})`; // k<1 escurece (to=0) ou clareia (to=255)

function pieSlice(color, centerDeg, steps) {
    const { cx, cy, rx, ry, depth, gap } = PIE;
    const point = (deg) => `${(cx + rx * Math.cos(rad(deg))).toFixed(2)} ${(cy + ry * Math.sin(rad(deg))).toFixed(2)}`;
    const d = `M${cx} ${cy}L${point(centerDeg - 45)}A${rx} ${ry} 0 0 1 ${point(centerDeg + 45)}Z`;
    const hex = COLORS[color];
    // Lateral: o mesmo corte repetido de baixo para cima, todos no tom escuro da cor (extrusão lisa, sem dentes).
    const side = tint(hex, 0.5);
    const sides = Array.from({ length: steps }, (_, i) => `<path d="${d}" transform="translate(0 ${(((steps - i) * depth) / steps).toFixed(2)})" fill="${side}"/>`).join('');
    const ox = (Math.cos(rad(centerDeg)) * gap).toFixed(2);
    const oy = (Math.sin(rad(centerDeg)) * gap * (ry / rx)).toFixed(2);
    return `<g data-c="${color}" transform="translate(${ox} ${oy})">${sides}
        <path d="${d}" fill="url(#pie-${color})" stroke="rgba(255,255,255,.7)" stroke-width="1" stroke-linejoin="round"/></g>`;
}

const PIE_DEFS = `<defs>
    ${['green', 'yellow', 'red', 'blue'].map((c) => `<linearGradient id="pie-${c}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${tint(COLORS[c], 0.86, 255)}"/><stop offset="1" stop-color="${COLORS[c]}"/></linearGradient>`).join('')}
    <filter id="pie-blur" x="-20%" y="-40%" width="140%" height="180%"><feGaussianBlur stdDeviation="2.4"/></filter>
</defs>`;

// Camadas da lateral por fatia: 24 no celular (como era) e 12 no modo leve (PC), que desenha metade dos paths sem diferença visível.
const PIE_STEPS = { full: PIE.depth * 3, lite: PIE.depth * 1.5 };
const wheelCache = {};

// Ordem de desenho: a de trás (verde) primeiro, a da frente (vermelha) por último.
const wheelSvg = () => {
    const mode = liteMode() ? 'lite' : 'full';
    return (wheelCache[mode] ||= buildWheel(PIE_STEPS[mode]));
};
const buildWheel = (steps) => `<svg viewBox="0 0 100 80">${PIE_DEFS}
    <ellipse cx="${PIE.cx}" cy="${PIE.cy + PIE.depth + 4}" rx="${PIE.rx + 2}" ry="${PIE.ry - 2}" fill="#000" opacity=".32" filter="url(#pie-blur)"/>
    ${[['green', 270], ['blue', 180], ['yellow', 0], ['red', 90]].map(([c, deg]) => pieSlice(c, deg, steps)).join('')}</svg>`;

// Seta giratória da mesa (só no PC; no celular continua a setinha ↻/↺ da caixa de sentido).
// Duas setas curvas em volta do monte e do descarte, em cor sólida (opacidade 100%). O SVG é um círculo; o CSS o achata
// (scaleY) e o gira, então as setas andam numa elipse, como na perspectiva da mesa. A cor acompanha a cor atual do jogo.
// Sentido: no horário as pontas apontam para o horário; no anti-horário o desenho é espelhado (as pontas apontam para o
// anti-horário) e o giro também inverte, então a seta sempre anda para onde a ponta aponta.
// O giro é feito por uno.motion.js (relógio) e não por animação CSS; o ângulo já vai gravado no HTML para não "pular" a cada redesenho.
const RING_BASE = 'translate(-50%,-50%) scale(1,.46)';
function dirRingHtml(dir, color) {
    const r = 86;
    const at = (deg, k = r) => [100 + k * Math.cos(rad(deg)), 100 + k * Math.sin(rad(deg))];
    const arrow = (from, to) => {
        const [x0, y0] = at(from);
        const [x1, y1] = at(to);
        const [tx, ty] = [-Math.sin(rad(to)), Math.cos(rad(to))]; // tangente no fim da seta (sentido horário)
        const [nx, ny] = [Math.cos(rad(to)), Math.sin(rad(to))];
        const tip = [x1 + tx * 24, y1 + ty * 24];
        const a = [x1 + nx * 16, y1 + ny * 16];
        const b = [x1 - nx * 16, y1 - ny * 16];
        const arc = `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
        const head = `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${tip[0].toFixed(1)} ${tip[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}Z`;
        return `<path class="rl" d="${arc}"/><path class="rh" d="${head}"/>`;
    };
    const turn = dir === -1 ? -1 : 1;
    return `<div class="dirring ${turn === 1 ? 'cw' : 'ccw'}" data-spin="${RING_MS}" data-dir="${turn}" data-base="${RING_BASE}" style="--rc:${color};transform:${RING_BASE} rotate(${spinDeg(turn, RING_MS).toFixed(2)}deg)" aria-hidden="true">
        <svg viewBox="0 0 200 200" style="transform:scaleX(${turn})">${arrow(-70, 20)}${arrow(110, 200)}</svg></div>`;
}

// Setinha ↻/↺ do celular: gira no sentido do jogo (também por uno.motion.js).
const dirArrowHtml = (dir) => {
    const turn = dir === -1 ? -1 : 1;
    return `<span class="dir ${turn === 1 ? 'cw' : 'ccw'}" data-spin="${DIR_MS}" data-dir="${turn}" style="transform:rotate(${spinDeg(turn, DIR_MS).toFixed(2)}deg)">${turn === 1 ? '↻' : '↺'}</span>`;
};

// kind: 'plus' (texto +N), 'block', 'reverse', 'wheel' ou 'num' (0/7 grande). A cor entra como variável CSS (--sc).
function symbolHtml(kind, text, color) {
    const body = kind === 'block' ? BLOCK_SVG : kind === 'reverse' ? REVERSE_SVG : kind === 'wheel' ? wheelSvg() : `<b>${esc(text)}</b>`;
    return `<div class="fxsym ${kind}" style="--sc:${color}"><div class="tilt">${body}</div></div>`;
}

// Cor do símbolo = cor da carta jogada; coringas (+4) usam branco.
const specialColor = (card) => (!card || card.c === 'wild' ? '#ffffff' : COLORS[card.c]);

export { symbolHtml, specialColor, dirRingHtml, dirArrowHtml };
