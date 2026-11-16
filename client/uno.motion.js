/**
 * ============================================================================
 * ARQUIVO: uno.motion.js
 * LOCAL: client/src/features/games/uno/uno.motion.js
 * ============================================================================
 *
 * DESCRIÇÃO:
 * Movimento contínuo da mesa do Uno que precisa sobreviver aos redesenhos: giro das setas de sentido
 * e preenchimento da barra de intromissão.
 *
 * RESPONSABILIDADES:
 * - Girar as setas da mesa (.dirring, PC) e a setinha do celular (.dir) a partir do relógio, no sentido do jogo.
 * - Encher a barra amarela da janela de intromissão (.jbar i) conforme o tempo passa.
 * - Não usar animação CSS: o global.css desliga `animation` (opção "Animações" desligada ou movimento reduzido)
 *   e, com ela desligada, a barra aparecia vazia e as setas ficavam paradas. Aqui o valor é calculado a cada quadro
 *   e também gravado no HTML no momento do desenho (sem "pulo" quando a mesa é redesenhada).
 *
 * DATA DE CRIAÇÃO: 09/11/2026.
 *
 * AUTOR: Viana-78
 *
 * ============================================================================
 */

import { reduced } from '@bardotiao/ui';
import { unoState } from './uno.state.js';

const RING_MS = 16000; // uma volta da seta da mesa
const DIR_MS = 6000; // uma volta da setinha do celular

// Ângulo atual (graus) para um giro de `period` ms: positivo = horário, negativo = anti-horário. Parado com movimento reduzido.
const spinDeg = (dir, period) => (reduced() ? 0 : ((Date.now() % period) / period) * 360 * (dir === -1 ? -1 : 1));

// Fração (0 a 1) já decorrida da janela de intromissão.
function jumpProgress() {
    const span = Math.max(1, unoState.jumpEnd - unoState.jumpStart);
    return Math.min(1, Math.max(0, (Date.now() - unoState.jumpStart) / span));
}

let raf = 0;

function frame() {
    raf = 0;
    if (!unoState.game)
        return;
    document.querySelectorAll('[data-spin]').forEach((el) => {
        el.style.transform = `${el.dataset.base || ''} rotate(${spinDeg(Number(el.dataset.dir), Number(el.dataset.spin)).toFixed(2)}deg)`.trim();
    });
    const bar = document.querySelector('.jbar i');
    if (bar)
        bar.style.transform = `scaleX(${jumpProgress().toFixed(3)})`;
    raf = requestAnimationFrame(frame);
}

// Idempotente: pode ser chamado a cada vista nova; o laço para sozinho quando a partida acaba.
function startMotion() {
    if (!raf)
        raf = requestAnimationFrame(frame);
}

export { RING_MS, DIR_MS, spinDeg, jumpProgress, startMotion };
