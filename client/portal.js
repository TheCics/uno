/**
 * ============================================================================
 * ARQUIVO: portal.js
 * LOCAL: packages/uno/client/portal.js
 * ============================================================================
 *
 * DESCRIÇÃO:
 * Única porta do Uno para o portal. Tudo que o jogo usa do Bar do Tião passa por aqui:
 * esta lista É o contrato do `host` (o que o portal precisa entregar em register(host)).
 *
 * CONTRATO DO HOST (entregue pelo portal em register(host)):
 *   host.render()              redesenha a tela e o modal
 *   host.emit(evento, dados, cb)  fala com o servidor (socket)
 *   host.auth                  { uid }  quem está jogando (objeto vivo)
 *   host.rooms                 { room, chat, chatOpen }  sala atual (objeto vivo)
 *   host.nickOf(uid)           apelido do jogador na sala
 *   host.chatBox()             HTML do chat da sala
 *   host.matchResultModal(r)   modal de fim de partida
 *   host.prefs                 { opts, SIZES }  opções do jogador (tamanho das cartas)
 *
 * Os nomes abaixo são os mesmos que o jogo usava quando vivia dentro do portal; por isso o resto
 * do código do jogo não mudou. Os getters leem o host na hora do uso (nada é copiado).
 *
 * DATA DE CRIAÇÃO: 11/11/2026.
 *
 * AUTOR: Viana-78
 *
 * ============================================================================
 */

let host = null;

function bindHost(value) {
    host = value;
}

function current() {
    if (!host)
        throw new Error('Uno: o portal ainda não chamou register(host).');
    return host;
}

const render = () => current().render();
const emit = (...args) => current().emit(...args);
const nickOf = (uid) => current().nickOf(uid);
const chatBox = () => current().chatBox();
const matchResultModal = (result) => current().matchResultModal(result);

const authState = { get uid() { return current().auth.uid; } };

const roomsState = {
    get room() { return current().rooms.room; },
    get chat() { return current().rooms.chat; },
    get chatOpen() { return current().rooms.chatOpen; },
};

const opts = { get size() { return current().prefs.opts.size; } };
const SIZES = new Proxy({}, { get: (_, key) => current().prefs.SIZES[key] });

export { bindHost, render, emit, nickOf, chatBox, matchResultModal, authState, roomsState, opts, SIZES };
