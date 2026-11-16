/**
 * ============================================================================
 * ARQUIVO: uno.view.js
 * LOCAL: client/src/features/games/uno/uno.view.js
 * ============================================================================
 *
 * DESCRIÇÃO:
 * Mesa de jogo do Uno.
 *
 * RESPONSABILIDADES:
 * - Montar a mesa: barra superior, oponentes ao redor, monte, descarte, sentido e cor atual.
 * - Montar a mão do jogador, indicando visualmente as cartas jogáveis.
 * - Montar a mesa vazia exibida atrás do resultado do jogo rápido.
 *
 * DATA DE CRIAÇÃO: 07/11/2026 (extraído de client/src/views.js).
 *
 * ATUALIZAÇÕES:
 * - 07/11/2026: Extraído de views.js (AVAIL_W, miniHand, seats, handHtml, gameView e emptyTable).
 * - 09/11/2026: +N fixo da mesa usa o molde de símbolos (uno.symbols.js) e espera a animação.
 * - 09/11/2026: Seta giratória em volta do monte e do descarte (dirRingHtml, só no PC).
 * - 09/11/2026: Quem foi bloqueado fica com o leque cinza só enquanto o símbolo de bloqueio está sobre ele (sem carta cinza extra).
 * - 09/11/2026: Sem mensagens de texto no topo da mesa (eventNote removido); só o desafio do +4 mostra aviso, na animação.
 * - 09/11/2026: Botão de denúncia virou "!" no mesmo canto do botão UNO (saiu do assento do oponente).
 *
 * AUTOR: Viana-78
 *
 * ============================================================================
 */

import { esc } from '@bardotiao/ui';
import { avatar } from '@bardotiao/ui';
import { opts, SIZES } from './portal.js';
import { authState } from './portal.js';
import { roomsState, nickOf } from './portal.js';
import { chatBox } from './portal.js';
import { COLORS, cardFace, cardBack, canPlay } from './uno.cards.js';
import { unoState, isJumpable, isPlayable, jumpWindowOpen } from './uno.state.js';
import { clockHtml } from './uno.components.js';
import { symbolHtml, specialColor, dirRingHtml, dirArrowHtml } from './uno.symbols.js';
import { directPickMode } from './uno.perf.js';
import { jumpProgress } from './uno.motion.js';

// Enquanto uma troca/giro/desafio é animado, contagens e mão continuam como antes do resultado.
const notArrived = (uid) => {
    const d = unoState.drawing?.[uid];
    return d ? d.n - d.arrived : 0;
};
const shownCount = (uid, count) => (unoState.hold?.counts[uid] ?? count) - notArrived(uid);
// Cartas compradas só aparecem na mão (já na ordem certa do leque) quando chegam.
const shownHand = (game) => {
    const hand = unoState.hold?.hand || game.hand;
    return hand.slice(0, hand.length - notArrived(authState.uid));
};
// Leque cinza: só enquanto o símbolo de bloqueio está sobre o leque (a animação liga e desliga em unoState.block).
const isBlocked = (game, uid) => unoState.block?.uid === uid;
const COLOR_ORDER = ['red', 'yellow', 'green', 'blue', 'wild'];
const ACTION_ORDER = ['skip', 'reverse', 'draw2', 'wild', 'wild4'];


function availableWidth() {
    return Math.min(window.innerWidth - 24, 1100);
}

// Mão de um oponente: cartas viradas, sobrepostas em leque. Quanto mais cartas, mais apertado.
// Com uma lista de cartas (fim da rodada) as cartas aparecem viradas para cima.
function miniHand(hand, opponents, attrs = '') {
    const faces = Array.isArray(hand);
    const count = faces ? hand.length : hand;
    const width = (SIZES[opts.size]?.mw ?? 28) * (faces ? 1.25 : 1);
    const maxWidth = Math.max(84, Math.min(170, availableWidth() / (opponents + 1.6)));
    const step = count > 1 ? Math.min(width * 0.62, (maxWidth - width) / (count - 1)) : 0;
    const total = Math.max(0, count - 1) * step + width;
    const spread = Math.min(4, 36 / Math.max(count, 1));
    const cards = Array.from({ length: count }, (_, i) => {
        const style = `left:${(i * step).toFixed(1)}px;transform:rotate(${((i - (count - 1) / 2) * spread).toFixed(1)}deg)`;
        return faces ? cardFace(hand[i], { cls: 'mf', style }) : cardBack({ style });
    }).join('');
    return `<div class="minihand ${faces ? 'faces' : ''}" style="width:${total.toFixed(0)}px" ${attrs}>${cards}</div>`;
}

