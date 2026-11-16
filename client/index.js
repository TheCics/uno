/**
 * ============================================================================
 * ARQUIVO: index.js
 * LOCAL: packages/uno/client/index.js
 * ============================================================================
 *
 * DESCRIÇÃO:
 * Entrada do Uno para o portal: `register(host)` guarda o host e devolve o módulo de interface
 * no formato que o game.manager do portal espera.
 *
 * DATA DE CRIAÇÃO: 11/11/2026.
 *
 * AUTOR: Viana-78
 *
 * ============================================================================
 */

import './uno.styles.css';
import { bindHost } from './portal.js';
import { unoModule } from './uno.module.js';

function register(host) {
    bindHost(host);
    return unoModule;
}

export { register, unoModule };
