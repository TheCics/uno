/**
 * ============================================================================
 * ARQUIVO: uno.animations.js
 * LOCAL: client/src/features/games/uno/uno.animations.js
 * ============================================================================
 *
 * DESCRIÇÃO:
 * Animações do Uno a partir do registro da última jogada (`view.last`, enviado pelo servidor):
 * carta indo ao descarte, compra do monte, +2/+4 voando até quem comprou e bloqueio sobre o jogador.
 * Usa só shared/animations/card-fx.js; a mesa já foi desenhada quando isto roda.
 *
 * DATA DE CRIAÇÃO: 08/11/2026.
 *
 * ATUALIZAÇÕES:
 * - 09/11/2026: PC escolhe sem janela: o +4 surge e estático para os outros; para quem joga ele some e a pizza brota da carta (clicável); os outros continuam vendo o +4 e ele segue como o +N da jogada.
 * - 09/11/2026: Troca do 0 (e do 7): o montinho viaja com escala contínua (o meu sai grande e diminui; o que chega a mim vem pequeno e cresce) e nasce da geometria real do leque.
 * - 09/11/2026: Minhas cartas chegam de costas e viram no voo (distribuição inicial e compra); desafio ganho no +4 sobre +4: um +4 surge sobre cada um dos dois que pagam, depois a compra.
 * - 09/11/2026: +N no PC menor e mais alto (plusSpot, espelha .pendingbig no CSS).
 * - 09/11/2026: Molde dos efeitos especiais (specialOf/playSpecial): +2/+4/+N, bloqueio e inversão surgem da carta; durações somam o mesmo que antes.
 * - 09/11/2026: Compra sai do monte no tamanho normal e diminui até o leque; carta jogada sai pequena do leque, cresce até o meio e pousa; carta de baixo menor (profundidade).
 * - 09/11/2026: Palavra UNO com explosão de estrelas no instante em que a carta que deixa o jogador com 1 carta é jogada.
 *
 * - 09/11/2026: Coringa de cor: os outros jogadores veem as quatro cores no centro até a escolha (clearWheel); quem jogou usa só o modal.
 * - 09/11/2026: Modo leve para PC (uno.perf.js): aura menor e pizza com menos camadas; o celular fica igual.
 * - 09/11/2026: Na distribuição inicial todos os leques fecham e abrem (antes só o meu).
 * - 09/11/2026: Pizza só para os outros jogadores (quem escolhe a cor usa o modal). Bloqueio: leque cinza liga quando o símbolo chega no leque e desliga quando ele some (setBlockGray); respiro depois do bloqueio (blockBreath). Aura também no 0/7 quando a regra está ligada.
 *
 * - 09/11/2026: Feedback visual: aura na carta especial/intrometida (impact), aura da cor escolhida (colorAura) e tremor leve da mesa (shake).
 *
 * - 09/11/2026: Intromissão: traço esbranquiçado do assento até o descarte (jumpStreak), sem mensagem de texto.
 *
 * - 09/11/2026: Regra do 0: o montante que sai de mim e o que chega a mim mostram a 1ª carta com a face visível.
 *
 * - 09/11/2026: Efeitos no toque da carta (IMPACT_AT), traço da intromissão ao sair da mão, 0/7 em destaque por 2 s e voltando à carta, roda de cores também com cor já escolhida; carta de baixo some sem piscar.
 *
 * - 09/11/2026: 0 estático por 1 s; 7 e pizza de cores surgem da carta e ficam parados até a escolha (modal logo em seguida), depois voltam para dentro dela; pizza só no coringa de cor (não no +4); sem faixas de texto na troca/giro das mãos.
 *
 * - 09/11/2026: Magias mais exageradas (FX: aura maior e mais forte, anel de choque, tremor maior; valores anteriores anotados); bloqueio repetido da mesma pessoa (intromissão) mostra só uma animação; marcador cinza no bloqueado.
 * - 10/11/2026: Efeitos sonoros (compra, distribuição, intromissão e UNO) acoplados por ganchos mínimos; a lógica de animação permanece a da versão aprovada.
 *
 * - 10/11/2026: Som da intromissão toca desde a saída da carta da mão (antes só no impacto); sons do desafio (aviso, ganho e perdido); sons do +N até o leque, bloqueio cinza, cor do +4 e UNO cancelado.
 *
 * AUTOR: Viana-78
 *
 * ============================================================================
 */

import { flyTo, hideUntil, sleep, rectOf, layer, banner, reduced, setEffectsEnabled } from '@bardotiao/ui';
import { esc } from '@bardotiao/ui';
import { authState } from './portal.js';
import { nickOf } from './portal.js';
import { COLORS, cardFace, cardBack } from './uno.cards.js';
import { symbolHtml, specialColor } from './uno.symbols.js';
import { unoState } from './uno.state.js';
import { liteMode, directPickMode } from './uno.perf.js';
import { render } from './portal.js';
import { sortedHand } from './uno.view.js';
import { unoSfx } from './audio/uno.sfx.js';

// Tempos (ms) da linha do tempo; unoAnimationMs soma estes valores e o servidor espera algo equivalente (getPaceMs).
const T = {
    play: 650, pop: 320, badgeFly: 450, draw: 520, stagger: 150, breath: 400,
    swap: 1500, rotate: 1500, plusStay: 920, banner: 1500, reveal: 3300, verdict: 1400,
    emerge: 520, symHold: 120, zoom: 380, fade: 220, reverseHold: 500, // símbolos das cartas especiais
    numHold: 1000, back: 380, wheelHold: 1100, modalGap: 80, // 0/7: 1 s parado e volta para a carta; roda de cores do coringa
    pick: 300, // fatia escolhida se destaca antes de a pizza voltar para a carta
    plusLook: 500, // +4 esperando a cor (PC, quem joga): tempo em que o +4 fica visível antes de dar lugar à pizza
    blockEnd: 900, blockBreath: 800, // bloqueio: tempo sobre o leque (cinza) e respiro depois que o símbolo some, antes do próximo jogar
};
const REVERSE_MS = T.emerge + T.reverseHold + T.fade;
const NUM_MS = T.emerge + T.numHold + T.back; // 0/7 grande sem escolha (servidor: uno.engine.js usa 1900)
const WHEEL_MS = T.emerge + T.wheelHold + T.back; // pizza quando a cor já vem escolhida (servidor: 2000)
const STAY_MS = T.emerge + T.modalGap; // 7/pizza que ficam parados até a escolha: o modal entra logo depois que surgem
const BLOCK_MS = T.emerge + T.symHold + T.badgeFly + T.zoom + T.blockEnd + T.fade; // símbolo sobe, voa até o leque, fica sobre ele e some
const WHEEL_BACK_MS = T.pick + T.back; // escolha feita: fatia se destaca e a pizza volta para a carta (servidor: 680)
const PICK_WHEEL_MS = T.emerge + T.plusLook + T.back + T.emerge + T.modalGap; // +4 (PC, quem joga): +4 surge, some e a pizza brota da carta (servidor: 2000)
const PAIR_PLUS_MS = T.emerge + T.symHold + T.badgeFly + T.zoom + 320 + T.fade; // desafio ganho no +4 sobre +4: um +4 sobre cada pagante (servidor: 2010)
const IMPACT_AT = 0.8; // fração do voo em que a carta "toca" a mesa (a curva de chegada é lenta no final)
const REPORT_BUBBLE_IN_MS = 260;
const REPORT_BUBBLE_HOLD_MS = 1500; // balão fica legível por 1,5 s depois de aparecer
const REPORT_BUBBLE_OUT_MS = 260;
const REPORT_BUBBLE_MS = REPORT_BUBBLE_IN_MS + REPORT_BUBBLE_HOLD_MS + REPORT_BUBBLE_OUT_MS;
const REPORT_BREATH_MS = 350; // separa claramente o balão da punição
const REPORT_PLUS_MS = 820; // +2 mágico nasce do leque e sobe, sem atravessar a mesa
const REPORT_PLUS_BREATH_MS = 300; // respiro entre o +2 e a compra das cartas
const REPORT_TAIL_MS = 280;
// Coringa jogado sem espera de escolha (bot, última carta): a roda de cores aparece um instante antes da cor mudar.
// A pizza de cores é só do coringa de cor (o +4 não mostra pizza).
const isWild = (card) => card?.v === 'wild';
// A pizza aparece para os OUTROS jogadores. Quem joga/escolhe a cor também a vê no PC (escolha direta, sem janela): ela fica clicável.
// No celular quem escolhe usa o modal (isMe é declarado mais abaixo, mas só roda depois).
const wheelPreview = (last) => last.type === 'play' && isWild(last.card) && !last.awaiting && !last.resolved && !isMe(last.playerId);
// Coringa/7/+4 esperando a escolha: o símbolo surge da carta e fica parado na mesa até a escolha chegar.
const wheelAwaiting = (last) => last.type === 'play' && last.awaiting === 'color' && isWild(last.card) && !last.resolved && (!isMe(last.playerId) || directPickMode());
// +4 esperando a cor: todos veem o +4 estático (no PC, quem joga o vê surgir, sumir e dar lugar à pizza).
const plusAwaiting = (last) => last.type === 'play' && last.awaiting === 'color' && last.card?.v === 'wild4' && !last.resolved;
const picksOnTable = (last) => directPickMode() && isMe(last.playerId) && last.awaiting === 'color' && !last.resolved; // eu escolho a cor clicando na pizza
const numAwaiting = (last) => last.type === 'play' && last.awaiting === 'target' && last.card?.v === '7' && !last.resolved;
const staysOnTable = (last) => wheelAwaiting(last) || numAwaiting(last) || plusAwaiting(last);
// Escolha já feita: o que ficou na mesa (pizza ou 7) volta para dentro da carta antes do resto da jogada.
// O +4 estático dos outros não volta: ele continua como o +N da jogada (ver carried em animateLast).
function retractMs(last) {
    if (!last.resolved || last.type !== 'play')
        return 0;
    if (isWild(last.card))
        return isMe(last.playerId) && !directPickMode() ? 0 : WHEEL_BACK_MS;
    if (last.card?.v === 'wild4')
        return isMe(last.playerId) && directPickMode() ? WHEEL_BACK_MS : 0;
    return last.card?.v === '7' && last.event?.kind === 'swap' ? T.back : 0;
}
// 0 (giro) e 7 (troca): o número grande surge logo que a carta é jogada (no 7 com escolha, antes de escolher o alvo).
const isNumFx = (last) => !last.resolved && last.type === 'play' && Boolean(last.card)
    && ((last.card.v === '7' && (last.event?.kind === 'swap' || last.awaiting === 'target')) || (last.card.v === '0' && last.event?.kind === 'rotate'));