function seats(game) {
    const reveal = Boolean(game.allHands) && Date.now() >= unoState.revealAt;
    const ids = game.players.map((player) => player.uid);
    const mine = ids.indexOf(authState.uid);
    const opponents = [];
    for (let k = 1; k < ids.length; k++)
        opponents.push(game.players[(mine + k) % ids.length]);
    const total = opponents.length;
    // PC: com o 7 esperando o alvo, o chip e o leque de cada oponente viram o botão de escolha (só depois da animação do 7).
    const pickTarget = directPickMode() && game.awaiting?.kind === 'target' && Date.now() >= unoState.busyUntil - 20;
    return opponents.map((opponent, i) => {
        const t = (i + 1) / (total + 1);
        const x = 50 - 41 * Math.cos(Math.PI * t);
        const y = 58 - 46 * Math.sin(Math.PI * t);
        const player = roomsState.room.players.find((candidate) => candidate.uid === opponent.uid);
        const turn = game.turnUid === opponent.uid;
        const count = shownCount(opponent.uid, opponent.count);
        const blocked = isBlocked(game, opponent.uid);
        const pick = pickTarget ? `data-act="target" data-u="${esc(opponent.uid)}" title="Trocar a mão com ${esc(player?.nick || '?')}"` : '';
        return `
            <div class="seat ${turn ? 'turn' : ''} ${pickTarget ? 'pickable' : ''} ${blocked ? 'blocked' : ''} ${count === 1 && opponent.unoCalled && unoState.unoFxReady?.[opponent.uid] && !game.allHands ? 'uno' : ''} ${game.winner === opponent.uid ? 'win' : ''}" data-seat="${opponent.uid}" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%">
                <div class="nameplate" ${pick}>${avatar(player?.nick || '?', 'sm')}<b>${esc(player?.nick || '?')}</b>${player?.bot ? '<span class="tagx">BOT</span>' : ''}<em class="cnt">${count}</em>
                    ${count === 1 && opponent.unoCalled && unoState.unoFxReady?.[opponent.uid] && !game.allHands ? '<span class="unoflag">UNO!</span>' : ''}
                </div>
                ${miniHand(reveal ? game.allHands[opponent.uid] : count, total, pick)}
            </div>`;
    }).join('');
}

// Cartas por cor (vermelho, amarelo, verde, azul), números antes das ações; coringas juntos no fim.
// O índice original (data-i) é mantido: é ele que o servidor espera.
function sortedHand(hand) {
    const rank = (card) => (/^[0-9]$/.test(card.v) ? Number(card.v) : 10 + ACTION_ORDER.indexOf(card.v));
    return hand.map((card, i) => ({ card, i }))
        .sort((x, y) => COLOR_ORDER.indexOf(x.card.c) - COLOR_ORDER.indexOf(y.card.c) || rank(x.card) - rank(y.card));
}

// Janela de intromissão aberta e com carta idêntica na mão: só ela fica em destaque, as outras escurecem.
const canJumpNow = (game) => jumpWindowOpen(game) && game.hand.some((card) => isJumpable(game, card));

