/** Catálogo de efeitos pertencentes exclusivamente à engine de UNO. */
import { audioService } from '@bardotiao/ui';

const files = {
    draw: new URL('../assets/sfx/comprarcarta.mp3', import.meta.url).href,
    play: [
        new URL('../assets/sfx/jogarcartanomonte1.mp3', import.meta.url).href,
        new URL('../assets/sfx/jogarcartanomonte2.mp3', import.meta.url).href,
    ],
    turn: new URL('../assets/sfx/vezdojogador.mp3', import.meta.url).href,
    jump: new URL('../assets/sfx/intrometidojump.mp3', import.meta.url).href,
    jumpTimer: new URL('../assets/sfx/jumpinsomdocronometrobarraamarela.mp3', import.meta.url).href,
    jumpTimerEnd: new URL('../assets/sfx/somdocronometrobarraamarelaaposficarcheia.mp3', import.meta.url).href,
    uno: new URL('../assets/sfx/somdechamadadeuno.mp3', import.meta.url).href,
    swap: new URL('../assets/sfx/trocadeleques-carta7.mp3', import.meta.url).href,
    rotate: new URL('../assets/sfx/cartassendogiradas-carta0.mp3', import.meta.url).href,
    challenge: new URL('../assets/sfx/barulhodedesafio.mp3', import.meta.url).href,
    challengeLost: new URL('../assets/sfx/desafioperdido.mp3', import.meta.url).href,
    challengeWon: new URL('../assets/sfx/desafioganho.mp3', import.meta.url).href,
    unoPress: new URL('../assets/sfx/barulhodeapertarobotaodouno.mp3', import.meta.url).href,
    unoReport: new URL('../assets/sfx/barulhodereportarogritouno.mp3', import.meta.url).href,
    blockGray: new URL('../assets/sfx/bloqueiodeixandoascartasdolequecinzas.mp3', import.meta.url).href,
    // Antes: cartadecormais4trocandoacornomonte.mp3 (arquivo mantido na pasta; trocado pelo som abaixo).
    wild4Color: new URL('../assets/sfx/cormais4selecionada.mp3', import.meta.url).href,
    wheelBack: new URL('../assets/sfx/pizzacoloridavoltandoparaobaralho.mp3', import.meta.url).href,
    cardClick: new URL('../assets/sfx/apertarnacartaparajogar.mp3', import.meta.url).href,
    decision: new URL('../assets/sfx/desafiar-comprar.mp3', import.meta.url).href,
    hover: new URL('../assets/sfx/hoverdomousesobreobaralho.mp3', import.meta.url).href,
    option: new URL('../assets/sfx/selecionaropcao.mp3', import.meta.url).href,
    targetPicked: new URL('../assets/sfx/monteselecionado-carta7.mp3', import.meta.url).href,
    plusFly: new URL('../assets/sfx/numeromaisnindoateoleque.mp3', import.meta.url).href,
    unoCancel: new URL('../assets/sfx/somdeunocancelado.mp3', import.meta.url).href,
};

// Trilha sonora de fundo (música, em loop, mais baixa que os efeitos).
const MUSIC_SRC = new URL('../assets/music/hanginoutuno.mp3', import.meta.url).href;
const MUSIC_VOLUME = 0.3;

// Som de cada carta especial jogada no monte (toca junto com o som genérico de jogar; chave = valor da carta, v).
const specialPlay = {
    draw2: new URL('../assets/sfx/cartamais2jogadanomonte.mp3', import.meta.url).href,
    wild4: new URL('../assets/sfx/cartamais4jogadanomonte.mp3', import.meta.url).href,
    0: new URL('../assets/sfx/carta0jogadanomonte.mp3', import.meta.url).href,
    7: new URL('../assets/sfx/carta7jogadanomonte.mp3', import.meta.url).href,
    skip: new URL('../assets/sfx/cartabloqueiojogadanomonte.mp3', import.meta.url).href,
    reverse: new URL('../assets/sfx/cartainvertesentidojogadanomonte.mp3', import.meta.url).href,
    wild: new URL('../assets/sfx/cartatrocacorjogadanomonte.mp3', import.meta.url).href,
};

const NO_HANDLE = { started: Promise.resolve(false), stop() {} };

// Som é opcional: qualquer falha aqui é engolida, para nunca interromper animação ou jogada.
function safe(run, fallback) {
    try {
        return run();
    } catch {
        return fallback;
    }
}