const isPlus = (card) => card?.v === 'draw2' || card?.v === 'wild4';

// Uma carta por voo, sem pressa; só em compras enormes o intervalo diminui (total do escalonamento <= 1,6 s).
const MAX_STAGGER_TOTAL = 1600;
const drawStagger = (count) => (count > 1 ? Math.min(T.stagger, MAX_STAGGER_TOTAL / (count - 1)) : 0);
const drawMs = (count) => T.draw + drawStagger(count) * (Math.max(count, 1) - 1);
const UNO_REPORT_MS = REPORT_BUBBLE_MS + REPORT_BREATH_MS + REPORT_PLUS_MS + REPORT_PLUS_BREATH_MS + drawMs(2) + REPORT_TAIL_MS;

// Quem compra cartas nesta jogada e quantas vão aparecer na mão (elas surgem uma a uma, conforme chegam).
function pendingDraws(last) {
    if (!last || last.event?.kind === 'challenge')
        return null;
    if (last.type === 'draw')
        return last.drawn ? { [last.playerId]: last.drawn } : null;
    if (last.autoDrawn > 1)
        return { [last.playerId]: last.autoDrawn - 1 };
    if (last.penalty && last.penalty !== 'skip' && last.drawn)
        return { [last.target]: last.drawn };
    return null;
}

// Redesenha a mesa animando (FLIP) as cartas que já estavam nos leques até a nova posição.
function renderSmooth() {
    const mine = new Map([...document.querySelectorAll('.mine .hand .uc')].map((el) => [el.dataset.i, el.getBoundingClientRect()]));
    const opponents = [...document.querySelectorAll('.seat .minihand')].map((fan) => [
        fan.closest('[data-seat]')?.dataset.seat, [...fan.children].map((el) => el.getBoundingClientRect())]);
    render();
    document.querySelectorAll('.mine .hand .uc').forEach((el) => {
        const before = mine.get(el.dataset.i);
        const dx = before ? before.left - el.getBoundingClientRect().left : 0;
        if (!before)
            el.animate([{ opacity: 0.3 }, { opacity: 1 }], { duration: 220 });
        else if (Math.abs(dx) > 1)
            el.animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], { duration: 260, easing: 'ease-out' });
    });
    for (const [uid, rects] of opponents) {
        const fan = uid && seatOf(uid)?.querySelector('.minihand');
        [...(fan?.children || [])].forEach((el, i) => {
            const dx = rects[i] ? rects[i].left - el.getBoundingClientRect().left : 0;
            if (Math.abs(dx) > 1)
                el.animate([{ transform: `translateX(${dx}px) ${el.style.transform}` }, { transform: el.style.transform }], { duration: 260, easing: 'ease-out' });
        });
    }
}

// Uma carta chegou: ela passa a existir na mão/contagem de quem comprou.
function arrive(uid) {
    const d = unoState.drawing?.[uid];
    if (!d)
        return;
    d.arrived += 1;
    renderSmooth();
}

// Distribuição inicial, num ritmo calmo e constante (o servidor usa a mesma conta: dealMs em uno.engine.js).
// Só se reduz em mesas enormes, para a distribuição não passar de ~5 s.
const DEAL_FLIGHT = 520;
// Depois da última carta: pausa, leque fecha, pausa, abre arrumado (650) e um respiro para o jogador ver as cartas.
const DEAL_TAIL = DEAL_FLIGHT + 250 + 350 + 300 + 650 + 1500;
const dealStep = (total) => Math.min(170, Math.max(90, 4760 / total));
function dealMs(view) {
    const total = view.players.length * (view.rules?.initialCards || 7);
    return dealStep(total) * (total - 1) + DEAL_TAIL;
}

// Duração total da animação de uma jogada: a vez só passa depois dela.
function unoAnimationMs(last) {
    if (!last)
        return 0;
    const event = last.event;
    if (event?.kind === 'uno-report')
        return UNO_REPORT_MS;
    if (event?.kind === 'challenge') {
        const pair = event.success && event.draws.length > 1 ? PAIR_PLUS_MS : 0; // +4 sobre +4: os dois pagam e cada um recebe um +4 antes da compra
        return T.banner + (last.reveal ? T.reveal : 0) + T.verdict + pair + Math.max(...event.draws.map((d) => drawMs(d.n))) + T.breath;
    }
    if (last.type === 'draw')
        return drawMs(last.drawn) + T.breath + (last.pendingTaken ? T.badgeFly + T.plusStay : 0);
    const auto = last.autoDrawn ? drawMs(last.autoDrawn) : 0;
    const play = last.resolved ? 0 : T.play;
    if (last.awaiting)
        return auto + play + (plusAwaiting(last) && picksOnTable(last) ? PICK_WHEEL_MS : staysOnTable(last) ? STAY_MS : T.breath);
    if (last.penalty === 'skip')
        return auto + play + BLOCK_MS + T.blockBreath;
    let extra = event?.kind === 'swap' ? T.swap : event?.kind === 'rotate' ? T.rotate : 0;
    if (extra && !last.resolved)
        extra += NUM_MS; // o 7/0 grande surge antes da troca/giro
    extra += retractMs(last);
    if (wheelPreview(last))
        extra += WHEEL_MS;
    if (last.penalty)
        return auto + play + extra + T.pop + T.badgeFly + T.plusStay + drawMs(last.drawn) + T.breath;
    const symbol = !last.penalty && isPlus(last.card) ? T.emerge : last.card?.v === 'reverse' ? REVERSE_MS : 0;
    return auto + play + extra + symbol + T.breath;
}

// Palavra UNO com estrelas: só no instante em que a jogada deixa o jogador com 1 carta.
// Oponente: surge no assento dele (menor). Eu: surge grande no centro da mesa.
const UNO_STARS = [
    ['#e53935', -150, -60, 38], ['#ffd21f', -80, -125, 30], ['#43a047', 110, -100, 36],
    ['#1e88e5', 165, 10, 28], ['#ffd21f', 120, 95, 24], ['#e53935', -165, 55, 26], ['#43a047', -40, 110, 22],
];

function reachedUno(last) {
    const game = unoState.game;
    const player = game?.players.find((candidate) => candidate.uid === last.playerId);
    // Ter uma carta não declara UNO sozinho: o servidor precisa confirmar o clique no botão.
    return Boolean(player?.unoCalled) && player.count === 1 && !game.winner && !['swap', 'rotate'].includes(last.event?.kind);
}