function handHtml(game, myTurn) {
    const cards = shownHand(game);
    const count = cards.length;
    const cardWidth = SIZES[opts.size]?.cw ?? 72;
    const step = count > 1 ? Math.min(cardWidth + 10, (availableWidth() - cardWidth) / (count - 1)) : 0;
    const jumping = canJumpNow(game);
    const frozen = Boolean(unoState.hold); // durante a animação a mão não é clicável (índices mudariam)
    return sortedHand(cards).map(({ card, i }, k) => {
        if (frozen)
            return cardFace(card, { cls: 'idle', style: `margin-left:${k ? (step - cardWidth).toFixed(1) : 0}px` });
        const playable = jumping ? isJumpable(game, card) : (myTurn && isPlayable(game, card, canPlay, i)) || isJumpable(game, card);
        // Fora da vez: levemente escuras; na janela de intromissão só a carta que pula fica clara e mais alta.
        const base = playable ? 'playable' : (myTurn && !jumping) ? 'dim' : 'idle';
        const cls = `${base} ${count === 1 && game.unoCalled && unoState.unoFxReady?.[authState.uid] && !game.winner ? 'unocard' : ''}`;
        return cardFace(card, {
            cls,
            style: `margin-left:${k ? (step - cardWidth).toFixed(1) : 0}px`,
            attrs: `data-act="play" data-i="${i}"`,
        });
    }).join('');
}

// Barra que se enche durante a janela de intromissão (do instante em que ela abre até fechar). O preenchimento é a escala
// (scaleX) do trecho já decorrido e uno.motion.js a atualiza a cada quadro: sobrevive aos redesenhos da mesa e não depende de
// animação CSS (antes a barra aparecia, mas ficava vazia quando as animações CSS estavam desligadas).
function jumpBar() {
    return `<div class="jbar"><i style="transform:scaleX(${jumpProgress().toFixed(3)})"></i></div>`;
}

