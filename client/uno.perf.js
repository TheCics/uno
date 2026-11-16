/**
 * ============================================================================
 * ARQUIVO: uno.perf.js
 * LOCAL: client/src/features/games/uno/uno.perf.js
 * ============================================================================
 *
 * DESCRIÇÃO:
 * Modo "leve" das animações do Uno para telas grandes (PC).
 *
 * RESPONSABILIDADES:
 * - Dizer se a tela é grande o bastante para usar efeitos mais leves (mesmo limite do @media no uno.styles.css).
 * - O celular (e o modo celular do F12) continua exatamente como era; só telas acima do limite ganham a versão leve.
 * - A aparência é a mesma nas duas versões: muda o custo de desenhar (menos camadas, sem mistura de cores, aura menor).
 *
 * DATA DE CRIAÇÃO: 09/11/2026.
 *
 * AUTOR: Viana-78
 *
 * ============================================================================
 */

import { reduced } from '@bardotiao/ui';

// Mantenha igual ao "@media (min-width: 901px)" do bloco "Modo leve" em uno.styles.css.
const LITE_QUERY = '(min-width: 901px)';

const liteMode = () => typeof window !== 'undefined' && window.matchMedia(LITE_QUERY).matches;

// Escolha direta na mesa (PC): a cor do coringa/+4 sai clicando na pizza e o alvo do 7 clicando no leque ou no chip do jogador,
// sem abrir janela. No celular, e com as animações desligadas nas opções (não há pizza animada para clicar), continua o modal.
const directPickMode = () => liteMode() && !reduced();

export { liteMode, directPickMode, LITE_QUERY };