function unoBurst(uid) {
    if (unoState.animationsStopped) return;
    if (reduced())
        return;
    const mine = isMe(uid);
    const rect = rectOf(mine ? document.querySelector('.table .tcenter') : seatOf(uid));
    if (!rect)
        return;
    const k = mine ? 1 : 0.55;
    const el = document.createElement('div');
    el.className = 'unofx';
    el.style.left = `${rect.left + rect.width / 2}px`;
    el.style.top = `${mine ? rect.top + rect.height / 2 - 30 : rect.top - 12}px`; // o assento agora é um ponto central (tamanho zero)
    el.style.setProperty('--k', k);
    el.innerHTML = `${UNO_STARS.map(([color, , , size]) => `<i class="unofx-star" style="--c:${color};--s:${size}px"></i>`).join('')}<b class="unofx-word">UNO</b>`;
    layer().appendChild(el);
    const stars = [...el.querySelectorAll('.unofx-star')];
    const starFinished = stars.map((star, i) => {
        const [, dx, dy] = UNO_STARS[i];
        return star.animate([
            { transform: 'translate(-50%,-50%) scale(0) rotate(0deg)', opacity: 0 },
            { transform: `translate(calc(-50% + ${dx * k * 0.6}px), calc(-50% + ${dy * k * 0.6}px)) scale(1.2) rotate(90deg)`, opacity: 1, offset: 0.3 },
            { transform: `translate(calc(-50% + ${dx * k}px), calc(-50% + ${dy * k}px)) scale(0.8) rotate(200deg)`, opacity: 0 },
        ], { duration: 1100, delay: 60 + i * 25, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' }).finished.catch(() => {});
    });
    const word = el.querySelector('.unofx-word');
    const done = word.animate([
        { transform: 'scale(0) rotate(-18deg)', opacity: 0 },
        { transform: 'scale(1.3) rotate(-6deg)', opacity: 1, offset: 0.22 },
        { transform: 'scale(1) rotate(-6deg)', opacity: 1, offset: 0.38 },
        { transform: 'scale(1.05) rotate(-6deg)', opacity: 1, offset: 0.78 },
        { transform: 'scale(1.2) rotate(-6deg) translateY(-12px)', opacity: 0 },
    ], { duration: 1500, easing: 'ease-out', fill: 'forwards' });
    const finished = Promise.all([...starFinished, done.finished.catch(() => {})]);
    finished.finally(() => el.remove());
    setTimeout(() => el.remove(), 2200); // garantia se a animação for cancelada
    return finished;
}

// O selo e a explosão só podem acontecer depois que o servidor confirma a declaração pelo botão UNO.
function animateUnoDeclaration(uid, moveN = unoState.game?.last?.n) {
    const game = unoState.game;
    const player = game?.players?.find((candidate) => candidate.uid === uid);
    if (!game || game.last?.n !== moveN || game.last?.type !== 'play' || game.winner
        || player?.count !== 1 || !player.unoCalled || ['swap', 'rotate'].includes(game.last.event?.kind))
        return false;
    const key = `${moveN}:${uid}`;
    if (unoState.unoFxKeys?.[uid] === key)
        return false;
    unoState.unoFxKeys = { ...(unoState.unoFxKeys || {}), [uid]: key };
    const burst = unoBurst(uid);
    unoSfx.playUno();
    // O chip recebe o selo somente depois que a explosão e o SFX terminam.
    Promise.resolve(burst).then(() => {
        const current = unoState.game?.players?.find((candidate) => candidate.uid === uid);
        if (unoState.animationsStopped || unoState.unoFxKeys?.[uid] !== key || current?.count !== 1 || !current.unoCalled)
            return;
        unoState.unoFxReady = { ...(unoState.unoFxReady || {}), [uid]: true };
        const chip = isMe(uid) ? document.querySelector('.mine .nameplate.me') : seatOf(uid)?.querySelector('.nameplate');
        if (chip && !chip.querySelector('.unoflag')) {
            const flag = document.createElement('span');
            flag.className = 'unoflag';
            flag.textContent = 'UNO!';
            chip.appendChild(flag);
        }
    });
    return true;
}

const seatOf = (uid) => document.querySelector(`[data-seat="${uid}"]`);
const isMe = (uid) => uid === authState.uid;

// Ponto de partida/chegada: a mão (para mim) ou o assento do oponente.
const anchorOf = (uid) => (isMe(uid) ? document.querySelector('.mine .hand') || seatOf(uid) : seatOf(uid));

// Tamanho de layout do elemento: ignora scale/rotate de animações em andamento (getBoundingClientRect inflaria a carta).
const layoutSize = (el) => (el instanceof Element && el.offsetWidth ? { w: el.offsetWidth, h: el.offsetHeight } : null);

// Minha mão no momento da jogada que está sendo animada: as cartas que eu compro estão no fim dela, e é a frente delas que
// aparece quando a carta (que sai de costas do monte) vira no caminho. Dos outros jogadores nunca se sabe a carta.
let faceHand = null;

// Frentes das `count` cartas que eu compro (a última, se `played`, é a carta que a compra automática joga em seguida).
function drawnFaces(uid, count, played = null) {
    if (!isMe(uid) || !faceHand)
        return null;
    const keep = played ? count - 1 : count;
    const tail = keep > 0 ? faceHand.slice(Math.max(0, faceHand.length - keep)) : [];
    return tail.length === keep ? (played ? [...tail, played] : tail) : null;
}

// Compra: uma carta de costas por voo, do monte até o jogador; ao chegar, a carta passa a existir no leque dele.
// `keep` = quantas realmente ficam na mão (na compra automática a última vai direto para a mesa).
// `faces` (só para mim): a carta sai de costas e vira no caminho, chegando com a frente à mostra.
function drawFlight(uid, count, keep = count, faces = null) {
    if (!count)
        return Promise.resolve();
    const pile = document.querySelector('.pile .p1') || document.querySelector('.pile .ub');
    const fan = fanOf(uid);
    const to = fan || anchorOf(uid);
    const size = layoutSize(pile);
    if (!pile || !to || !size)
        return Promise.resolve();
    // Quem estava com UNO (1 carta visível) e precisa comprar: som para todos os jogadores, uma vez por compra.
    const owner = unoState.game?.players?.find((player) => player.uid === uid);
    const pendingN = unoState.drawing?.[uid] ? unoState.drawing[uid].n - unoState.drawing[uid].arrived : 0;
    const before = (unoState.hold?.counts?.[uid] ?? owner?.count ?? (isMe(uid) ? unoState.game?.hand?.length : undefined)) - pendingN;
    if (before === 1 && !unoState.game?.allHands)
        unoSfx.playUnoCancel();
    // A carta sai do monte no tamanho normal (o mesmo da distribuição) e vai diminuindo até o tamanho das cartas do leque.
    const slotW = fan?.children[0]?.offsetWidth || size.w * (isMe(uid) ? 1 : 0.4);
    const stagger = drawStagger(count);
    return Promise.all(Array.from({ length: count }, (_, i) => flyTo({
        html: cardBack({ style: `--mw:${size.w}px` }), front: faces?.[i] ? cardFace(faces[i], { style: `--cw:${size.w}px` }) : '', from: pile, to, size,
        endScale: slotW / size.w, duration: T.draw, delay: i * stagger, onStart: () => unoSfx.playDraw(),
    }).then(() => {
        if (i < keep)
            arrive(uid);
    })));
}

// Leque "em construção" de um jogador: copia a geometria do leque real (largura, passo e inclinação)
// e recebe as cartas uma a uma; as que já estão nele deslizam para abrir espaço, como numa compra.
function dealFan(uid, n, faces = null) {
    const real = fanOf(uid);
    const kids = real ? [...real.children] : [];
    if (!kids.length)
        return null;
    const box = rectOf(real);
    const w = kids[0].offsetWidth;
    const h = kids[0].offsetHeight;
    const step = kids.length > 1 ? kids[1].offsetLeft - kids[0].offsetLeft : 0;
    const spread = isMe(uid) ? 0 : Math.min(4, 36 / Math.max(n, 1));
    const fullWidth = (n - 1) * step + w;
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;left:${cx - fullWidth / 2}px;top:${cy - h / 2}px;width:${fullWidth}px;height:${h}px;--mw:${w}px;--cw:${w}px`;
    layer().appendChild(el);
    const cards = [];
    const place = (card, i, m) => {
        card.style.left = `${((n - m) * step) / 2 + i * step}px`;
        card.style.transform = `rotate(${((i - (m - 1) / 2) * spread).toFixed(1)}deg)`;
    };
    return {
        el, w, step, total: fullWidth, cards,
        close: () => Promise.all(cards.map((card, i) => card.animate([
            { transform: card.style.transform },
            { transform: `${card.style.transform} translateX(${(fullWidth - w) / 2 - parseFloat(card.style.left) + Math.min(i, 3) * 2}px)` },
        ], { duration: 350, easing: 'ease-in-out', fill: 'forwards' }).finished.catch(() => {}))),
        // Retângulo onde a m-ésima carta vai ficar (com m cartas no leque).
        slot(m) {
            return { left: cx - ((m - 1) * step + w) / 2 + (m - 1) * step, top: cy - h / 2, width: w, height: h };
        },
        add() {
            const card = document.createElement('div');
            // Minha mão chega com a frente à mostra (na ordem em que foi dada); as dos outros, de costas.
            const style = 'position:absolute;top:0;left:0';
            card.innerHTML = faces ? cardFace(faces[cards.length], { style }) : cardBack({ style });
            const back = card.firstElementChild;
            cards.push(back);
            el.appendChild(back);
            const m = cards.length;
            back.style.transition = 'none';
            place(back, m - 1, m);
            void back.offsetWidth; // fixa a posição inicial da nova carta antes de ligar a transição
            back.style.transition = 'left .45s ease, transform .45s ease';
            cards.forEach((c, i) => place(c, i, m)); // as anteriores deslizam para o novo leque
        },
    };
}

// Início da rodada: o monte (mesmo tamanho do monte de compra) entrega uma carta por vez e cada leque
// vai se completando aos poucos. Os leques reais ficam escondidos e só aparecem quando a mão está completa.
async function animateDeal(view) {
    if (unoState.animationsStopped) return;
    if (reduced()) {
        // Sem voo visual a distribuição continua audível, carta por carta.
        const count = view.players.reduce((sum, player) => sum + (isMe(player.uid) ? view.hand.length : player.count), 0);
        const gap = dealStep(count);
        for (let i = 0; i < count; i++)
            setTimeout(() => { if (!unoState.animationsStopped) unoSfx.playDraw(); }, i * gap);
        return;
    }
    const reals = [...document.querySelectorAll('.minihand, .mine .hand')];
    const fans = {};
    const remaining = {};
    view.players.forEach((player) => {
        const n = isMe(player.uid) ? view.hand.length : player.count;
        remaining[player.uid] = n;
        fans[player.uid] = dealFan(player.uid, n, isMe(player.uid) ? view.hand : null);
    });
    const pile = document.querySelector('.pile .ub');
    const pr = rectOf(pile);
    const total = view.players.reduce((sum, player) => sum + remaining[player.uid], 0);
    const step = dealStep(total);
    const filled = {};
    const flights = [];
    let k = 0;
    // Uma volta de cada vez: todos recebem a 1ª carta, depois a 2ª...
    for (let round = 0; k < total; round++) {
        for (const player of view.players) {
            if (round >= remaining[player.uid])
                continue;
            const fan = fans[player.uid];
            const m = (filled[player.uid] = (filled[player.uid] || 0) + 1);
            if (fan && pr) {
                // As minhas cartas saem de costas e viram no voo (a frente é a que vai ficar no leque); as dos outros chegam de costas.
                const mine = isMe(player.uid) && view.hand[m - 1];
                flights.push(flyTo({
                    html: cardBack({ style: `--mw:${pr.width}px` }), front: mine ? cardFace(view.hand[m - 1], { style: `--cw:${pr.width}px` }) : '',
                    from: pile, to: fan.slot(m),
                    size: { w: pr.width, h: pr.height }, endScale: fan.w / pr.width,
                    duration: DEAL_FLIGHT, delay: k * step, onStart: () => unoSfx.playDraw(),
                }).then(() => fan.add()));
            }
            k++;
        }
    }
    const reveal = () => {
        unoState.dealHide = false;
        document.querySelectorAll('.dealing').forEach((el) => el.classList.remove('dealing'));
    };
    try {
        await Promise.all(flights);
        await sleep(250);
        // Todos os leques (o meu e os dos outros): fecham num montinho e abrem de novo, já arrumados.
        // O meu abre arrumado por cor; os dos outros abrem do mesmo jeito, para a mesa ficar coesa.
        const dealt = Object.entries(fans).filter(([, fan]) => fan);
        await Promise.all(dealt.map(([, fan]) => fan.close()));
        await sleep(300);
        Object.values(fans).forEach((fan) => fan?.el.remove());
        reveal();
        await Promise.all(dealt.map(([uid]) => openFan(fanOf(uid), 650)));
    } finally {
        Object.values(fans).forEach((fan) => fan?.el.remove());
        reveal();
    }
}

// A carta anterior continua visível embaixo enquanto a nova pousa: um pouco menor, girada e mais escura,
// como a carta de baixo de um montante (nunca do mesmo tamanho da de cima). Some suave quando a nova pousa.
const UNDER_SCALE = 0.94;
const DISCARD_TILT = -4; // mesma inclinação de `.discard .uc` no CSS
function showPreviousTop(card, discard, color) {
    const size = layoutSize(discard);
    if (!card || !size)
        return () => {};
    const c = rectOf(discard);
    const w = size.w * UNDER_SCALE;
    const h = size.h * UNDER_SCALE;
    const el = document.createElement('div');
    el.className = 'fx-fly';
    // Coringa que já tinha cor escolhida: a carta de baixo mantém essa cor (antes voltava ao preto padrão).
    const tinted = card.c === 'wild' && COLORS[color];
    el.style.cssText = `width:${w}px;height:${h}px;left:${c.left + c.width / 2 - w / 2 - 5}px;top:${c.top + c.height / 2 - h / 2 - 3}px;z-index:0;transform:rotate(7deg);filter:brightness(.82)${tinted ? `;--c:${COLORS[color]}` : ''}`;
    el.innerHTML = cardFace(card, { cls: tinted ? 'tinted' : '', style: `--cw:${w}px` });
    layer().appendChild(el);
    return () => el.remove(); // some na hora em que a carta nova pousa: um fade deixaria a escura por cima da nova ("piscada")
}

// Mostra o resultado (novas contagens/mão) redesenhando a mesa sem o estado "congelado".
function releaseHold() {
    if (unoState.hold) {
        unoState.hold = null;
        render();
    }
}

const fanOf = (uid) => (isMe(uid) ? document.querySelector('.mine .hand') : seatOf(uid)?.querySelector('.minihand'));

// Onde está o leque de um jogador: caixa, cartas reais, tamanho de carta e o centro (onde o montinho se forma e para onde viaja).
// Minha mão é uma fileira reta com folga em cima da caixa: o centro vertical é o das cartas. Nos oponentes, o da caixa.
function fanSpot(uid) {
    const real = fanOf(uid);
    const kids = real ? [...real.children] : [];
    if (!kids.length)
        return null;
    const host = rectOf(real);
    const ref = isMe(uid) ? kids[0].getBoundingClientRect() : host;
    return { kids, host, w: kids[0].offsetWidth, h: kids[0].offsetHeight, x: host.left + host.width / 2, y: ref.top + ref.height / 2 };
}

// Cópia do leque real (mesma posição, inclinação e tamanho de cada carta; de costas) para fechar e viajar.
// O tamanho vem do leque real: o meu montinho é grande como as minhas cartas e o dos oponentes, pequeno como as deles.
// `top`: a carta de cima do montinho (a última) fica com a face visível; as demais, de costas.
function makeFan(uid, top = null) {
    const spot = fanSpot(uid);
    if (!spot)
        return null;
    const { kids, host, w, h } = spot;
    const lefts = kids.map((kid) => (kid.style.left ? parseFloat(kid.style.left) : kid.getBoundingClientRect().left - host.left));
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;left:${host.left}px;top:${spot.y - h / 2}px;width:${host.width}px;height:${h}px;--mw:${w}px;--cw:${w}px`;
    el.innerHTML = kids.map((kid, i) => {
        const style = `position:absolute;top:0;left:${lefts[i].toFixed(1)}px;transform:${kid.style.transform || 'none'}`;
        return top && i === kids.length - 1 ? cardFace(top, { style }) : cardBack({ style });
    }).join('');
    layer().appendChild(el);
    return { el, cx: spot.x, cy: spot.y, w, width: host.width, lefts };
}

const closeFan = (fan) => Promise.all([...fan.el.children].map((card, i) => card.animate([
    { transform: card.style.transform },
    { transform: `translateX(${(fan.width - fan.w) / 2 - fan.lefts[i] + Math.min(i, 3) * 2}px) rotate(0deg)` },
], { duration: 350, easing: 'ease-in-out', fill: 'forwards' }).finished.catch(() => {})));

// O leque real "abre" de novo a partir do centro, no destino.
function openFan(fan, duration = 400) {
    if (!fan)
        return Promise.resolve();
    const box = fan.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    return Promise.all([...fan.children].map((card) => {
        const r = card.getBoundingClientRect();
        const final = getComputedStyle(card).transform;
        return card.animate([
            { transform: `translateX(${cx - (r.left + r.width / 2)}px) rotate(0deg) scale(.9)` },
            { transform: final },
        ], { duration, easing: 'ease-out' }).finished.catch(() => {});
    }));
}

// Troca de mãos (7 e 0): cada leque fecha num montinho, o montinho viaja até o novo dono e só lá o leque abre.
// No caminho o montinho muda de tamanho de forma contínua: o meu sai grande (do tamanho das minhas cartas) e diminui até o das
// cartas do próximo; o que vem de outro jogador sai pequeno e cresce até o tamanho das minhas. Assim o montinho chega já do
// tamanho do leque que vai abrir e a troca fica coesa.
async function moveHands(moves, showTops = false) {
    const ids = [...new Set(moves.flatMap((m) => [m.from, m.to]))];
    try {
        if (reduced())
            return;
        // Regra do 0: só vemos as nossas cartas — a que entregamos (1ª da nossa mão) e a que recebemos (1ª da mão nova).
        const outTop = showTops && unoState.hold?.hand?.length ? sortedHand(unoState.hold.hand)[0]?.card : null;
        const inTop = showTops && unoState.game?.hand?.length ? sortedHand(unoState.game.hand)[0]?.card : null;
        const topOf = (m) => (m.from === authState.uid ? outTop : m.to === authState.uid ? inTop : null);
        const fans = moves.map((m) => ({ m, fan: makeFan(m.from, topOf(m)) })).filter((x) => x.fan);
        const dest = Object.fromEntries(moves.map((m) => [m.to, fanSpot(m.to)]));
        ids.forEach((id) => { const el = fanOf(id); if (el) el.style.visibility = 'hidden'; });
        await Promise.all(fans.map(({ fan }) => closeFan(fan)));
        await Promise.all(fans.map(({ m, fan }) => {
            const to = dest[m.to];
            if (!to)
                return null;
            return fan.el.animate([
                { transform: 'translate(0,0) scale(1)' },
                { transform: `translate(${to.x - fan.cx}px,${to.y - fan.cy}px) scale(${(to.w / fan.w).toFixed(3)})` },
            ], { duration: 650, easing: 'cubic-bezier(.25,.8,.3,1)', fill: 'forwards' }).finished.catch(() => {});
        }));
        fans.forEach(({ fan }) => fan.el.remove());
    } finally {
        releaseHold(); // redesenha com as mãos novas...
    }
    await Promise.all(ids.map((id) => openFan(fanOf(id)))); // ...e o leque abre no destino
}

// Sem faixas de texto: só os leques se movendo.
const swapFlight = (a, b) => moveHands([{ from: a, to: b }, { from: b, to: a }]);

// 0: depois que a carta pousou, todos os leques fecham e giram para o jogador seguinte, no sentido do jogo.
function rotateFlight(dir) {
    const ids = unoState.game.players.map((player) => player.uid);
    const n = ids.length;
    return moveHands(ids.map((id, i) => ({ from: id, to: ids[(((i + dir) % n) + n) % n] })), true);
}

// Só o desafiante vê: cartas de costas, viram, e as da cor do monte sobem em destaque.
async function revealHand(reveal) {
    if (reduced())
        return sleep(T.reveal);
    const root = document.createElement('div');
    root.className = 'fx-reveal';
    root.innerHTML = `<div class="rv-title">Mão de ${esc(nickOf(reveal.of))}</div>
        <div class="rv-cards">${reveal.cards.map(() => `<div class="rvw">${cardBack({ cls: 'rvc' })}</div>`).join('')}</div>`;
    layer().appendChild(root);
    await root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, fill: 'forwards' }).finished.catch(() => {});
    await sleep(500);
    const wrappers = [...root.querySelectorAll('.rvw')];
    const step = Math.min(60, 400 / wrappers.length);
    await Promise.all(wrappers.map(async (wrapper, i) => {
        await sleep(i * step);
        await wrapper.animate([{ transform: 'rotateY(0)' }, { transform: 'rotateY(90deg)' }], { duration: 200, fill: 'forwards' }).finished.catch(() => {});
        wrapper.innerHTML = cardFace(reveal.cards[i], { cls: 'rvc' });
        await wrapper.animate([{ transform: 'rotateY(-90deg)' }, { transform: 'rotateY(0)' }], { duration: 200, fill: 'forwards' }).finished.catch(() => {});
    }));
    const hits = wrappers.filter((_, i) => reveal.cards[i].c === reveal.color);
    await Promise.all(hits.map((wrapper) => {
        wrapper.classList.add('hit');
        return wrapper.animate([{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(-26px) scale(1.12)' }], { duration: 300, fill: 'forwards', easing: 'ease-out' }).finished.catch(() => {});
    }));
    await sleep(1300);
    await root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }).finished.catch(() => {});
    root.remove();
}

// Desafio do +4: aviso, (desafiante) mão revelada, veredito e compra de quem perdeu.
async function animateChallenge(last) {
    if (unoState.animationsStopped) return;
    const event = last.event;
    unoSfx.playChallenge(); // aparece o aviso de quem desafiou quem
    await banner({ html: `⚔️ <b>${esc(nickOf(event.by))}</b> desafiou <b>${esc(nickOf(event.target))}</b> pelo +4!`, hold: T.banner });
    if (last.reveal)
        await revealHand(last.reveal);
    if (event.success)
        unoSfx.playChallengeWon();
    else
        unoSfx.playChallengeLost();
    await banner({
        html: event.success
            ? `<span class="vd ok">✔ Confere</span><br>${esc(nickOf(event.by))} ganhou o desafio`
            : `<span class="vd no">✖</span><br>${esc(nickOf(event.by))} perdeu o desafio`,
        hold: T.verdict, tone: event.success ? 'ok' : 'no',
    });
    // +4 sobre +4 com desafio ganho: os dois repartem a conta. Um +4 (ou +N) surge sobre o leque de cada um e só depois vem a compra.
    if (event.success && event.draws.length > 1) {
        const discard = document.querySelector('.discard .uc');
        await Promise.all(event.draws.map((d) => playSpecial({
            kind: 'plus', symbol: `+${d.n}`, color: specialColor(unoState.game?.top), target: d.uid, endHold: 320,
        }, discard)));
    }
    // Só agora entram as cartas compradas, uma a uma, conforme chegam.
    unoState.drawing = Object.fromEntries(event.draws.map((d) => [d.uid, { n: d.n, arrived: 0 }]));
    releaseHold();
    await Promise.all(event.draws.map((d) => drawFlight(d.uid, d.n, d.n, drawnFaces(d.uid, d.n))));
}

// ===== Molde dos efeitos especiais (+2/+4/+N, bloqueio e inversão) =====
// O símbolo nasce da carta jogada (pequeno, com fade in, subindo até pairar sobre o monte). Depois, conforme a carta:
// vai até o jogador afetado e dá um zoom in/out (spec.target), fica na mesa (spec.stay: +N acumulado) ou some (inversão).
const mid = (rect) => ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });

// Ponto onde os símbolos surgem. No PC o +N é menor e fica um pouco mais acima, centrado sobre o descarte (não sobre o monte de compra):
// mesmas contas do .pendingbig em uno.styles.css (centro da mesa + meia carta - meia bolinha de cor; 56% da altura - 1,15 altura de carta).
const cardW = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cw')) || 72;
function symbolSpot(kind, tr) {
    if (kind === 'plus' && liteMode())
        return { x: tr.left + tr.width * 0.5 + cardW() * 0.5 - 11, y: tr.top + tr.height * 0.56 - cardW() * 1.5 * 1.15 };
    return { x: tr.left + tr.width * 0.5, y: tr.top + tr.height * 0.38 }; // mesmo ponto do .pendingbig (celular)
}

function specialOf(last) {
    const card = last.card;
    // 7 esperando o alvo: fica parado na mesa até a escolha. 0 (e 7 sem escolha): 1 s parado e volta para a carta.
    if (isNumFx(last))
        return { kind: 'num', symbol: card.v, color: specialColor(card), hold: T.numHold, back: true, stay: numAwaiting(last) };
    // Coringa de cor esperando a escolha: a pizza surge da carta e fica até a cor ser escolhida. No PC, quem joga clica nela (pickable).
    if (wheelAwaiting(last))
        return { kind: 'wheel', color: '#fff', stay: true, wheel: true, pickable: picksOnTable(last) };
    // +4 esperando a cor: o +4 surge da carta e fica estático (nada de pizza para os outros; no PC quem joga o vê dar lugar à pizza).
    if (plusAwaiting(last))
        return { kind: 'plus', symbol: '+4', color: specialColor(card), stay: true, held: 'plus' };
    if (last.type !== 'play' || !card || last.awaiting)
        return null;
    const color = specialColor(card);
    if (isPlus(card)) {
        const total = last.penalty ? (card.v === 'draw2' ? 2 : 4) : unoState.game?.pending?.total;
        return total ? { kind: 'plus', symbol: `+${total}`, color, target: last.penalty ? last.target : null, stay: !last.penalty } : null;
    }
    if (card.v === 'skip' && last.penalty === 'skip')
        return { kind: 'block', color, target: last.target, endHold: T.blockEnd, by: last.playerId, gray: { uid: last.target, n: last.n } };
    if (card.v === 'reverse')
        return { kind: 'reverse', color };
    return null;
}