function gameView() {
    const game = unoState.game;
    const room = roomsState.room;
    const myTurn = game.turnUid === authState.uid;
    const hasMove = game.hand.some((card, i) => isPlayable(game, card, canPlay, i));
    const pile = `
        <div class="pile ${myTurn && !hasMove ? 'hint' : ''}" data-act="draw" title="Comprar">
            ${cardBack({ cls: 'pc p3' })}${cardBack({ cls: 'pc p2' })}${cardBack({ cls: 'pc p1' })}
        </div>`;
    const picking = directPickMode() && game.awaiting && Date.now() >= unoState.busyUntil - 20 ? game.awaiting.kind : null;
    const turnText = game.winner
        ? `<span class="turnpill me">🏆 ${esc(nickOf(game.winner))} venceu!</span>`
        : picking === 'target'
        ? '<span class="turnpill me">👆 Clique no jogador para trocar</span>'
        : picking === 'color'
        ? '<span class="turnpill me">🎨 Clique em uma cor da pizza</span>'
        : myTurn
        ? '<span class="turnpill me">👉 Sua vez!</span>'
        : game.turnUid ? `<span class="turnpill">Vez de ${esc(nickOf(game.turnUid))}</span>` : '<span class="turnpill">…</span>';
    const me = room.players.find((player) => player.uid === authState.uid);
    const myCount = `<div class="nameplate me">${avatar(me?.nick || '?', 'sm')}<b>${esc(me?.nick || '?')}</b><em class="cnt">${shownHand(game).length}</em>${shownHand(game).length === 1 && game.unoCalled && unoState.unoFxReady?.[authState.uid] && !game.allHands ? '<span class="unoflag">UNO!</span>' : ''}</div>`;
    const pending = '';
    const graceLeft = unoState.unoGraceUid === authState.uid ? Math.max(0, unoState.unoGraceEnd - Date.now()) : 0;
    const postPlayCall = game.hand.length === 1 && graceLeft > 0 && game.unoVuln === authState.uid;
    const prePlayCall = game.hand.length === 2 && myTurn && game.hand.some((card, i) => isPlayable(game, card, canPlay, i));
    const unoBtn = game.rules?.unoCall && !unoState.hold && !game.unoCalled && !unoState.callPending && (postPlayCall || prePlayCall)
        ? '<button class="btn unobtn" data-act="callUno">UNO!</button>' : '';
    // A denúncia só aparece depois da janela de 300 ms concedida a quem acabou de ficar com 1 carta.
    const targetGraceLeft = unoState.unoGraceUid === game.unoVuln ? Math.max(0, unoState.unoGraceEnd - Date.now()) : 0;
    const reportBtn = game.rules?.unoCall && game.unoVuln && game.unoVuln !== authState.uid && !game.winner && !unoState.hold
        && targetGraceLeft <= 0 && Date.now() >= unoState.reportLockUntil && !unoState.reportPending
        ? `<button class="btn reportbtn" data-act="reportUno" title="Denunciar ${esc(nickOf(game.unoVuln))}: esqueceu de dizer UNO" aria-label="Denunciar ${esc(nickOf(game.unoVuln))}">!</button>` : '';
    const unoCorner = unoBtn || reportBtn ? `<span class="unocorner">${unoBtn}${reportBtn}</span>` : '';
    // O +N fixo só aparece depois que a animação da jogada fez o símbolo surgir (e com a cor da última carta +N).
    const pendingBig = game.pending && game.last?.n === unoState.symbolN
        ? `<div class="pendingbig">${symbolHtml('plus', `+${game.pending.total}`, specialColor(game.top))}</div>` : '';
    // Faixa de decisão no centro da mesa (desafiar/aceitar o +4 ou jogar/guardar a carta comprada).
    let band = '';
    if (myTurn && game.canChallenge)
        band = '<div class="decband"><button class="dbtn red" data-act="challenge" data-snd="option">Desafiar</button><button class="dbtn blue" data-act="draw" data-snd="option">Aceitar</button></div>';
    else if (myTurn && game.drawn && !game.drawn.forced)
        band = `<div class="decband"><button class="dbtn green" data-act="play" data-i="${game.drawn.index}" data-snd="option">Jogar</button><button class="dbtn orange" data-act="keep" data-snd="option">Guardar</button></div>`;
    const chat = roomsState.chatOpen
        ? `<aside class="chatdrawer"><div class="mhead"><h3>Chat</h3><button class="x" data-act="chatToggle">✕</button></div>${chatBox()}</aside>`
        : '';
    const chatCount = roomsState.chat.length ? ` (${roomsState.chat.length})` : '';
    const topKey = `${game.top.c}${game.top.v}|${game.players.map((player) => player.count).join(',')}|${game.deckCount}`;
    const fresh = topKey !== unoState.topKey;
    unoState.topKey = topKey;
    return `
        <div class="screen game">
            <header class="gbar">
                <div><b>${esc(room.name)}</b><small>Round ${room.round}/${room.settings.rounds}</small></div>
                <div class="row"><button class="btn ghost sm" data-act="chatToggle">💬 Chat${chatCount}</button><button class="btn ghost sm" data-act="leaveGame">Menu</button></div>
            </header>
            <div class="table ${unoState.dealHide ? 'dealing' : ''}"><div class="felt"></div>${dirRingHtml(game.dir, COLORS[game.color])}${seats(game)}${pendingBig}${band}
                <div class="tcenter">${pile}
                    <div class="discard" style="--c:${COLORS[game.color]}">${cardFace(game.top, { cls: `${fresh ? 'top' : ''} ${game.top.c === 'wild' && game.last?.awaiting !== 'color' ? 'tinted' : ''}` })}</div>
                    <div class="dirbox" title="Sentido do jogo">${dirArrowHtml(game.dir)}<i class="curcolor" style="background:${COLORS[game.color]}"></i></div>
                </div>
            </div>
            <footer class="mine ${myTurn ? 'turn' : ''} ${isBlocked(game, authState.uid) ? 'blocked' : ''} ${unoState.dealHide ? 'dealing' : ''} ${game.hand.length === 1 && game.unoCalled && unoState.unoFxReady?.[authState.uid] && !game.winner ? 'uno' : ''}" data-seat="${authState.uid}"><div class="mystat">${turnText}${unoCorner}${myCount}${clockHtml('mclock')}</div>${canJumpNow(game) ? jumpBar() : ''}<div class="hand">${handHtml(game, myTurn)}</div></footer>${chat}
        </div>`;
}

// Fundo do "jogo rápido" depois que acaba (a janela de resultado aparece por cima).
function emptyTable() {
    return '<div class="screen game"><div class="table"><div class="felt"></div></div></div>';
}

export { gameView, emptyTable, sortedHand };