function playDraw() { return safe(() => audioService.play(files.draw), undefined); }
function playCard() { return safe(() => audioService.play(files.play[Math.floor(Math.random() * files.play.length)]), undefined); }
function playTurn() { return safe(() => audioService.play(files.turn), undefined); }
function playJump() { return safe(() => audioService.play(files.jump), undefined); }
// Toca uma única vez, esticado/encolhido para durar exatamente o mesmo tempo que a barra amarela leva para encher (durationMs).
function playJumpTimer(durationMs) { return safe(() => audioService.playHandle(files.jumpTimer, { fitMs: durationMs }), NO_HANDLE); }
function playJumpTimerEnd() { return safe(() => audioService.play(files.jumpTimerEnd), undefined); }
// Carta com som próprio ao pousar no monte?
function hasCardSfx(card) { return Boolean(card && Object.hasOwn(specialPlay, card.v)); }
function playCardSpecial(card) { return hasCardSfx(card) ? safe(() => audioService.play(specialPlay[card.v]), undefined) : undefined; }
function playSwap() { return safe(() => audioService.play(files.swap), undefined); }
function playRotate() { return safe(() => audioService.play(files.rotate), undefined); }
function playUno() { return safe(() => audioService.play(files.uno), undefined); }
function playUnoPress() { return safe(() => audioService.play(files.unoPress), undefined); }
function playUnoReport() { return safe(() => audioService.play(files.unoReport), undefined); }
function playWheelBack() { return safe(() => audioService.play(files.wheelBack), undefined); }
function playCardClick() { return safe(() => audioService.play(files.cardClick), undefined); }
function playDecision() { return safe(() => audioService.play(files.decision), undefined); }
function playHover() { return safe(() => audioService.play(files.hover), undefined); }
function playOption() { return safe(() => audioService.play(files.option), undefined); }
function playBlockGray() { return safe(() => audioService.play(files.blockGray), undefined); }
function playWild4Color() { return safe(() => audioService.play(files.wild4Color), undefined); }
function playTargetPicked() { return safe(() => audioService.play(files.targetPicked), undefined); }
function playPlusFly() { return safe(() => audioService.play(files.plusFly), undefined); }
function playUnoCancel() { return safe(() => audioService.play(files.unoCancel), undefined); }
function playChallenge() { return safe(() => audioService.play(files.challenge), undefined); }
function playChallengeLost() { return safe(() => audioService.play(files.challengeLost), undefined); }
function playChallengeWon() { return safe(() => audioService.play(files.challengeWon), undefined); }

// ---- Trilha sonora ----------------------------------------------------------------------------------------
// Uma única instância em loop. Se o navegador bloquear o início (política de autoplay), tenta de novo no próximo toque/tecla.
let musicHandle = null;
let musicRetry = null;

function clearMusicRetry() {
    if (!musicRetry)
        return;
    document.removeEventListener('pointerdown', musicRetry);
    document.removeEventListener('keydown', musicRetry);
    musicRetry = null;
}

function startMusic() {
    if (musicHandle)
        return;
    const handle = safe(() => audioService.playHandle(MUSIC_SRC, { loop: true, volume: MUSIC_VOLUME, channel: 'music' }), NO_HANDLE);
    musicHandle = handle;
    handle.started.then((ok) => {
        if (ok || musicHandle !== handle)
            return;
        // Bloqueada pelo navegador: libera o slot e espera uma interação do jogador.
        musicHandle = null;
        clearMusicRetry();
        musicRetry = () => {
            clearMusicRetry();
            startMusic();
        };
        document.addEventListener('pointerdown', musicRetry, { once: true });
        document.addEventListener('keydown', musicRetry, { once: true });
    });
}

function stopMusic() {
    clearMusicRetry();
    const handle = musicHandle;
    musicHandle = null;
    safe(() => handle?.stop(), undefined);
}

export const unoSfx = { playDraw, playCard, hasCardSfx, playCardSpecial, playSwap, playRotate, playTurn, playJump, playJumpTimer, playJumpTimerEnd, playUno, playChallenge, playChallengeLost, playChallengeWon, playUnoPress, playUnoReport, playBlockGray, playWild4Color, playWheelBack, playCardClick, playDecision, playHover, playOption, playTargetPicked, playPlusFly, playUnoCancel, startMusic, stopMusic };