// Símbolo de bloqueio em andamento (para descartar o da jogada anterior se a mesma pessoa bloquear de novo).
let activeBlock = null;

// Leque cinza do bloqueado: liga no instante em que o símbolo chega no leque e desliga quando ele some.
// A classe vai direto no DOM (a transição de filtro suaviza) e o estado mantém o cinza se a mesa for redesenhada no meio.
function setBlockGray({ uid, n }, on) {
    if (on)
        unoState.block = { uid, n };
    else if (unoState.block?.n === n)
        unoState.block = null;
    else
        return;
    seatOf(uid)?.classList.toggle('blocked', on);
}

const at = (dx, dy, scale, rot = 0) => `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${scale}) rotate(${rot}deg)`;

// Volta para dentro da carta do descarte (zoom out com um empurrãozinho antes, tom de desenho animado) e some.
async function retractEl(el) {
    const dr = rectOf(document.querySelector('.discard'));
    if (!el.isConnected || reduced() || !dr) {
        el.remove();
        return;
    }
    const spot = { x: parseFloat(el.style.left), y: parseFloat(el.style.top) };
    const origin = mid(dr);
    await el.animate([
        { transform: at(0, 0, 1, 0), opacity: 1 },
        { transform: at(0, -10, 1.1, 5), opacity: 1, offset: 0.22 },
        { transform: at(origin.x - spot.x, origin.y - spot.y, 0.1, -25), opacity: 0 },
    ], { duration: T.back, easing: 'cubic-bezier(.55,0,.85,.4)', fill: 'forwards' }).finished.catch(() => {});
    el.remove();
}

// Devolve o elemento quando o símbolo deve continuar na mesa (stay); o chamador o entrega à mesa e remove.
async function playSpecial(spec, discard) {
    if (spec.kind === 'plus' && spec.target)
        unoSfx.playPlusFly(); // +2/+4/+N sai da carta do descarte e segue até o leque de quem vai comprar
    const table = document.querySelector('.table');
    const tr = table && rectOf(table);
    const dr = discard && rectOf(discard);
    if (reduced() || !tr || !dr)
        return null;
    const spot = symbolSpot(spec.kind, tr);
    const origin = mid(dr);
    // `reuse`: o +4 que já estava parado na mesa continua como o +N da jogada (sem voltar à carta e surgir de novo).
    const reused = Boolean(spec.reuse?.isConnected);
    const el = reused ? spec.reuse : document.createElement('div');
    if (reused) {
        const text = el.querySelector('.fxsym b');
        if (text && spec.symbol)
            text.textContent = spec.symbol;
    } else {
        el.className = 'fxpos';
        el.style.cssText = `left:${spot.x}px;top:${spot.y}px`;
        el.innerHTML = symbolHtml(spec.kind, spec.symbol, spec.color);
        layer().appendChild(el);
    }
    // Mesma pessoa bloqueando duas vezes (intromissão): a segunda carta já resolve, a animação da primeira é descartada.
    if (spec.kind === 'block') {
        if (activeBlock && activeBlock.by === spec.by)
            activeBlock.el.remove();
        activeBlock = { by: spec.by, el };
    }
    const run = (frames, options) => el.animate(frames, { fill: 'forwards', ...options }).finished.catch(() => {});
    if (!spec.noEmerge && !reused) {
        await run([
            { transform: at(origin.x - spot.x, origin.y - spot.y, 0.1, -25), opacity: 0 },
            { transform: at((origin.x - spot.x) * 0.35, (origin.y - spot.y) * 0.35 - 30, 0.55, 12), opacity: 1, offset: 0.35 },
            { transform: at(0, -8, 1.22, -5), opacity: 1, offset: 0.72 },
            { transform: at(0, 0, 1, 0), opacity: 1 },
        ], { duration: T.emerge, easing: 'cubic-bezier(.2,.8,.25,1)' });
    }
    if (spec.pickable) {
        // Escolha direta no PC: só as fatias recebem o clique (data-act="color" é tratado pelo despachante global de cliques).
        el.classList.add('pickable');
        el.querySelectorAll('[data-c]').forEach((slice) => { slice.dataset.act = 'color'; });
    }
    if (spec.stay)
        return el;
    if (spec.target) {
        if (!spec.noEmerge && !reused)
            await sleep(T.symHold);
        const to = rectOf(fanOf(spec.target) || anchorOf(spec.target));
        const d = to ? mid(to) : spot;
        const dx = d.x - spot.x;
        const dy = d.y - spot.y;
        await run([{ transform: at(0, 0, 1) }, { transform: at(dx, dy, 0.45) }], { duration: T.badgeFly, easing: 'cubic-bezier(.45,0,.25,1)' });
        if (spec.gray) {
            setBlockGray(spec.gray, true); // o símbolo pousou no leque: as cartas ficam cinzas junto com ele
            unoSfx.playBlockGray();
        }
        await run([{ transform: at(dx, dy, 0.45) }, { transform: at(dx, dy, 0.62), offset: 0.5 }, { transform: at(dx, dy, 0.45) }], { duration: T.zoom, easing: 'ease-in-out' });
        await sleep(spec.endHold || 0);
    } else if (spec.back) {
        // 0/7: fica parado (sem pulso) pelo tempo combinado e volta para dentro da carta.
        await sleep(spec.hold);
        await retractEl(el);
        return null;
    } else if (spec.pick) {
        // Pizza com a cor já escolhida (bot / última carta): mostra as quatro, destaca a escolhida e volta para a carta.
        const wait = Math.round((spec.hold ?? 0) * 0.45);
        await sleep(wait);
        await pickSlice(el, spec.pick);
        await sleep(Math.max(0, (spec.hold ?? 0) - wait - T.pick));
        await retractEl(el);
        return null;
    } else {
        await sleep(spec.hold ?? T.reverseHold);
    }
    await run([{ opacity: 1 }, { opacity: 0 }], { duration: T.fade });
    el.remove();
    if (spec.gray && (!activeBlock || activeBlock.el === el))
        setBlockGray(spec.gray, false); // o símbolo sumiu: as cartas voltam à cor
    if (activeBlock?.el === el)
        activeBlock = null;
    return null;
}

// ===== Feedback visual (10): aura mágica na carta jogada, aura da cor escolhida e tremor leve da mesa =====
// Nenhum destes efeitos bloqueia a linha do tempo (não somam tempo); com movimento reduzido, nada roda.
// 7 e 0 só são "especiais" quando a regra está ligada no lobby; desligada, são cartas de número comuns.
const isSpecialCard = (card) => ['draw2', 'wild4', 'wild', 'reverse', 'skip'].includes(card?.v)
    || (card?.v === '7' && Boolean(unoState.game?.rules?.swapSeven))
    || (card?.v === '0' && Boolean(unoState.game?.rules?.rotateZero));

// ===== Intensidade das magias (aura, anel e tremor) =====
// Para voltar ao efeito anterior, troque cada valor pelo que está entre parênteses ("antes").
// O brilho dos símbolos grandes (+N, bloqueio, inversão, 0/7, pizza) está no CSS: ver ".fxsym" em uno.styles.css.
const FX = {
    auraSize: 4.2,       // (antes 2.6) tamanho da aura, em vezes o tamanho da carta
    auraSizeBig: 6.5,    // (antes 4.2) aura da cor escolhida
    auraOpacity: 1,      // (antes 0.7)
    auraOpacityBig: 1,   // (antes 0.85)
    auraGrow: 1.9,       // (antes 1.5) quanto a aura cresce antes de sumir
    auraGrowBig: 1.5,    // (antes 1.25)
    auraMs: 1300,        // (antes 900) duração
    auraBigMs: 1900,     // (antes 1500)
    core: true,          // (antes false: não existia) miolo branco quente no centro da aura
    ring: true,          // (antes false: não existia) anel de choque que se expande a partir da carta
    shakePx: 6,          // (antes 3) amplitude do tremor da mesa
    shakeMs: 420,        // (antes 300) duração do tremor
};

// Modo leve (PC): aura um pouco menor (a área pintada no PC é muito maior) e mesma duração, para o ritmo ser igual ao do celular.
// "Leve" = sem mix-blend-mode e sem camadas extras, mas com a aura e a tremida um pouco MAIORES que as do celular
// (a tela do PC é grande e o mesmo efeito parecia "sem sal").
const FX_LITE = { auraSize: 4.8, auraSizeBig: 7.2, auraGrow: 2.1, auraGrowBig: 1.65, shakePx: 10, shakeMs: 480 };
const fxNow = () => (liteMode() ? { ...FX, ...FX_LITE } : FX);

// Brilho que nasce atrás da carta do descarte, cresce e some. `big`: aura maior e mais lenta (mudança de cor).
// Camadas: aura colorida + miolo claro + anel de choque (ver FX para voltar ao efeito simples).
function aura(color, { big = false } = {}) {
    if (unoState.animationsStopped) return;
    const rect = rectOf(document.querySelector('.discard'));
    if (reduced() || !rect)
        return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const base = Math.max(rect.width, rect.height);
    const fx = fxNow();
    const [factor, grow, peak, ms] = big
        ? [fx.auraSizeBig, fx.auraGrowBig, fx.auraOpacityBig, fx.auraBigMs]
        : [fx.auraSize, fx.auraGrow, fx.auraOpacity, fx.auraMs];
    const fadeIn = big ? 0.3 : 0.25;
    const spawn = (className, size, frames, options) => {
        const el = document.createElement('div');
        el.className = className;
        el.style.cssText = `left:${cx}px;top:${cy}px;width:${size}px;height:${size}px;--ac:${color}`;
        layer().appendChild(el);
        el.animate(frames, { fill: 'forwards', ...options }).finished.catch(() => {}).then(() => el.remove());
        setTimeout(() => el.remove(), ms + 600); // garantia
    };
    spawn('fxaura', base * factor, [
        { transform: 'translate(-50%,-50%) scale(.35)', opacity: 0 },
        { transform: 'translate(-50%,-50%) scale(.9)', opacity: peak, offset: fadeIn },
        { transform: `translate(-50%,-50%) scale(${grow})`, opacity: 0 },
    ], { duration: ms, easing: 'ease-out' });
    if (FX.core)
        spawn('fxaura core', base * factor * 0.55, [
            { transform: 'translate(-50%,-50%) scale(.2)', opacity: 0 },
            { transform: 'translate(-50%,-50%) scale(1)', opacity: 0.95, offset: 0.2 },
            { transform: 'translate(-50%,-50%) scale(1.4)', opacity: 0 },
        ], { duration: ms * 0.7, easing: 'ease-out' });
    if (FX.ring)
        spawn('fxring', base * 1.1, [
            { transform: 'translate(-50%,-50%) scale(.3)', opacity: 1 },
            { transform: `translate(-50%,-50%) scale(${factor * 0.75})`, opacity: 0 },
        ], { duration: ms * 0.8, easing: 'cubic-bezier(.1,.7,.3,1)' });
}

// Intromissão: um traço esbranquiçado liga o assento de quem se intrometeu ao descarte e some por fade out
// (1 elemento, só transform/opacity; sem texto). Um anel curto no assento mostra quem foi.
function jumpStreak(uid) {
    if (unoState.animationsStopped) return;
    const from = rectOf(anchorOf(uid));
    const to = rectOf(document.querySelector('.discard'));
    if (reduced() || !from || !to)
        return;
    const a = mid(from);
    const b = mid(to);
    const len = Math.hypot(b.x - a.x, b.y - a.y) * 1.3; // passa um pouco do descarte
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const line = document.createElement('div');
    line.className = 'fxjump';
    line.style.cssText = `left:${a.x}px;top:${a.y}px;width:${len}px;transform:rotate(${angle}rad)`;
    const ring = document.createElement('div');
    ring.className = 'fxjump-ring';
    ring.style.cssText = `left:${a.x}px;top:${a.y}px`;
    layer().append(line, ring);
    line.animate([
        { transform: `rotate(${angle}rad) scaleX(0)`, opacity: 0.95 },
        { transform: `rotate(${angle}rad) scaleX(1)`, opacity: 0.9, offset: 0.3 },
        { transform: `rotate(${angle}rad) scaleX(1)`, opacity: 0 },
    ], { duration: 850, easing: 'ease-out', fill: 'forwards' }).finished.catch(() => {}).then(() => line.remove());
    ring.animate([
        { transform: 'translate(-50%,-50%) scale(.4)', opacity: 0.9 },
        { transform: 'translate(-50%,-50%) scale(1.5)', opacity: 0 },
    ], { duration: 650, easing: 'ease-out', fill: 'forwards' }).finished.catch(() => {}).then(() => ring.remove());
    setTimeout(() => { line.remove(); ring.remove(); }, 1000); // garantia
}

// Impacto curto e discreto: a mesa balança alguns pixels, amortecendo.
function shake() {
    if (unoState.animationsStopped) return;
    const table = document.querySelector('.table');
    if (reduced() || !table)
        return;
    const px = fxNow().shakePx;
    const at = (x, y) => `${(x * px) / 3}px ${(y * px) / 3}px`; // proporções do tremor original (3 px)
    table.animate([
        { translate: '0 0' }, { translate: at(-3, 2), offset: 0.18 }, { translate: at(3, -2), offset: 0.4 },
        { translate: at(-2, 1), offset: 0.62 }, { translate: at(1, -1), offset: 0.82 }, { translate: '0 0' },
    ], { duration: fxNow().shakeMs, easing: 'ease-out' });
}

// Carta especial (ou intromissão) que acabou de pousar: aura na cor da carta + tremor.
function impact(last) {
    if (unoState.animationsStopped) return;
    const jumped = last.jumped || last.event?.kind === 'jump';
    if (!isSpecialCard(last.card) && !jumped)
        return;
    aura(specialColor(last.card));
    shake();
}

// Cor da mesa escolhida (coringa ou +4), já confirmada: aura na cor nova.
function colorAura(last) {
    if (unoState.animationsStopped) return;
    if (last.card?.c === 'wild' && !last.awaiting && unoState.game?.color) {
        aura(COLORS[unoState.game.color], { big: true });
        // A pizza acabou de bater na carta e a aura saiu dela: +4 e coringa de cor têm som próprio.
        if (last.card.v === 'wild4')
            unoSfx.playWild4Color();
        else
            unoSfx.playWheelBack();
    }
}

// 7, pizza de cores ou +4 que ficam parados na mesa até a escolha (ela chega como nova jogada).
let heldEl = null;
let heldKind = null; // 'num' (7), 'wheel' (pizza) ou 'plus' (+4)

// Guarda o elemento parado, a menos que a jogada já tenha sido substituída por outra enquanto a animação rodava (aí ele some).
function hold(el, kind, last) {
    if (!el)
        return;
    if (unoState.animKey !== last.n)
        return el.remove();
    heldEl = el;
    heldKind = kind;
}

// A pizza "escolhe": as fatias não escolhidas apagam e a escolhida fica mais brilhante (mostra a cor nova a todos).
function pickSlice(el, color) {
    const slices = [...el.querySelectorAll('[data-c]')];
    if (!color || !slices.length)
        return Promise.resolve();
    return Promise.all(slices.map((slice) => (slice.dataset.c === color
        ? slice.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.35)' }], { duration: T.pick, fill: 'forwards' })
        : slice.animate([{ opacity: 1 }, { opacity: 0.18 }], { duration: T.pick, fill: 'forwards' })).finished.catch(() => {})));
}

// Escolha feita: a pizza destaca a cor e o 7 sai; os dois voltam para dentro da carta. Sem animar, só remove.
// Exceção: o +4 parado (para quem não escolheu) NÃO volta: é devolvido para continuar como o +N da jogada resolvida.
async function clearHeld(animated = true, next = null) {
    const el = heldEl;
    const kind = heldKind;
    heldEl = null;
    heldKind = null;
    if (!el)
        return null;
    el.classList.remove('pickable'); // escolha feita: a pizza não recebe mais cliques
    if (!animated) {
        el.remove();
        return null;
    }
    if (kind === 'plus' && next?.resolved && isPlus(next.card) && !next.awaiting)
        return el;
    await pickSlice(el, unoState.game?.color);
    await retractEl(el);
    return null;
}

function stopUnoAnimations() {
    unoState.animationsStopped = true;
    heldEl?.remove();
    heldEl = null;
    heldKind = null;
    document.querySelectorAll('.dealing, .fx-fly, .fx-badge, .fxaura, .fxring, .fxpos, .unofx, .fx-streak, .fx-report, .uno-report-bubble, .uno-report-plus').forEach((el) => { el.getAnimations?.().forEach((animation) => animation.cancel()); el.remove(); });
    setEffectsEnabled(false);
}

function resumeUnoAnimations() {
    unoState.animationsStopped = false;
    setEffectsEnabled(true);
}

function animateUnoButtonPress(button) {
    if (!button)
        return;
    const rect = rectOf(button);
    button.disabled = true;
    button.style.pointerEvents = 'none';
    if (reduced() || !rect) {
        button.style.visibility = 'hidden';
        return;
    }
    const fx = document.createElement('div');
    fx.className = 'uno-consume-fx';
    fx.style.cssText = `left:${rect.left + rect.width / 2}px;top:${rect.top + rect.height / 2}px;width:${rect.width}px;height:${rect.height}px`;
    fx.innerHTML = '<i class="uno-consume-ring"></i><i class="uno-consume-core"></i><b>UNO!</b>';
    layer().appendChild(fx);
    button.animate([
        { opacity: 1, transform: getComputedStyle(button).transform, filter: 'brightness(1)' },
        { opacity: 0.85, transform: 'rotate(-14deg) scale(1.12)', filter: 'brightness(1.8)' , offset: 0.25 },
        { opacity: 0, transform: 'rotate(12deg) scale(.18)', filter: 'brightness(2.8) blur(7px)' },
    ], { duration: 430, easing: 'cubic-bezier(.18,.72,.24,1)', fill: 'forwards' }).finished.catch(() => {}).then(() => {
        button.style.visibility = 'hidden';
        fx.remove();
    });
    fx.animate([
        { opacity: 0, transform: 'translate(-50%,-50%) scale(.35)' },
        { opacity: 1, transform: 'translate(-50%,-50%) scale(1.15)', offset: 0.32 },
        { opacity: 0, transform: 'translate(-50%,-50%) scale(2.15)' },
    ], { duration: 470, easing: 'ease-out', fill: 'forwards' }).finished.catch(() => {}).then(() => fx.remove());
}

async function animateUnoReportBubble(uid) {
    if (unoState.animationsStopped) return;
    unoSfx.playUnoReport();
    const chip = isMe(uid) ? document.querySelector('.mine .nameplate.me') : seatOf(uid)?.querySelector('.nameplate');
    const rect = rectOf(chip);
    if (!rect || reduced()) {
        await sleep(REPORT_BUBBLE_MS);
        return;
    }
    const at = mid(rect);
    const bubble = document.createElement('div');
    bubble.className = 'uno-report-bubble';
    bubble.setAttribute('aria-hidden', 'true');
    bubble.style.left = `${at.x}px`;
    bubble.style.top = `${at.y}px`;
    bubble.innerHTML = '<span>!</span>';
    layer().appendChild(bubble);
    await bubble.animate([
        { opacity: 0, transform: 'translate(-50%,-50%) scale(.08) rotate(-28deg)' },
        { opacity: 1, transform: 'translate(-50%,-50%) scale(1.2) rotate(9deg)', offset: REPORT_BUBBLE_IN_MS / REPORT_BUBBLE_MS },
        { opacity: 1, transform: 'translate(-50%,-50%) scale(1) rotate(0deg)', offset: (REPORT_BUBBLE_IN_MS + 100) / REPORT_BUBBLE_MS },
        // Mantém o balão totalmente visível durante 1,5 s após a entrada.
        { opacity: 1, transform: 'translate(-50%,-50%) scale(1) rotate(0deg)', offset: (REPORT_BUBBLE_IN_MS + REPORT_BUBBLE_HOLD_MS) / REPORT_BUBBLE_MS },
        { opacity: 0, transform: 'translate(-50%,-58%) scale(.82) rotate(4deg)' },
    ], { duration: REPORT_BUBBLE_MS, easing: 'cubic-bezier(.16,.8,.26,1)', fill: 'forwards' }).finished.catch(() => {});
    bubble.remove();
}

async function animateUnoReportPlus(uid) {
    if (unoState.animationsStopped) return;
    unoSfx.playPlusFly();
    const fan = fanOf(uid) || anchorOf(uid);
    const to = rectOf(fan);
    if (!to || reduced()) {
        await sleep(REPORT_PLUS_MS);
        return;
    }
    // O +2 nasce dentro do próprio leque, como uma pequena explosão mágica; não vem do descarte.
    const start = { x: to.left + to.width / 2, y: to.top + to.height * 0.72 };
    const plus = document.createElement('div');
    plus.className = 'uno-report-plus';
    plus.setAttribute('aria-hidden', 'true');
    plus.style.left = `${start.x}px`;
    plus.style.top = `${start.y}px`;
    plus.innerHTML = '<i></i><b>+2</b><span class="spark-a">✦</span><span class="spark-b">✧</span>';
    layer().appendChild(plus);
    const ring = plus.querySelector('i');
    const sparkA = plus.querySelector('.spark-a');
    const sparkB = plus.querySelector('.spark-b');
    const animations = [
        plus.animate([
            { opacity: 0, transform: 'translate(-50%,-50%) translateY(18px) scale(.12) rotate(-14deg)' },
            { opacity: 1, transform: 'translate(-50%,-50%) translateY(-12px) scale(1.22) rotate(7deg)', offset: 0.38 },
            { opacity: 1, transform: 'translate(-50%,-50%) translateY(-22px) scale(1) rotate(0deg)', offset: 0.72 },
            { opacity: 0, transform: 'translate(-50%,-50%) translateY(-54px) scale(.76) rotate(5deg)' },
        ], { duration: REPORT_PLUS_MS, easing: 'cubic-bezier(.16,.82,.24,1)', fill: 'forwards' }).finished.catch(() => {}),
        ring.animate([
            { opacity: 0, transform: 'rotate(-35deg) scale(.18)' },
            { opacity: 0.95, transform: 'rotate(100deg) scale(1)', offset: 0.42 },
            { opacity: 0, transform: 'rotate(235deg) scale(1.5)' },
        ], { duration: REPORT_PLUS_MS, easing: 'ease-out', fill: 'forwards' }).finished.catch(() => {}),
        sparkA.animate([
            { opacity: 0, transform: 'translate(0,12px) scale(.2) rotate(0deg)' },
            { opacity: 1, transform: 'translate(-24px,-24px) scale(1.1) rotate(90deg)', offset: 0.35 },
            { opacity: 0, transform: 'translate(-38px,-48px) scale(.4) rotate(180deg)' },
        ], { duration: REPORT_PLUS_MS * 0.85, easing: 'ease-out', fill: 'forwards' }).finished.catch(() => {}),
        sparkB.animate([
            { opacity: 0, transform: 'translate(0,8px) scale(.2) rotate(0deg)' },
            { opacity: 1, transform: 'translate(28px,-18px) scale(1) rotate(-70deg)', offset: 0.42 },
            { opacity: 0, transform: 'translate(42px,-42px) scale(.35) rotate(-160deg)' },
        ], { duration: REPORT_PLUS_MS * 0.9, easing: 'ease-out', fill: 'forwards' }).finished.catch(() => {}),
    ];
    await Promise.all(animations);
    plus.remove();
}

async function animateUnoReport(last, event) {
    if (unoState.animationsStopped) return;
    // Balão + 1,5 s de leitura; respiro; +2 mágico no leque; respiro; compra das duas cartas.
    await animateUnoReportBubble(event.by);
    if (unoState.animationsStopped) return;
    await sleep(REPORT_BREATH_MS);
    if (unoState.animationsStopped) return;
    await animateUnoReportPlus(event.target);
    if (unoState.animationsStopped) return;
    await sleep(REPORT_PLUS_BREATH_MS);
    if (unoState.animationsStopped) return;
    await drawFlight(event.target, last.drawn || 2, last.drawn || 2, drawnFaces(event.target, last.drawn || 2));
    await sleep(REPORT_TAIL_MS);
}
async function animateLast(last) {
    if (unoState.animationsStopped) return;
    faceHand = unoState.game?.hand ? [...unoState.game.hand] : null; // frentes das cartas que eu comprar nesta jogada
    // A escolha chegou: o 7/pizza parado volta para a carta antes do resto; o +4 parado continua (carried) como o +N da jogada.
    const carried = await clearHeld(Boolean(last.resolved), last);
    if (unoState.animationsStopped) return;
    const discard = document.querySelector('.discard .uc');
    const event = last.event;
    const toUno = last.type === 'play' && !last.resolved && reachedUno(last); // lido já: a próxima vista pode mudar as contagens
    if (event?.kind === 'uno-report') {
        await animateUnoReport(last, event);
        return;
    }
    if (event?.kind === 'challenge') {
        await animateChallenge(last);
        return;
    }
    if (last.type === 'draw') {
        if (last.pendingTaken)
            await playSpecial({ kind: 'plus', symbol: `+${last.drawn}`, color: specialColor(unoState.game?.top), target: last.playerId, noEmerge: true, endHold: 320 }, discard);
        await drawFlight(last.playerId, last.drawn, last.drawn, drawnFaces(last.playerId, last.drawn));
        return;
    }
    // Tempo esgotado sem carta jogável: compra até achar uma e só então joga.
    if (last.autoDrawn)
        await drawFlight(last.playerId, last.autoDrawn, last.autoDrawn - 1, drawnFaces(last.playerId, last.autoDrawn, last.card));
    // Jogada: a carta sai da mão/assento de quem jogou e cai sobre a carta anterior do descarte.
    // (Se já pousou antes — coringa/7 com escolha depois da animação — só falta o efeito.)
    if (!last.resolved) {
        const mine = isMe(last.playerId);
        const fan = fanOf(last.playerId);
        const from = fan || anchorOf(last.playerId);
        const size = layoutSize(discard);
        const removePrevious = showPreviousTop(unoState.prevTop, discard, unoState.prevColor);
        // Sai do leque no tamanho das cartas dele (pequena nos oponentes), cresce a caminho do meio
        // e pousa no tamanho e na inclinação da carta do descarte.
        const fromW = fan?.children[0]?.offsetWidth || (size ? size.w * (mine ? 1 : 0.4) : 0);
        const landed = size ? flyTo({
            html: cardFace(last.card, { style: `--cw:${size.w}px` }), from, to: discard, size,
            startScale: fromW / size.w, midScale: mine ? 1.25 : 1.3, midAt: mine ? 0.45 : 0.78, arc: mine ? 34 : 26,
            endScale: 1, endRotate: DISCARD_TILT, spin: mine ? 0 : 14, duration: T.play,
        }) : Promise.resolve();
        landed.then(removePrevious); // antes de hideUntil: a de baixo sai no mesmo quadro em que a nova aparece
        hideUntil([discard], landed);
        if (last.jumped || event?.kind === 'jump') {
            jumpStreak(last.playerId); // o traço surge assim que a carta sai da mão
            unoSfx.playJump(); // som da intromissão cobre a animação toda (traço, queda e aura): toca desde a saída da mão
        }
        const impactDelay = size ? T.play * IMPACT_AT : 0;
        setTimeout(() => { if (!unoState.animationsStopped) impact(last); }, impactDelay); // aura + tremor no instante do toque
        const rules = unoState.game?.rules || {};
        const specialSoundAllowed = (last.card?.v !== '0' || Boolean(rules.rotateZero))
            && (last.card?.v !== '7' || Boolean(rules.swapSeven));
        if (!(last.jumped || event?.kind === 'jump') && specialSoundAllowed && unoSfx.hasCardSfx(last.card))
            setTimeout(() => { if (!unoState.animationsStopped) unoSfx.playCardSpecial(last.card); }, impactDelay); // +2, +4, 0, 7, bloqueio, inversão e troca de cor: som próprio no impacto, junto com o genérico
        await landed;
        if (unoState.animationsStopped) return;
        if (toUno)
            animateUnoDeclaration(last.playerId, last.n); // só dispara se o servidor confirmou o clique no botão UNO
    }
    if (wheelPreview(last))
        await playSpecial({ kind: 'wheel', symbol: '', color: '#fff', hold: T.wheelHold, pick: unoState.game?.color }, discard);
    if (unoState.animationsStopped) return;
    colorAura(last);
    const special = specialOf(last);
    if (carried) {
        if (special?.kind === 'plus')
            special.reuse = carried;
        else
            carried.remove();
    }
    if (special?.held === 'plus') {
        // +4 esperando a cor: surge e fica parado. No PC, para quem joga, ele some (volta à carta) e a pizza brota dela, clicável.
        let el = await playSpecial(special, discard);
        let kind = 'plus';
        if (el && picksOnTable(last) && unoState.animKey === last.n) {
            await sleep(T.plusLook);
            await retractEl(el);
            el = await playSpecial({ kind: 'wheel', symbol: '', color: '#fff', stay: true, wheel: true, pickable: true }, discard);
            kind = 'wheel';
        }
        hold(el, kind, last);
        return;
    }
    if (special?.kind === 'num') {
        const held = await playSpecial(special, discard); // 0/7 grande surge da carta antes das mãos trocarem
        if (special.stay)
            hold(held, 'num', last); // 7 esperando o alvo: fica parado até a escolha
    }
    if (event?.kind === 'swap') {
        unoSfx.playSwap(); // 7: os leques começam a trocar de lugar
        await swapFlight(last.playerId, event.target);
    } else if (event?.kind === 'rotate') {
        unoSfx.playRotate(); // 0: os leques começam a girar
        await rotateFlight(event.dir);
    }
    if (special && special.kind !== 'num') {
        const held = await playSpecial(special, discard);
        if (special.wheel)
            hold(held, 'wheel', last);
        else if (special.stay) {
            unoState.symbolN = last.n; // o +N fixo da mesa assume o lugar do símbolo animado
            render();
            held?.remove();
        }
    }
    if (last.penalty && last.penalty !== 'skip')
        await drawFlight(last.target, last.drawn, last.drawn, drawnFaces(last.target, last.drawn));
}

// Chamado após cada desenho da mesa: anima só quando a jogada (ou a distribuição) é nova.
function playUnoAnimations(view) {
    if (unoState.animationsStopped) return;
    if (unoState.dealing) {
        unoState.dealing = false;
        animateDeal(view).catch(() => {});
        return;
    }
    const last = view.last;
    if (!last || last.n === unoState.animKey)
        return;
    unoState.animKey = last.n;
    animateLast(last).catch(() => {}).finally(() => {
        // PC: se a pizza clicável não chegou a aparecer, quem escolhe a cor usa o modal (senão ficaria sem como escolher).
        if (directPickMode() && last.awaiting === 'color' && unoState.game?.awaiting?.kind === 'color' && unoState.game.last?.n === last.n
            && !heldEl?.classList.contains('pickable')) {
            unoState.pickFailedN = last.n;
            render();
        }
        // Garante que o leque do bloqueado volte à cor mesmo que a animação tenha falhado no meio.
        if (last.penalty === 'skip')
            setBlockGray({ uid: last.target, n: last.n }, false);
        // Garante que o +N fixo apareça mesmo que a animação tenha sido pulada ou falhado.
        if (unoState.symbolN !== last.n) {
            unoState.symbolN = last.n;
            if (unoState.game?.pending)
                render();
        }
    });
}

export { clearHeld, playUnoAnimations, unoAnimationMs, dealMs, pendingDraws, animateUnoButtonPress, animateUnoDeclaration, stopUnoAnimations, resumeUnoAnimations };
