/**
 * ============================================================================
 * Brasil Vivo - Aventura 2D com Lula
 * game.js - Motor do jogo, física, colisões na mata fechada, coleta de
 *           10 constituições, guarda de névoa (FlavioB), etapa Recuperar
 *           Democracia (palanques, bandeiras, restauração gradual, pombos
 *           voando e ratos na Paulista), vitória, derrota, reinício e pausa
 * Baseado em AGENTS.md | Zero dependências externas (Vanilla JS + HTML5 Canvas)
 * ============================================================================
 */

(function () {
  'use strict';

  // --- Constantes do Mundo e Canvas (Coordenadas Lógicas + Super-Resolução HiDPI) ---
  const CANVAS_WIDTH = 960;
  const CANVAS_HEIGHT = 540;
  let renderScale = 2; // Escala física mínima 2x (1920x1080) ou maior em telas Retina/4K
  const TOTAL_CONSTITUTIONS = 10;
  const CONSTITUTION_RADIUS = 14;
  const PODIUM_RADIUS = 22;
  const MISSION_TEXT = 'Resgate dez constituições para devolver a democracia ao Brasil';
  const VICTORY_TEXT = 'Resgate concluído';
  const DEFEAT_TEXT = 'O fascismo alcançou você';
  const REVIVAL_TEXT = 'O Brasil voltando à vida';

  // Estados do Jogo
  const STATE_READY = 'READY';
  const STATE_PLAYING = 'PLAYING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_VICTORY = 'VICTORY';
  const STATE_DEFEAT = 'DEFEAT';

  // --- Elementos do DOM ---
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas ? canvas.getContext('2d') : null;
  const btnStart = document.getElementById('btn-start');
  const btnRecover = document.getElementById('btn-recover');
  const btnPlant = document.getElementById('btn-plant');
  const btnPause = document.getElementById('btn-pause');
  const btnReset = document.getElementById('btn-reset');
  const pauseIcon = document.getElementById('pause-icon');
  const pauseLabel = document.getElementById('pause-label');
  const counterLabelEl = document.getElementById('counter-label');
  const counterEl = document.getElementById('constitution-counter');
  const reserveIndicatorEl = document.getElementById('reserve-indicator');
  const reserveCounterEl = document.getElementById('reserve-counter');
  const missionBannerEl = document.getElementById('mission-banner');
  const zoneNameEl = document.getElementById('zone-name');
  const stateTextEl = document.getElementById('state-text');
  const srAlerts = document.getElementById('screen-reader-alerts');

  // D-Pad Touch Buttons
  const touchButtons = {
    up: document.getElementById('touch-up'),
    down: document.getElementById('touch-down'),
    left: document.getElementById('touch-left'),
    right: document.getElementById('touch-right')
  };

  // --- Geometria das Áreas Transitáveis (cercadas por Mata Fechada intransponível) ---
  // 1. Senado (Oeste)
  // 2. Túnel (Centro)
  // 3. Avenida Paulista (Leste)
  const LAND_REGIONS = [
    // Senado: retângulo arredondado à esquerda
    { x1: 50, y1: 55, x2: 410, y2: 485, radius: 35, type: 'senado' },
    // Túnel: corredor amplo conectando Senado e Avenida Paulista
    { x1: 370, y1: 175, x2: 590, y2: 365, radius: 20, type: 'tunel' },
    // Avenida Paulista: retângulo arredondado à direita
    { x1: 550, y1: 55, x2: 910, y2: 485, radius: 35, type: 'paulista' }
  ];

  /**
   * Configura a resolução física do Canvas em Alta Definição (Full HD / Retina HiDPI)
   * sem alterar o sistema de coordenadas lógicas (960x540) do jogo.
   */
  function setupHighResCanvas() {
    if (!canvas) return;
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 2;
    renderScale = Math.min(3, Math.max(2, dpr));
    const targetW = Math.round(CANVAS_WIDTH * renderScale);
    const targetH = Math.round(CANVAS_HEIGHT * renderScale);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    }
  }

  // --- Copas de Árvores da Mata Fechada com Galhos Secos (devastado) e Folhas (restaurado) ---
  const DENSE_FOREST_TREES = [];
  (function generateDenseForest() {
    const rows = 14;
    const cols = 24;
    const palette = ['#064e3b', '#14532d', '#166534', '#15803d', '#114224', '#0f391e'];
    const leafColors = ['#22c55e', '#4ade80', '#16a34a', '#86efac', '#15803d'];

    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) {
        const tx = c * 42 + ((r % 2) * 18) - 10;
        const ty = r * 40 + ((c % 3) * 8) - 5;
        const inSenado = tx > 42 && tx < 418 && ty > 48 && ty < 492;
        const inTunel = tx > 365 && tx < 595 && ty > 165 && ty < 375;
        const inPaulista = tx > 542 && tx < 918 && ty > 48 && ty < 492;
        if (!inSenado && !inTunel && !inPaulista) {
          const radius = 22 + ((r * 7 + c * 13) % 12);
          const color = palette[(r * 3 + c * 5) % palette.length];
          const highlight = (r + c) % 2 === 0 ? '#22c55e' : '#16a34a';

          // Lóbulos orgânicos da copa
          const lobes = [];
          for (let l = 0; l < 5; l++) {
            const ang = (l * 2 * Math.PI) / 5 + ((r + c) % 3) * 0.3;
            lobes.push({
              ox: Math.cos(ang) * (radius * 0.48),
              oy: Math.sin(ang) * (radius * 0.48),
              lr: radius * (0.58 + (l % 2) * 0.1)
            });
          }

          // Folhas individuais detalhadas na copa
          const leaves = [];
          const leafCount = 6;
          for (let k = 0; k < leafCount; k++) {
            const lang = (k * 2 * Math.PI) / leafCount + (r * 0.4 + c * 0.2);
            const dist = radius * (0.25 + (k % 3) * 0.22);
            leaves.push({
              lx: Math.cos(lang) * dist,
              ly: Math.sin(lang) * dist,
              rot: lang + 0.5,
              len: 6 + (k % 2) * 2.5,
              wid: 3 + (k % 2) * 1,
              lcol: leafColors[(r + c + k) % leafColors.length]
            });
          }

          DENSE_FOREST_TREES.push({
            x: tx,
            y: ty,
            r: radius,
            color,
            highlight,
            phase: (r + c) * 0.7,
            lobes,
            leaves,
            reviveThreshold: ((r * 5 + c * 9) % 10) / 10 // Ordem em que ganha folhas de 1 a 10 bandeiras
          });
        }
      }
    }
  })();

  // --- Posições das 10 Constituições (4 no Senado + 6 na Avenida Paulista) ---
  const INITIAL_CONSTITUTIONS = [
    // 4 no Senado (Oeste: x entre 50 e 410)
    { id: 1, x: 110, y: 145, zone: 'senado' },
    { id: 2, x: 325, y: 145, zone: 'senado' },
    { id: 3, x: 110, y: 400, zone: 'senado' },
    { id: 4, x: 325, y: 400, zone: 'senado' },
    // 6 na Avenida Paulista (Leste: x entre 550 e 910)
    { id: 5, x: 630, y: 135, zone: 'paulista' },
    { id: 6, x: 760, y: 185, zone: 'paulista' },
    { id: 7, x: 850, y: 135, zone: 'paulista' },
    { id: 8, x: 630, y: 405, zone: 'paulista' },
    { id: 9, x: 760, y: 355, zone: 'paulista' },
    { id: 10, x: 850, y: 405, zone: 'paulista' }
  ];

  // --- Palanques espalhados pelo Senado e pela Avenida Paulista (Etapa Recuperar Democracia) ---
  // Mais de 10 palanques (14 ao todo: 6 no Senado e 8 na Paulista) para livre distribuição
  const INITIAL_PODIUMS = [
    // 6 Palanques no Senado
    { id: 1, x: 115, y: 155, zone: 'senado' },
    { id: 2, x: 320, y: 155, zone: 'senado' },
    { id: 3, x: 115, y: 270, zone: 'senado' },
    { id: 4, x: 320, y: 270, zone: 'senado' },
    { id: 5, x: 115, y: 395, zone: 'senado' },
    { id: 6, x: 320, y: 395, zone: 'senado' },
    // 8 Palanques na Avenida Paulista
    { id: 7, x: 615, y: 135, zone: 'paulista' },
    { id: 8, x: 730, y: 135, zone: 'paulista' },
    { id: 9, x: 845, y: 135, zone: 'paulista' },
    { id: 10, x: 615, y: 270, zone: 'paulista' },
    { id: 11, x: 790, y: 270, zone: 'paulista' },
    { id: 12, x: 615, y: 405, zone: 'paulista' },
    { id: 13, x: 730, y: 405, zone: 'paulista' },
    { id: 14, x: 845, y: 405, zone: 'paulista' }
  ];

  // --- Vida Nova na Paulista: Pombos Voando e Ratos ---
  const PIGEONS = [
    { cx: 690, cy: 150, rx: 45, ry: 25, speed: 1.4, phase: 0.0 },
    { cx: 775, cy: 220, rx: 52, ry: 30, speed: 1.2, phase: 1.1 },
    { cx: 680, cy: 310, rx: 48, ry: 26, speed: 1.5, phase: 2.3 },
    { cx: 790, cy: 380, rx: 42, ry: 24, speed: 1.3, phase: 3.5 },
    { cx: 730, cy: 115, rx: 55, ry: 20, speed: 1.6, phase: 4.2 },
    { cx: 835, cy: 190, rx: 36, ry: 28, speed: 1.35, phase: 5.0 },
    { cx: 640, cy: 230, rx: 38, ry: 22, speed: 1.45, phase: 0.7 },
    { cx: 735, cy: 435, rx: 50, ry: 20, speed: 1.25, phase: 2.9 },
    { cx: 840, cy: 345, rx: 36, ry: 24, speed: 1.55, phase: 1.8 },
    { cx: 725, cy: 265, rx: 60, ry: 35, speed: 1.15, phase: 3.9 }
  ];

  const RATS = [
    { x: 642, minY: 110, maxY: 230, y: 140, speed: 55, dir: 1, phase: 0.2 },
    { x: 814, minY: 120, maxY: 250, y: 200, speed: 62, dir: -1, phase: 1.5 },
    { x: 642, minY: 290, maxY: 430, y: 340, speed: 58, dir: 1, phase: 2.8 },
    { x: 814, minY: 310, maxY: 445, y: 390, speed: 50, dir: -1, phase: 0.9 },
    { x: 590, minY: 170, maxY: 310, y: 240, speed: 48, dir: 1, phase: 3.4 },
    { x: 865, minY: 345, maxY: 440, y: 365, speed: 54, dir: 1, phase: 4.1 }
  ];

  // --- Configuração Inicial do Guarda de Névoa (FlavioB) ---
  const INITIAL_GUARD = {
    name: 'FlavioB',
    active: true,
    fixedX: 730,
    x: 730,
    y: 140,
    minY: 140,
    maxY: 400,
    radius: 18,
    speed: 120,
    dirX: 0,
    dirY: 1,       // 1 = descendo (sul), -1 = subindo (norte)
    facing: 'down',
    walkCycle: 0
  };

  // --- Estado do Jogo ---
  let gameState = STATE_READY;
  let inRecoveryStage = false; // true após clicar em "Recuperar Democracia"
  let pauseReason = '';
  let lastTimestamp = 0;
  let waveTimer = 0;
  let currentZone = 'senado';
  let collectedCount = 0;
  let reserveCount = 0;
  let flagsPlaced = 0;
  let animationLoopStarted = false;
  let lastPlantTimestamp = 0;

  // Lista ativa de constituições, palanques e efeitos visuais de brilho breve
  const constitutions = INITIAL_CONSTITUTIONS.map(item => ({
    ...item,
    radius: CONSTITUTION_RADIUS,
    collected: false
  }));

  const podiums = INITIAL_PODIUMS.map(p => ({
    ...p,
    radius: PODIUM_RADIUS,
    flags: 0,
    hasFlag: false
  }));

  const sparkles = [];

  // --- Protagonista: Lula (senhor de ~80 anos com maleta em uma mão e bengala na outra) ---
  const lula = {
    x: 180,           // Posição inicial no Senado
    y: 270,
    radius: 18,       // Raio do corpo (usado para colisão precisa contra a mata fechada)
    speed: 210,       // Pixels por segundo (maior que a velocidade do guarda FlavioB)
    facing: 'right',  // 'up', 'down', 'left', 'right'
    isMoving: false,
    walkCycle: 0      // Para animação de passos, bengala e maleta
  };
  const lia = lula;

  // --- Guarda de Névoa: FlavioB ---
  const guard = { ...INITIAL_GUARD };
  const flavio = guard;

  // --- Estado dos Controles ---
  const input = {
    up: false,
    down: false,
    left: false,
    right: false
  };

  /**
   * Nível de restauração ecológica e urbana (0.0 = totalmente devastado, 1.0 = 10 bandeiras colocadas)
   */
  function getRestorationProgress() {
    return Math.min(1, Math.max(0, flagsPlaced / TOTAL_CONSTITUTIONS));
  }

  /**
   * Comunicação Acessível (Leitor de Tela)
   */
  function announceScreenReader(message) {
    if (!srAlerts) return;
    srAlerts.textContent = '';
    setTimeout(() => {
      srAlerts.textContent = message;
    }, 50);
  }

  /**
   * Atualiza o contador visual de constituições / bandeiras e a reserva no DOM
   */
  function updateCounterDisplay() {
    if (inRecoveryStage) {
      if (counterLabelEl) counterLabelEl.textContent = '🇧🇷 Bandeiras:';
      if (counterEl) counterEl.textContent = `${flagsPlaced}/${TOTAL_CONSTITUTIONS}`;
      if (reserveIndicatorEl) reserveIndicatorEl.hidden = false;
      if (reserveCounterEl) reserveCounterEl.textContent = `${reserveCount}`;
    } else {
      if (counterLabelEl) counterLabelEl.textContent = '📜 Constituições:';
      if (counterEl) counterEl.textContent = `${collectedCount}/${TOTAL_CONSTITUTIONS}`;
      if (reserveIndicatorEl) reserveIndicatorEl.hidden = true;
      if (reserveCounterEl) reserveCounterEl.textContent = `${reserveCount}`;
    }
  }

  /**
   * Verifica se um ponto (px, py) está dentro de um retângulo com cantos arredondados
   */
  function isPointInRoundedRect(px, py, rect) {
    const { x1, y1, x2, y2, radius } = rect;
    if (px < x1 || px > x2 || py < y1 || py > y2) return false;

    if (px >= x1 + radius && px <= x2 - radius) return true;
    if (py >= y1 + radius && py <= y2 - radius) return true;

    const checkCorner = (cx, cy) => {
      const dx = px - cx;
      const dy = py - cy;
      return (dx * dx + dy * dy) <= (radius * radius);
    };

    if (px < x1 + radius && py < y1 + radius) return checkCorner(x1 + radius, y1 + radius);
    if (px > x2 - radius && py < y1 + radius) return checkCorner(x2 - radius, y1 + radius);
    if (px < x1 + radius && py > y2 - radius) return checkCorner(x1 + radius, y2 - radius);
    if (px > x2 - radius && py > y2 - radius) return checkCorner(x2 - radius, y2 - radius);

    return true;
  }

  /**
   * Verifica se um determinado ponto está na área transitável (fora da mata fechada)
   */
  function isPointOnLand(px, py) {
    for (let i = 0; i < LAND_REGIONS.length; i++) {
      if (isPointInRoundedRect(px, py, LAND_REGIONS[i])) {
        return true;
      }
    }
    return false;
  }

  /**
   * Verifica se o corpo INTEIRO do personagem está dentro da área transitável
   * (impede entrar na mata fechada ao redor).
   */
  function isBodyEntirelyOnLand(cx, cy, radius) {
    if (!isPointOnLand(cx, cy)) return false;

    const samples = 16;
    for (let i = 0; i < samples; i++) {
      const angle = (i * 2 * Math.PI) / samples;
      const px = cx + Math.cos(angle) * radius;
      const py = cy + Math.sin(angle) * radius;
      if (!isPointOnLand(px, py)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Determina em qual ambiente Lula está localizado no momento (sem parênteses)
   */
  function updateCurrentZone() {
    let newZone = 'senado';
    let zoneLabel = '🏛️ Senado';

    if (lula.x < 375) {
      newZone = 'senado';
      zoneLabel = '🏛️ Senado';
    } else if (lula.x >= 375 && lula.x <= 585) {
      newZone = 'tunel';
      zoneLabel = '🚇 Túnel';
    } else {
      newZone = 'paulista';
      zoneLabel = '🏙️ Avenida Paulista';
    }

    if (newZone !== currentZone) {
      currentZone = newZone;
      if (zoneNameEl) zoneNameEl.textContent = zoneLabel;
      announceScreenReader(`Lula entrou em: ${zoneLabel}`);
    }
  }

  /**
   * Retorna o palanque mais próximo em que Lula está tocando no momento (ou null)
   */
  function getTouchedPodium() {
    if (!inRecoveryStage) return null;
    let closest = null;
    let minDist = Infinity;

    for (let i = 0; i < podiums.length; i++) {
      const p = podiums[i];
      const dist = Math.hypot(lula.x - p.x, lula.y - p.y);
      if (dist <= lula.radius + p.radius + 8 && dist < minDist) {
        minDist = dist;
        closest = p;
      }
    }
    return closest;
  }

  /**
   * Atualiza o estado visual do botão "Colocar Bandeira (E)" conforme proximidade do palanque e reserva
   */
  function updatePlantButtonState() {
    if (!btnPlant) return;
    if (!inRecoveryStage) {
      btnPlant.hidden = true;
      btnPlant.disabled = true;
      return;
    }
    btnPlant.hidden = false;
    const touched = getTouchedPodium();
    btnPlant.disabled = (gameState !== STATE_PLAYING || reserveCount <= 0 || !touched);
  }

  /**
   * Aciona o palanque em que o jogador está tocando (por clique, toque ou tecla E).
   * Gasta exatamente UMA constituição da reserva por ação e mostra uma bandeira.
   * Quando a reserva zerar, impede novas colocações de bandeiras.
   */
  function placeFlag() {
    // A colocação de bandeiras só existe na etapa Recuperar Democracia e com partida em andamento
    if (!inRecoveryStage || gameState !== STATE_PLAYING) return false;

    // Quando a reserva zerar, impede novas colocações
    if (reserveCount <= 0) {
      updatePlantButtonState();
      return false;
    }

    const touched = getTouchedPodium();
    if (!touched) return false;

    // Gasta exatamente UMA constituição e coloca UMA bandeira
    reserveCount -= 1;
    flagsPlaced += 1;
    touched.flags += 1;
    touched.hasFlag = true;

    updateCounterDisplay();
    updatePlantButtonState();

    // Brilho celebrativo no local do palanque
    sparkles.push({
      x: touched.x,
      y: touched.y,
      age: 0,
      duration: 0.75,
      isFlag: true
    });

    if (missionBannerEl) {
      missionBannerEl.textContent = REVIVAL_TEXT;
    }

    if (reserveCount === 0) {
      if (stateTextEl) stateTextEl.textContent = `🌱 ${REVIVAL_TEXT}`;
      announceScreenReader(`${REVIVAL_TEXT}! Todas as dez bandeiras foram colocadas.`);
    } else {
      if (stateTextEl) stateTextEl.textContent = `🌱 ${REVIVAL_TEXT} (${flagsPlaced}/${TOTAL_CONSTITUTIONS})`;
      announceScreenReader(`Bandeira colocada! ${REVIVAL_TEXT}. Reserva restante: ${reserveCount}.`);
    }

    return true;
  }

  /**
   * Verifica toque de Lula nas constituições disponíveis (apenas na Fase de Resgate).
   */
  function checkConstitutionCollections() {
    if (gameState !== STATE_PLAYING || inRecoveryStage) return;

    for (let i = 0; i < constitutions.length; i++) {
      const item = constitutions[i];
      if (item.collected) continue;

      const dx = lula.x - item.x;
      const dy = lula.y - item.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= lula.radius + item.radius) {
        item.collected = true;
        collectedCount += 1;
        updateCounterDisplay();

        sparkles.push({
          x: item.x,
          y: item.y,
          age: 0,
          duration: 0.65,
          isFlag: false
        });

        if (collectedCount >= TOTAL_CONSTITUTIONS) {
          completeRescue();
          break;
        } else {
          announceScreenReader(`Constituição resgatada! ${collectedCount} de ${TOTAL_CONSTITUTIONS}.`);
        }
      }
    }
  }

  /**
   * Verifica contato físico entre Lula e o guarda de névoa FlavioB.
   * Só ocorre durante a fase de resgate (na etapa Recuperar Democracia não há perigo).
   */
  function checkGuardCollision() {
    if (gameState !== STATE_PLAYING || inRecoveryStage || !guard.active) return false;

    const dx = lula.x - guard.x;
    const dy = lula.y - guard.y;
    const dist = Math.hypot(dx, dy);

    if (dist <= lula.radius + guard.radius) {
      triggerDefeat();
      return true;
    }
    return false;
  }

  /**
   * Atualiza o movimento de patrulha em linha fixa do guarda de névoa (FlavioB).
   */
  function updateGuard(dt) {
    if (gameState !== STATE_PLAYING || inRecoveryStage || !guard.active) return;
    if (dt <= 0) return;

    guard.x = guard.fixedX;
    guard.y += guard.dirY * guard.speed * dt;

    if (guard.y >= guard.maxY) {
      guard.y = guard.maxY;
      guard.dirY = -1;
      guard.facing = 'up';
    } else if (guard.y <= guard.minY) {
      guard.y = guard.minY;
      guard.dirY = 1;
      guard.facing = 'down';
    }

    guard.walkCycle += dt * 7;
    checkGuardCollision();
  }

  /**
   * Atualiza o movimento dos ratos na Avenida Paulista quando há bandeiras colocadas
   */
  function updateWildlife(dt) {
    if (gameState !== STATE_PLAYING || flagsPlaced <= 0 || dt <= 0) return;

    for (let i = 0; i < RATS.length; i++) {
      const rat = RATS[i];
      rat.y += rat.dir * rat.speed * dt;
      if (rat.y >= rat.maxY) {
        rat.y = rat.maxY;
        rat.dir = -1;
      } else if (rat.y <= rat.minY) {
        rat.y = rat.minY;
        rat.dir = 1;
      }
    }
  }

  /**
   * Atualiza os efeitos de brilho breve das coletas e bandeiras
   */
  function updateSparkles(dt) {
    for (let i = sparkles.length - 1; i >= 0; i--) {
      sparkles[i].age += dt;
      if (sparkles[i].age >= sparkles[i].duration) {
        sparkles.splice(i, 1);
      }
    }
  }

  /**
   * Ao completar 10/10 coletas, inicia automaticamente a etapa de colocação de bandeiras
   * sem precisar clicar em nenhum botão.
   */
  function completeRescue() {
    startRecoveryPhase();
  }

  /**
   * Inicia a etapa "Recuperar Democracia" automaticamente ao vencer o resgate com 10 coletas.
   * Etapa sem perigo (sem guarda), com 10 constituições na reserva e vários palanques no Senado e na Paulista.
   */
  function startRecoveryPhase() {
    if (collectedCount < TOTAL_CONSTITUTIONS) return false;

    inRecoveryStage = true;
    gameState = STATE_PLAYING;
    pauseReason = '';
    lastTimestamp = 0;

    // Etapa sem perigo: desativa o guarda FlavioB imediatamente
    guard.active = false;

    // 10 constituições na reserva e 0 bandeiras colocadas inicialmente
    reserveCount = TOTAL_CONSTITUTIONS;
    flagsPlaced = 0;
    for (let i = 0; i < podiums.length; i++) {
      podiums[i].flags = 0;
      podiums[i].hasFlag = false;
    }

    if (btnRecover) {
      btnRecover.hidden = true;
      btnRecover.disabled = true;
    }
    if (btnStart) btnStart.disabled = true;
    if (btnPause) {
      btnPause.disabled = false;
      btnPause.setAttribute('aria-label', 'Pausar o jogo');
    }
    if (pauseIcon) pauseIcon.textContent = '⏸';
    if (pauseLabel) pauseLabel.textContent = 'Pausar';

    updateCounterDisplay();
    updatePlantButtonState();

    if (stateTextEl) stateTextEl.textContent = `🏆 ${VICTORY_TEXT} — 🌱 Coloque as 10 bandeiras!`;
    announceScreenReader(`${VICTORY_TEXT}! Você tem 10 constituições na reserva. Encoste em um palanque e pressione E, clique ou toque para colocar uma bandeira.`);
    return true;
  }

  /**
   * Aciona o estado de derrota quando o guarda FlavioB alcança Lula
   */
  function triggerDefeat() {
    gameState = STATE_DEFEAT;
    pauseReason = '';
    lula.isMoving = false;
    lula.walkCycle = 0;
    input.up = false;
    input.down = false;
    input.left = false;
    input.right = false;

    if (btnStart) btnStart.disabled = true;
    if (btnPause) btnPause.disabled = true;
    if (stateTextEl) stateTextEl.textContent = `⚠️ ${DEFEAT_TEXT}`;
    announceScreenReader(`${DEFEAT_TEXT}. Clique em Reiniciar para tentar novamente.`);
  }

  /**
   * Movimentação de Lula com resolução de colisão por eixo
   */
  function updatePlayer(dt) {
    if (gameState !== STATE_PLAYING) return;

    let moveX = 0;
    let moveY = 0;

    if (input.left) moveX -= 1;
    if (input.right) moveX += 1;
    if (input.up) moveY -= 1;
    if (input.down) moveY += 1;

    lula.isMoving = (moveX !== 0 || moveY !== 0);

    if (lula.isMoving && dt > 0) {
      if (moveX !== 0 && moveY !== 0) {
        const factor = 1 / Math.SQRT2;
        moveX *= factor;
        moveY *= factor;
      }

      if (Math.abs(moveX) > Math.abs(moveY)) {
        lula.facing = moveX > 0 ? 'right' : 'left';
      } else if (Math.abs(moveY) > 0) {
        lula.facing = moveY > 0 ? 'down' : 'up';
      }

      const stepX = moveX * lula.speed * dt;
      const stepY = moveY * lula.speed * dt;

      if (stepX !== 0) {
        const targetX = lula.x + stepX;
        if (isBodyEntirelyOnLand(targetX, lula.y, lula.radius)) {
          lula.x = targetX;
        }
      }

      if (stepY !== 0) {
        const targetY = lula.y + stepY;
        if (isBodyEntirelyOnLand(lula.x, targetY, lula.radius)) {
          lula.y = targetY;
        }
      }

      lula.walkCycle += dt * 9;
      updateCurrentZone();
    } else if (!lula.isMoving) {
      lula.walkCycle = 0;
    }

    if (inRecoveryStage) {
      updatePlantButtonState();
    } else if (!checkGuardCollision()) {
      checkConstitutionCollections();
    }
  }

  // ==========================================================================
  // Renderização Visual no Canvas (Devastação Inicial -> Restauração Gradual)
  // ==========================================================================

  /**
   * Desenha o solo da Mata Fechada:
   * - Em 0 bandeiras: solo queimado, cinzas e vegetação devastada.
   * - De 1 a 10 bandeiras: recupera gradualmente o verde profundo da mata.
   */
  function drawDenseForestFloor() {
    const progress = getRestorationProgress();

    // Base queimada/devastada (carvão e terra seca)
    const burnedGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    burnedGrad.addColorStop(0, '#1c130d');
    burnedGrad.addColorStop(0.5, '#261a11');
    burnedGrad.addColorStop(1, '#140e09');
    ctx.fillStyle = burnedGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Manchas de cinzas e vegetação queimada
    ctx.fillStyle = 'rgba(68, 51, 38, 0.45)';
    for (let y = 15; y < CANVAS_HEIGHT; y += 36) {
      for (let x = 15; x < CANVAS_WIDTH; x += 44) {
        ctx.beginPath();
        ctx.arc(x + (y % 18), y, 15, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Camada verde restaurada proporcional às bandeiras colocadas
    if (progress > 0) {
      ctx.save();
      ctx.globalAlpha = progress;
      const forestGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      forestGrad.addColorStop(0, '#071f10');
      forestGrad.addColorStop(0.5, '#0a2915');
      forestGrad.addColorStop(1, '#05180c');
      ctx.fillStyle = forestGrad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.fillStyle = 'rgba(20, 83, 45, 0.55)';
      for (let y = 15; y < CANVAS_HEIGHT; y += 36) {
        for (let x = 15; x < CANVAS_WIDTH; x += 44) {
          ctx.beginPath();
          ctx.arc(x + (y % 18), y, 16, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  /**
   * Cria o caminho composto das áreas transitáveis no contexto 2D
   */
  function createWalkablePath(offset = 0) {
    ctx.beginPath();
    LAND_REGIONS.forEach(reg => {
      const x1 = reg.x1 - offset;
      const y1 = reg.y1 - offset;
      const w = (reg.x2 - reg.x1) + offset * 2;
      const h = (reg.y2 - reg.y1) + offset * 2;
      const r = Math.max(0, reg.radius + offset);
      ctx.roundRect(x1, y1, w, h, r);
    });
  }

  /**
   * Desenha a borda de contenção ao redor do mapa
   */
  function drawForestBoundary() {
    const progress = getRestorationProgress();
    ctx.save();
    ctx.fillStyle = 'rgba(15, 10, 6, 0.78)';
    createWalkablePath(12);
    ctx.fill();

    ctx.strokeStyle = progress > 0.4 ? '#14532d' : '#3f2e21';
    ctx.lineWidth = 10;
    createWalkablePath(5);
    ctx.stroke();

    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3;
    createWalkablePath(1);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Auxiliar para desenhar uma folha detalhada (lâmina + nervura central)
   */
  function drawLeafCluster(cx, cy, leaves, sway) {
    for (let k = 0; k < leaves.length; k++) {
      const lf = leaves[k];
      ctx.save();
      ctx.translate(cx + lf.lx + sway, cy + lf.ly);
      ctx.rotate(lf.rot);

      ctx.fillStyle = lf.lcol;
      ctx.beginPath();
      ctx.ellipse(0, 0, lf.len, lf.wid, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(5, 46, 22, 0.55)';
      ctx.lineWidth = 0.7;
      ctx.stroke();

      ctx.strokeStyle = 'rgba(220, 252, 231, 0.65)';
      ctx.lineWidth = 0.65;
      ctx.beginPath();
      ctx.moveTo(-lf.len * 0.75, 0);
      ctx.lineTo(lf.len * 0.75, 0);
      ctx.stroke();

      ctx.restore();
    }
  }

  /**
   * Auxiliar para desenhar tronco queimado e galhos secos de uma árvore sem folhas (mapa devastado)
   */
  function drawBareTreeBranches(tx, ty, radius, phase) {
    ctx.save();
    ctx.translate(tx, ty);

    // Sombra seca no chão
    ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
    ctx.beginPath();
    ctx.ellipse(2, 4, radius * 0.45, radius * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tronco carbonizado central
    ctx.fillStyle = '#3b2818';
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.24, 0, Math.PI * 2);
    ctx.fill();

    // Galhos secos retorcidos sem folhas
    ctx.strokeStyle = '#4a3525';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    const branchCount = 5;
    for (let b = 0; b < branchCount; b++) {
      const ang = (b * 2 * Math.PI) / branchCount + (phase % 1.2);
      const len = radius * 0.75;
      const bx = Math.cos(ang) * len;
      const by = Math.sin(ang) * len;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(bx, by);
      // Bifurcação fina na ponta do galho seco
      ctx.moveTo(bx * 0.6, by * 0.6);
      ctx.lineTo(bx * 0.6 + Math.cos(ang + 0.5) * (radius * 0.32), by * 0.6 + Math.sin(ang + 0.5) * (radius * 0.32));
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Desenha as árvores da Mata Fechada ao redor:
   * - Em 0 bandeiras: árvores queimadas e sem folhas (apenas galhos secos).
   * - A cada bandeira colocada: as copas e folhas voltam gradualmente a brotar!
   */
  function drawDenseForestCanopies() {
    const progress = getRestorationProgress();
    ctx.save();

    for (let i = 0; i < DENSE_FOREST_TREES.length; i++) {
      const t = DENSE_FOREST_TREES[i];
      const sway = Math.sin(waveTimer * 1.4 + t.phase) * 1.5;

      // Se ainda não atingiu o limiar de restauração desta árvore, desenha os galhos secos
      if (progress <= t.reviveThreshold) {
        drawBareTreeBranches(t.x, t.y, t.r, t.phase);
        continue;
      }

      // Escala de crescimento suave da copa conforme o progresso avança
      const treeGrowth = Math.min(1, 0.45 + (progress - t.reviveThreshold) * 1.6);

      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.scale(treeGrowth, treeGrowth);
      ctx.translate(-t.x, -t.y);

      // 1. Sombra projetada da copa
      ctx.fillStyle = 'rgba(2, 12, 6, 0.55)';
      ctx.beginPath();
      ctx.arc(t.x + 4, t.y + 5, t.r * 1.04, 0, Math.PI * 2);
      ctx.fill();

      // 2. Lóbulos externos da copa
      ctx.fillStyle = t.color;
      if (t.lobes) {
        for (let l = 0; l < t.lobes.length; l++) {
          const lb = t.lobes[l];
          ctx.beginPath();
          ctx.arc(t.x + lb.ox + sway, t.y + lb.oy, lb.lr, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 3. Núcleo principal da copa
      ctx.beginPath();
      ctx.arc(t.x + sway, t.y, t.r * 0.88, 0, Math.PI * 2);
      ctx.fill();

      // 4. Camada superior iluminada
      ctx.fillStyle = t.highlight;
      ctx.globalAlpha = 0.32;
      ctx.beginPath();
      ctx.arc(t.x - t.r * 0.22 + sway, t.y - t.r * 0.22, t.r * 0.58, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;

      // 5. Detalhes de folhas individuais e nervuras
      if (t.leaves) {
        drawLeafCluster(t.x, t.y, t.leaves, sway);
      }

      // 6. Contorno orgânico da copa
      ctx.strokeStyle = 'rgba(5, 25, 12, 0.55)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(t.x + sway, t.y, t.r * 0.92, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }
    ctx.restore();
  }

  /**
   * Desenha a região Oeste: SENADO (inicia com gramado queimado e recupera o verde com as bandeiras)
   */
  function drawSenado() {
    const reg = LAND_REGIONS[0];
    const progress = getRestorationProgress();

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(reg.x1, reg.y1, reg.x2 - reg.x1, reg.y2 - reg.y1, reg.radius);
    ctx.clip();

    const plazaGrad = ctx.createLinearGradient(reg.x1, reg.y1, reg.x2, reg.y2);
    plazaGrad.addColorStop(0, progress > 0.3 ? '#e2e8f0' : '#b8b2a6');
    plazaGrad.addColorStop(0.5, progress > 0.3 ? '#cbd5e1' : '#9c9488');
    plazaGrad.addColorStop(1, '#78716c');
    ctx.fillStyle = plazaGrad;
    ctx.fillRect(reg.x1, reg.y1, reg.x2 - reg.x1, reg.y2 - reg.y1);

    // Gramado central: queimado/seco inicialmente, verdejante conforme coloca bandeiras
    ctx.fillStyle = '#5c4028';
    ctx.beginPath();
    ctx.roundRect(reg.x1 + 45, reg.y1 + 115, reg.x2 - reg.x1 - 90, reg.y2 - reg.y1 - 160, 14);
    ctx.fill();

    if (progress > 0) {
      ctx.save();
      ctx.globalAlpha = progress;
      const lawnGrad = ctx.createLinearGradient(reg.x1, reg.y1 + 110, reg.x1, reg.y2 - 30);
      lawnGrad.addColorStop(0, '#15803d');
      lawnGrad.addColorStop(1, '#166534');
      ctx.fillStyle = lawnGrad;
      ctx.beginPath();
      ctx.roundRect(reg.x1 + 45, reg.y1 + 115, reg.x2 - reg.x1 - 90, reg.y2 - reg.y1 - 160, 14);
      ctx.fill();
      ctx.restore();
    }

    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(reg.x1 + 45, reg.y1 + 115, reg.x2 - reg.x1 - 90, reg.y2 - reg.y1 - 160, 14);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(71, 85, 105, 0.25)';
    ctx.lineWidth = 1.5;
    for (let y = reg.y1 + 20; y < reg.y2; y += 28) {
      ctx.beginPath();
      ctx.moveTo(reg.x1, y);
      ctx.lineTo(reg.x2, y);
      ctx.stroke();
    }

    ctx.fillStyle = '#991b1b';
    ctx.fillRect(212, reg.y1 + 115, 36, reg.y2 - reg.y1 - 160);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(212, reg.y1 + 115, 36, reg.y2 - reg.y1 - 160);

    const poolGrad = ctx.createLinearGradient(115, 130, 345, 152);
    poolGrad.addColorStop(0, progress > 0.2 ? '#0284c7' : '#475569');
    poolGrad.addColorStop(0.5, progress > 0.2 ? '#38bdf8' : '#64748b');
    poolGrad.addColorStop(1, progress > 0.2 ? '#0369a1' : '#334155');
    ctx.fillStyle = poolGrad;
    ctx.beginPath();
    ctx.roundRect(110, 132, 240, 22, 4);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(130 + Math.sin(waveTimer * 2) * 8, 140);
    ctx.lineTo(210 + Math.sin(waveTimer * 2) * 8, 140);
    ctx.moveTo(250 - Math.sin(waveTimer * 2) * 8, 147);
    ctx.lineTo(325 - Math.sin(waveTimer * 2) * 8, 147);
    ctx.stroke();

    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(210, 62, 16, 52);
    ctx.fillRect(232, 62, 16, 52);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(210, 62, 16, 52);
    ctx.strokeRect(232, 62, 16, 52);

    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(226, 82, 6, 7);

    ctx.fillStyle = '#334155';
    for (let wy = 66; wy < 108; wy += 6) {
      ctx.fillRect(213, wy, 10, 3);
      ctx.fillRect(235, wy, 10, 3);
    }

    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.roundRect(110, 110, 240, 22, 3);
    ctx.fill();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#475569';
    for (let cx = 120; cx <= 340; cx += 11) {
      ctx.fillRect(cx, 115, 4, 15);
    }

    const domeGrad = ctx.createLinearGradient(142, 92, 198, 112);
    domeGrad.addColorStop(0, '#ffffff');
    domeGrad.addColorStop(1, '#cbd5e1');
    ctx.fillStyle = domeGrad;
    ctx.beginPath();
    ctx.arc(170, 110, 26, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = domeGrad;
    ctx.beginPath();
    ctx.arc(292, 96, 28, 0.08 * Math.PI, 0.92 * Math.PI);
    ctx.lineTo(266, 110);
    ctx.lineTo(318, 110);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#64748b';
    ctx.stroke();

    ctx.fillStyle = '#f1f5f9';
    ctx.beginPath();
    ctx.moveTo(212, 154);
    ctx.lineTo(248, 154);
    ctx.lineTo(242, 125);
    ctx.lineTo(218, 125);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.stroke();

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(125, 108);
    ctx.lineTo(125, 75);
    ctx.stroke();

    ctx.fillStyle = '#16a34a';
    ctx.fillRect(126, 75, 16, 11);
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(134, 76.5);
    ctx.lineTo(140, 80.5);
    ctx.lineTo(134, 84.5);
    ctx.lineTo(128, 80.5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  /**
   * Desenha o TÚNEL central com transição suave e orgânica entre o Senado (oeste)
   * e a Avenida Paulista (leste), integrando calçadas, rampas de acesso e vegetação.
   */
  function drawTunnel() {
    const reg = LAND_REGIONS[1];
    const midY = (reg.y1 + reg.y2) / 2;
    const progress = getRestorationProgress();

    ctx.save();
    createWalkablePath(0);
    ctx.clip();

    // 1. Rampas de Transição Suave
    const blendStart = 340;
    const blendEnd = 635;
    const roadBlend = ctx.createLinearGradient(blendStart, 0, blendEnd, 0);
    roadBlend.addColorStop(0.00, 'rgba(203, 213, 225, 0)');
    roadBlend.addColorStop(0.14, 'rgba(148, 163, 184, 0.72)');
    roadBlend.addColorStop(0.24, '#334155');
    roadBlend.addColorStop(0.35, '#1e293b');
    roadBlend.addColorStop(0.65, '#1e293b');
    roadBlend.addColorStop(0.76, '#334155');
    roadBlend.addColorStop(0.88, 'rgba(148, 163, 184, 0.72)');
    roadBlend.addColorStop(1.00, 'rgba(226, 232, 240, 0)');

    ctx.fillStyle = roadBlend;
    ctx.beginPath();
    ctx.moveTo(blendStart, reg.y1 - 15);
    ctx.quadraticCurveTo(405, reg.y1, 412, reg.y1);
    ctx.lineTo(548, reg.y1);
    ctx.quadraticCurveTo(555, reg.y1, blendEnd, reg.y1 - 15);
    ctx.lineTo(blendEnd, reg.y2 + 15);
    ctx.quadraticCurveTo(555, reg.y2, 548, reg.y2);
    ctx.lineTo(412, reg.y2);
    ctx.quadraticCurveTo(405, reg.y2, blendStart, reg.y2 + 15);
    ctx.closePath();
    ctx.fill();

    // 2. Calçadas de Pedestres Contínuas
    const sidewalkGrad = ctx.createLinearGradient(355, 0, 615, 0);
    sidewalkGrad.addColorStop(0.00, 'rgba(226, 232, 240, 0)');
    sidewalkGrad.addColorStop(0.18, '#cbd5e1');
    sidewalkGrad.addColorStop(0.30, '#64748b');
    sidewalkGrad.addColorStop(0.70, '#64748b');
    sidewalkGrad.addColorStop(0.82, '#cbd5e1');
    sidewalkGrad.addColorStop(1.00, 'rgba(226, 232, 240, 0)');

    ctx.fillStyle = sidewalkGrad;
    ctx.fillRect(355, reg.y1 + 12, 260, 20);
    ctx.fillRect(355, reg.y2 - 32, 260, 20);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.65)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(365, reg.y1 + 32);
    ctx.lineTo(605, reg.y1 + 32);
    ctx.moveTo(365, reg.y2 - 32);
    ctx.lineTo(605, reg.y2 - 32);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(234, 179, 8, 0.75)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 6]);
    ctx.beginPath();
    ctx.moveTo(380, reg.y1 + 22);
    ctx.lineTo(585, reg.y1 + 22);
    ctx.moveTo(380, reg.y2 - 22);
    ctx.lineTo(585, reg.y2 - 22);
    ctx.stroke();
    ctx.setLineDash([]);

    // 3. Abóbada Coberta do Túnel
    const vaultX = 408;
    const vaultW = 144;
    const vaultGrad = ctx.createLinearGradient(vaultX, reg.y1, vaultX, reg.y2);
    vaultGrad.addColorStop(0, '#0f172a');
    vaultGrad.addColorStop(0.18, '#1e293b');
    vaultGrad.addColorStop(0.82, '#1e293b');
    vaultGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = vaultGrad;
    ctx.fillRect(vaultX, reg.y1 + 32, vaultW, reg.y2 - reg.y1 - 64);

    const westMouthShadow = ctx.createLinearGradient(vaultX - 24, 0, vaultX + 22, 0);
    westMouthShadow.addColorStop(0, 'rgba(15, 23, 42, 0)');
    westMouthShadow.addColorStop(0.6, 'rgba(15, 23, 42, 0.45)');
    westMouthShadow.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = westMouthShadow;
    ctx.fillRect(vaultX - 24, reg.y1 + 12, 46, reg.y2 - reg.y1 - 24);

    const eastMouthShadow = ctx.createLinearGradient(vaultX + vaultW - 22, 0, vaultX + vaultW + 24, 0);
    eastMouthShadow.addColorStop(0, 'rgba(15, 23, 42, 0)');
    eastMouthShadow.addColorStop(0.4, 'rgba(15, 23, 42, 0.45)');
    eastMouthShadow.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = eastMouthShadow;
    ctx.fillRect(vaultX + vaultW - 22, reg.y1 + 12, 46, reg.y2 - reg.y1 - 24);

    // 4. Faixa Central de Travessia
    const lineGrad = ctx.createLinearGradient(375, 0, 595, 0);
    lineGrad.addColorStop(0, 'rgba(250, 204, 21, 0)');
    lineGrad.addColorStop(0.2, '#facc15');
    lineGrad.addColorStop(0.8, '#facc15');
    lineGrad.addColorStop(1, 'rgba(250, 204, 21, 0)');

    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(375, midY - 2.5);
    ctx.lineTo(595, midY - 2.5);
    ctx.stroke();

    ctx.setLineDash([12, 9]);
    ctx.beginPath();
    ctx.moveTo(375, midY + 2.5);
    ctx.lineTo(595, midY + 2.5);
    ctx.stroke();
    ctx.setLineDash([]);

    // 5. Arcos Estruturais e Iluminação Quente da Galeria Central
    const archPositions = [428, 462, 498, 532];
    archPositions.forEach(ax => {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
      ctx.fillRect(ax - 3, reg.y1 + 12, 6, reg.y2 - reg.y1 - 24);
    });

    const lightPositions = [436, 480, 524];
    lightPositions.forEach(lx => {
      const glow = ctx.createRadialGradient(lx, midY, 4, lx, midY, 44);
      glow.addColorStop(0, 'rgba(254, 240, 138, 0.26)');
      glow.addColorStop(1, 'rgba(254, 240, 138, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(lx, midY, 44, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.roundRect(lx - 7, reg.y1 + 5, 14, 4, 2);
      ctx.roundRect(lx - 7, reg.y2 - 9, 14, 4, 2);
      ctx.fill();
    });

    // 6. Muros de Pedra/Concreto do Túnel
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.roundRect(404, reg.y1, 152, 13, 4);
    ctx.roundRect(404, reg.y2 - 13, 152, 13, 4);
    ctx.fill();

    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.roundRect(402, reg.y1, 14, 24, 3);
    ctx.roundRect(402, reg.y2 - 24, 14, 24, 3);
    ctx.roundRect(544, reg.y1, 14, 24, 3);
    ctx.roundRect(544, reg.y2 - 24, 14, 24, 3);
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Hera e folhagens sobre as bordas do túnel (secas quando devastado, verdes quando restaurado)
    const vineClusters = [422, 450, 480, 510, 538];
    vineClusters.forEach((vx, idx) => {
      ctx.fillStyle = progress > 0.2 ? (idx % 2 === 0 ? '#15803d' : '#16a34a') : '#4a3525';
      ctx.beginPath();
      ctx.arc(vx, reg.y1 + 3, 7, 0, Math.PI);
      ctx.arc(vx + 6, reg.y1 + 2, 5, 0, Math.PI);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(vx, reg.y2 - 3, 7, Math.PI, 0);
      ctx.arc(vx - 6, reg.y2 - 2, 5, Math.PI, 0);
      ctx.fill();
    });

    ctx.restore();
  }

  /**
   * Desenha a região Leste: AVENIDA PAULISTA
   * - Em 0 bandeiras: cinzenta/devastada e com árvores sem folhas.
   * - A cada bandeira colocada: vai colorindo gradualmente, devolvendo as folhas das árvores,
   *   pombos voando e ratos!
   */
  function drawPaulista() {
    const reg = LAND_REGIONS[2];
    const progress = getRestorationProgress();

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(reg.x1, reg.y1, reg.x2 - reg.x1, reg.y2 - reg.y1, reg.radius);
    ctx.clip();

    // 1. Base Devastada / Cinzenta da Calçada
    ctx.fillStyle = '#78716c';
    ctx.fillRect(reg.x1, reg.y1, reg.x2 - reg.x1, reg.y2 - reg.y1);

    // Camada Colorida/Clara da Calçada Portuguesa que vai voltando gradualmente com as bandeiras
    if (progress > 0) {
      ctx.save();
      ctx.globalAlpha = progress;
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(reg.x1, reg.y1, reg.x2 - reg.x1, reg.y2 - reg.y1);

      // Flores e canteiros vivos nas bordas da calçada conforme restaura
      ctx.fillStyle = 'rgba(34, 197, 94, 0.22)';
      ctx.fillRect(reg.x1, reg.y1, 22, reg.y2 - reg.y1);
      ctx.fillRect(reg.x2 - 22, reg.y1, 22, reg.y2 - reg.y1);
      ctx.restore();
    }

    ctx.fillStyle = '#334155';
    for (let y = reg.y1 + 12; y < reg.y2; y += 24) {
      for (let x = reg.x1 + 12; x < reg.x2; x += 24) {
        if (x < 650 || x > 810) {
          ctx.beginPath();
          ctx.moveTo(x, y - 5);
          ctx.lineTo(x + 5, y);
          ctx.lineTo(x, y + 5);
          ctx.lineTo(x - 5, y);
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    // 2. Pista da Avenida Paulista
    const roadX = 650;
    const roadW = 160;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(roadX, reg.y1, roadW, reg.y2 - reg.y1);

    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(roadX - 4, reg.y1, 4, reg.y2 - reg.y1);
    ctx.fillRect(roadX + roadW, reg.y1, 4, reg.y2 - reg.y1);

    ctx.strokeStyle = 'rgba(248, 250, 252, 0.65)';
    ctx.lineWidth = 2;
    ctx.setLineDash([16, 14]);
    ctx.beginPath();
    ctx.moveTo(roadX + 38, reg.y1 + 15);
    ctx.lineTo(roadX + 38, reg.y2 - 15);
    ctx.moveTo(roadX + roadW - 38, reg.y1 + 15);
    ctx.lineTo(roadX + roadW - 38, reg.y2 - 15);
    ctx.stroke();
    ctx.setLineDash([]);

    // 3. Ciclovia Central: esmaecida/queimada no início, vermelha vibrante conforme ganha bandeiras
    const bikeX = roadX + roadW / 2 - 13;
    const bikeW = 26;
    ctx.fillStyle = '#4a3531';
    ctx.fillRect(bikeX, reg.y1, bikeW, reg.y2 - reg.y1);

    if (progress > 0) {
      ctx.save();
      ctx.globalAlpha = progress;
      ctx.fillStyle = '#b91c1c';
      ctx.fillRect(bikeX, reg.y1, bikeW, reg.y2 - reg.y1);
      ctx.restore();
    }

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(bikeX, reg.y1, 2, reg.y2 - reg.y1);
    ctx.fillRect(bikeX + bikeW - 2, reg.y1, 2, reg.y2 - reg.y1);

    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(bikeX + bikeW / 2, reg.y1 + 10);
    ctx.lineTo(bikeX + bikeW / 2, reg.y2 - 10);
    ctx.stroke();
    ctx.setLineDash([]);

    const crosswalksY = [165, 365];
    ctx.fillStyle = 'rgba(248, 250, 252, 0.88)';
    crosswalksY.forEach(cy => {
      for (let zx = roadX + 6; zx < roadX + roadW - 6; zx += 12) {
        if (zx + 7 < bikeX || zx > bikeX + bikeW) {
          ctx.fillRect(zx, cy, 7, 22);
        }
      }
    });

    // 4. MASP na calçada leste (vai ganhando o vermelho vivo e vidros azuis com as bandeiras)
    ctx.fillStyle = '#9ca3af';
    ctx.fillRect(820, 205, 82, 130);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1;
    ctx.strokeRect(820, 205, 82, 130);

    ctx.fillStyle = '#475569';
    ctx.fillRect(826, 215, 70, 110);
    ctx.fillStyle = progress > 0 ? '#bae6fd' : '#64748b';
    ctx.fillRect(830, 228, 62, 84);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    for (let my = 240; my < 310; my += 14) {
      ctx.beginPath();
      ctx.moveTo(830, my);
      ctx.lineTo(892, my);
      ctx.stroke();
    }

    // Pilares do MASP: cinza-acastanhado quando devastado, vermelho vivo conforme restaura
    ctx.fillStyle = '#573a38';
    ctx.fillRect(822, 210, 10, 120);
    ctx.fillRect(890, 210, 10, 120);
    ctx.fillRect(822, 210, 78, 9);
    ctx.fillRect(822, 321, 78, 9);

    if (progress > 0) {
      ctx.save();
      ctx.globalAlpha = progress;
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(822, 210, 10, 120);
      ctx.fillRect(890, 210, 10, 120);
      ctx.fillRect(822, 210, 78, 9);
      ctx.fillRect(822, 321, 78, 9);
      ctx.restore();
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MASP', 861, 218);

    // 5. Edifício FIESP
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(562, 115, 52, 48, 4);
    ctx.roundRect(562, 378, 52, 48, 4);
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 1;
    for (let fy = 123; fy < 158; fy += 9) {
      ctx.beginPath();
      ctx.moveTo(566, fy);
      ctx.lineTo(610, fy);
      ctx.stroke();
    }
    for (let fy = 386; fy < 420; fy += 9) {
      ctx.beginPath();
      ctx.moveTo(566, fy);
      ctx.lineTo(610, fy);
      ctx.stroke();
    }

    // 6. Árvores urbanas da Paulista: sem folhas no início, ganhando folhas conforme coloca bandeiras
    const paulistaTrees = [
      { x: 582, y: 88, threshold: 0.05 },
      { x: 878, y: 95, threshold: 0.25 },
      { x: 582, y: 455, threshold: 0.45 },
      { x: 878, y: 455, threshold: 0.65 }
    ];
    paulistaTrees.forEach((pt, idx) => {
      if (progress <= pt.threshold) {
        drawBareTreeBranches(pt.x, pt.y, 18, idx * 0.8);
      } else {
        const localScale = Math.min(1, 0.5 + (progress - pt.threshold) * 1.5);
        ctx.save();
        ctx.translate(pt.x, pt.y);
        ctx.scale(localScale, localScale);
        ctx.translate(-pt.x, -pt.y);

        ctx.fillStyle = '#15803d';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 17, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#dcfce7';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const urbanLeaves = [
          { lx: -6, ly: -5, rot: 0.4, len: 5.5, wid: 2.8, lcol: '#4ade80' },
          { lx: 6, ly: -4, rot: 1.2, len: 5.5, wid: 2.8, lcol: '#22c55e' },
          { lx: -4, ly: 6, rot: -0.6, len: 5.5, wid: 2.8, lcol: '#86efac' },
          { lx: 5, ly: 5, rot: 2.1, len: 5.5, wid: 2.8, lcol: '#4ade80' }
        ];
        drawLeafCluster(pt.x, pt.y, urbanLeaves, 0);
        ctx.restore();
      }
    });

    ctx.restore();
  }

  /**
   * Desenha os Palanques e as Bandeiras colocadas no Senado e na Avenida Paulista
   */
  function drawPodiumsAndFlags() {
    if (!inRecoveryStage) return;

    const touchedPodium = getTouchedPodium();
    ctx.save();

    for (let i = 0; i < podiums.length; i++) {
      const p = podiums[i];
      const isTouched = (touchedPodium && touchedPodium.id === p.id && reserveCount > 0);

      ctx.save();
      ctx.translate(p.x, p.y);

      // Halo interativo quando Lula está encostado no palanque
      if (isTouched) {
        const pulse = Math.sin(waveTimer * 6) * 3;
        ctx.fillStyle = 'rgba(250, 204, 21, 0.28)';
        ctx.beginPath();
        ctx.arc(0, 0, p.radius + 6 + pulse, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius + 3 + pulse * 0.5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Sombra do palanque cívico
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(0, 8, 18, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      // Base circular de madeira/mármore do palanque
      ctx.fillStyle = p.hasFlag ? '#15803d' : '#475569';
      ctx.beginPath();
      ctx.ellipse(0, 4, 16, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = p.hasFlag ? '#fde047' : '#cbd5e1';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Degrau superior do palanque
      ctx.fillStyle = p.hasFlag ? '#16a34a' : '#64748b';
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Se já recebeu bandeira(s), desenha o mastro e a Bandeira do Brasil tremulando!
      if (p.hasFlag) {
        const wave = Math.sin(waveTimer * 5 + p.id) * 2.5;

        // Mastro prateado
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -34);
        ctx.stroke();

        // Topo dourado do mastro
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(0, -35, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Pano verde da bandeira ondulando
        ctx.fillStyle = '#16a34a';
        ctx.beginPath();
        ctx.moveTo(1, -33);
        ctx.quadraticCurveTo(12, -35 + wave, 24, -32 + wave);
        ctx.lineTo(24, -17 + wave);
        ctx.quadraticCurveTo(12, -20 + wave, 1, -18);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Losango amarelo
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.moveTo(12.5, -30 + wave * 0.5);
        ctx.lineTo(20.5, -25.5 + wave * 0.7);
        ctx.lineTo(12.5, -21 + wave * 0.5);
        ctx.lineTo(4.5, -25.5 + wave * 0.3);
        ctx.closePath();
        ctx.fill();

        // Globo azul central
        ctx.fillStyle = '#1d4ed8';
        ctx.beginPath();
        ctx.arc(12.5, -25.5 + wave * 0.5, 3.2, 0, Math.PI * 2);
        ctx.fill();

        // Se o jogador colocou mais de uma bandeira neste mesmo palanque, exibe contador "+N"
        if (p.flags > 1) {
          ctx.fillStyle = '#fde047';
          ctx.font = 'bold 11px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`x${p.flags}`, -10, -22);
        }
      } else {
        // Suporte vazio aguardando bandeira
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Dica contextual se Lula está tocando o palanque
      if (isTouched) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.beginPath();
        ctx.roundRect(-48, 12, 96, 18, 4);
        ctx.fill();
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('E / Clique: Bandeira', 0, 24);
      }

      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * Desenha a vida nova na Avenida Paulista: Pombos Voando e Ratos
   * (aparecem gradualmente conforme as bandeiras são colocadas!)
   */
  function drawPaulistaWildlife() {
    if (flagsPlaced <= 0) return;

    ctx.save();

    // 1. Ratos caminhando pelas calçadas e meios-fios da Paulista
    const activeRats = Math.min(RATS.length, Math.ceil((flagsPlaced / TOTAL_CONSTITUTIONS) * RATS.length));
    for (let i = 0; i < activeRats; i++) {
      const rat = RATS[i];
      ctx.save();
      ctx.translate(rat.x, rat.y);
      if (rat.dir < 0) ctx.scale(1, -1); // Orienta na direção do movimento

      // Rabinho ondulante
      const tailWag = Math.sin(waveTimer * 12 + rat.phase) * 2.5;
      ctx.strokeStyle = '#f472b6';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.quadraticCurveTo(tailWag, -11, -tailWag * 0.5, -15);
      ctx.stroke();

      // Corpo do ratinho
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.ellipse(0, 0, 4.2, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Orelhinhas rosadas
      ctx.fillStyle = '#fda4af';
      ctx.beginPath();
      ctx.arc(-3, 4, 2, 0, Math.PI * 2);
      ctx.arc(3, 4, 2, 0, Math.PI * 2);
      ctx.fill();

      // Focinho e olhinhos
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(0, 7, 1.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // 2. Pombos voando sobre a Avenida Paulista
    const activePigeons = Math.min(PIGEONS.length, flagsPlaced);
    for (let i = 0; i < activePigeons; i++) {
      const pg = PIGEONS[i];
      const angle = waveTimer * pg.speed + pg.phase;
      const px = pg.cx + Math.cos(angle) * pg.rx;
      const py = pg.cy + Math.sin(angle * 2) * pg.ry;
      const vx = -Math.sin(angle) * pg.rx;
      const vy = Math.cos(angle * 2) * 2 * pg.ry;
      const heading = Math.atan2(vy, vx);
      const wingFlap = Math.sin(waveTimer * 14 + pg.phase) * 9;

      ctx.save();
      // Sombra do pombo no chão da Paulista
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.beginPath();
      ctx.ellipse(px + 6, py + 18, 6, 3, heading, 0, Math.PI * 2);
      ctx.fill();

      ctx.translate(px, py);
      ctx.rotate(heading);

      // Asas batendo
      ctx.fillStyle = '#cbd5e1';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-2, 0);
      ctx.quadraticCurveTo(-4, -10 - wingFlap * 0.6, 3, -12 - wingFlap);
      ctx.lineTo(5, -2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-2, 0);
      ctx.quadraticCurveTo(-4, 10 + wingFlap * 0.6, 3, 12 + wingFlap);
      ctx.lineTo(5, 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Corpo do pombo
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.ellipse(0, 0, 7, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Cabeça e bico
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(6, 0, 2.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(8, -1);
      ctx.lineTo(11, 0);
      ctx.lineTo(8, 1);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * Desenha placas sinalizadoras dos 3 ambientes e o banner superior no Canvas
   */
  function drawSignposts() {
    ctx.save();
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';

    // Placa do Senado
    ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
    ctx.beginPath();
    ctx.roundRect(88, 62, 122, 28, 6);
    ctx.fill();
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillText('🏛️ SENADO', 149, 81);

    // Placa do Túnel
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(425, 190, 110, 28, 6);
    ctx.fill();
    ctx.strokeStyle = '#fde047';
    ctx.stroke();
    ctx.fillStyle = '#fde047';
    ctx.fillText('🚇 TÚNEL', 480, 209);

    // Placa da Avenida Paulista
    ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
    ctx.beginPath();
    ctx.roundRect(692, 62, 182, 28, 6);
    ctx.fill();
    ctx.strokeStyle = '#fde047';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillText('🏙️ AVENIDA PAULISTA', 783, 81);

    // Faixa superior de Missão / Status e Contador no Canvas
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.beginPath();
    ctx.roundRect(140, 8, 680, 38, 9);
    ctx.fill();
    ctx.strokeStyle = flagsPlaced > 0 ? '#4ade80' : 'rgba(253, 224, 71, 0.8)';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'left';

    if (inRecoveryStage) {
      const bannerTitle = flagsPlaced > 0 ? `🌱 ${REVIVAL_TEXT}` : '🚩 Coloque as 10 bandeiras nos palanques (E / Clique / Toque)';
      ctx.fillText(bannerTitle, 158, 32);

      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`Reserva: ${reserveCount} | Bandeiras: ${flagsPlaced}/${TOTAL_CONSTITUTIONS}`, 804, 32);
    } else {
      ctx.fillText(`📜 ${MISSION_TEXT}`, 158, 32);

      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${collectedCount}/${TOTAL_CONSTITUTIONS}`, 804, 32);
    }

    ctx.restore();
  }

  /**
   * Desenha as Constituições ainda não coletadas no cenário (escala ampliada).
   */
  function drawConstitutions() {
    if (inRecoveryStage) return;

    ctx.save();
    const pulse = Math.sin(waveTimer * 4) * 2.5;

    for (let i = 0; i < constitutions.length; i++) {
      const item = constitutions[i];
      if (item.collected) continue;

      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.scale(1.38, 1.38);

      ctx.fillStyle = 'rgba(253, 224, 71, 0.32)';
      ctx.beginPath();
      ctx.arc(0, 0, item.radius + 4 + pulse, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, item.radius + 2 + pulse * 0.5, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(0, 11, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.roundRect(-8, -11, 17, 21, 2);
      ctx.fill();

      ctx.fillStyle = '#15803d';
      ctx.beginPath();
      ctx.roundRect(-10, -11, 17, 21, 2.5);
      ctx.fill();
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.moveTo(-1.5, -6);
      ctx.lineTo(4.5, -0.5);
      ctx.lineTo(-1.5, 5);
      ctx.lineTo(-7.5, -0.5);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#1d4ed8';
      ctx.beginPath();
      ctx.arc(-1.5, -0.5, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * Desenha o efeito de brilho breve no local onde uma constituição foi coletada ou bandeira colocada
   */
  function drawSparkles() {
    if (sparkles.length === 0) return;

    ctx.save();
    for (let i = 0; i < sparkles.length; i++) {
      const sp = sparkles[i];
      const progress = Math.min(1, sp.age / sp.duration);
      const alpha = 1 - progress;
      const radius = 10 + progress * 28;

      ctx.save();
      ctx.translate(sp.x, sp.y);

      ctx.strokeStyle = sp.isFlag
        ? `rgba(74, 222, 128, ${alpha.toFixed(2)})`
        : `rgba(253, 224, 71, ${alpha.toFixed(2)})`;
      ctx.lineWidth = 3 * (1 - progress * 0.5);
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha.toFixed(2)})`;
      ctx.lineWidth = 2;
      for (let r = 0; r < 8; r++) {
        const angle = (r * Math.PI) / 4 + progress * 0.6;
        const innerR = radius * 0.4;
        const outerR = radius * 1.15;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR);
        ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
        ctx.stroke();
      }

      ctx.fillStyle = `rgba(254, 240, 138, ${alpha.toFixed(2)})`;
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(sp.isFlag ? '🇧🇷 +1' : '✨ +1', 0, -10 - progress * 18);

      ctx.restore();
    }
    ctx.restore();
  }

  /**
   * Desenha o Guarda de Névoa (FlavioB) apenas durante a etapa de resgate.
   */
  function drawGuard() {
    if (inRecoveryStage || !guard.active) return;

    ctx.save();

    // 1. Trilha demarcada da linha fixa de patrulha no chão da Avenida Paulista
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.45)';
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(guard.fixedX, guard.minY);
    ctx.lineTo(guard.fixedX, guard.maxY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(168, 85, 247, 0.55)';
    ctx.beginPath();
    ctx.arc(guard.fixedX, guard.minY, 5, 0, Math.PI * 2);
    ctx.arc(guard.fixedX, guard.maxY, 5, 0, Math.PI * 2);
    ctx.fill();

    // 2. Desenho do Guarda de Névoa (FlavioB) na sua posição atual (escala ampliada)
    ctx.translate(guard.x, guard.y);
    ctx.scale(1.4, 1.4);

    const mistPulse = Math.sin(waveTimer * 3.5) * 3;
    const mistGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, guard.radius + 12 + mistPulse);
    mistGrad.addColorStop(0, 'rgba(88, 28, 135, 0.65)');
    mistGrad.addColorStop(0.6, 'rgba(107, 33, 168, 0.35)');
    mistGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = mistGrad;
    ctx.beginPath();
    ctx.arc(0, 0, guard.radius + 12 + mistPulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, guard.radius + 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(-11, -8, 22, 20, 6);
    ctx.fill();
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-2, -5, 4, 11);

    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.arc(0, -12, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(0, -14, 8, Math.PI, 0);
    ctx.fill();

    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(-3, -11, 1.5, 0, Math.PI * 2);
    ctx.arc(3, -11, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // 3. SETA INDICADORA DE DIREÇÃO
    const dirSign = guard.dirY >= 0 ? 1 : -1;
    const arrowY = dirSign * (guard.radius + 14);

    ctx.fillStyle = '#fde047';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (dirSign > 0) {
      ctx.moveTo(0, arrowY + 8);
      ctx.lineTo(-9, arrowY - 4);
      ctx.lineTo(-3, arrowY - 4);
      ctx.lineTo(-3, arrowY - 11);
      ctx.lineTo(3, arrowY - 11);
      ctx.lineTo(3, arrowY - 4);
      ctx.lineTo(9, arrowY - 4);
    } else {
      ctx.moveTo(0, arrowY - 8);
      ctx.lineTo(-9, arrowY + 4);
      ctx.lineTo(-3, arrowY + 4);
      ctx.lineTo(-3, arrowY + 11);
      ctx.lineTo(3, arrowY + 11);
      ctx.lineTo(3, arrowY + 4);
      ctx.lineTo(9, arrowY + 4);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const dirSymbol = dirSign > 0 ? '▼' : '▲';
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(-34, -36, 68, 16, 4);
    ctx.fill();
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`FlavioB ${dirSymbol}`, 0, -25);

    ctx.restore();
  }

  /**
   * Auxiliar para desenhar a MALETA (em uma mão)
   */
  function drawBriefcase(bx, by, tiltAngle = 0) {
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(tiltAngle);

    ctx.strokeStyle = '#3e2723';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-4, -5, 8, 5, 2);
    ctx.stroke();

    ctx.fillStyle = '#5c3a21';
    ctx.beginPath();
    ctx.roundRect(-9, -1, 18, 13, 2.5);
    ctx.fill();

    ctx.strokeStyle = '#3e2723';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = '#70482a';
    ctx.fillRect(-8, -1, 16, 4);

    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-5, 2, 2.5, 3.5);
    ctx.fillRect(2.5, 2, 2.5, 3.5);

    ctx.restore();
  }

  /**
   * Auxiliar para desenhar a BENGALA (na outra mão)
   */
  function drawCane(cx, cy, tiltAngle = 0, mirror = false) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tiltAngle);
    if (mirror) ctx.scale(-1, 1);

    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 17);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(-3.5, 0, 3.5, 0, Math.PI, true);
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-1.8, 2, 3.6, 2);

    ctx.fillStyle = '#111827';
    ctx.fillRect(-1.8, 15, 3.6, 3);

    ctx.restore();
  }

  /**
   * Desenha o protagonista: Lula, um senhor de ~80 anos segurando
   * uma maleta em uma mão e uma bengala na outra.
   */
  function drawLula() {
    ctx.save();
    ctx.translate(lula.x, lula.y);
    ctx.scale(1.45, 1.45);

    const bob = lula.isMoving ? Math.sin(lula.walkCycle) * 1.8 : 0;
    const armSwing = lula.isMoving ? Math.sin(lula.walkCycle) * 0.18 : 0;
    const legStep = lula.isMoving ? Math.sin(lula.walkCycle) * 4 : 0;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 16, lula.radius * 0.95, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-7, 6, 5, 7 + legStep * 0.5);
    ctx.fillRect(2, 6, 5, 7 - legStep * 0.5);

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(-8, 11 + legStep, 6, 6, 2.5);
    ctx.roundRect(2, 11 - legStep, 6, 6, 2.5);
    ctx.fill();

    const suitColor = '#1e293b';
    const shirtColor = '#f8fafc';
    const tieColor = '#dc2626';
    const skinColor = '#f1c27d';
    const hairColor = '#f1f5f9';
    const beardShade = '#cbd5e1';

    const headY = -12 + bob;

    if (lula.facing === 'down') {
      ctx.fillStyle = suitColor;
      ctx.beginPath();
      ctx.roundRect(-11, -7 + bob, 22, 16, 5);
      ctx.fill();

      ctx.fillStyle = shirtColor;
      ctx.beginPath();
      ctx.moveTo(-4, -7 + bob);
      ctx.lineTo(4, -7 + bob);
      ctx.lineTo(0, 4 + bob);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = tieColor;
      ctx.beginPath();
      ctx.moveTo(-1.5, -6 + bob);
      ctx.lineTo(1.5, -6 + bob);
      ctx.lineTo(2, 5 + bob);
      ctx.lineTo(0, 7 + bob);
      ctx.lineTo(-2, 5 + bob);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = suitColor;
      ctx.beginPath();
      ctx.roundRect(-15, -5 + bob, 5, 11, 2.5);
      ctx.fill();
      ctx.fillStyle = skinColor;
      ctx.beginPath();
      ctx.arc(-13, 6 + bob, 2.5, 0, Math.PI * 2);
      ctx.fill();
      drawBriefcase(-15, 7 + bob, armSwing * 0.6);

      ctx.fillStyle = suitColor;
      ctx.beginPath();
      ctx.roundRect(10, -5 + bob, 5, 11, 2.5);
      ctx.fill();
      ctx.fillStyle = skinColor;
      ctx.beginPath();
      ctx.arc(13, 5 + bob, 2.5, 0, Math.PI * 2);
      ctx.fill();
      drawCane(14, 3 + bob - legStep * 0.3, -armSwing * 0.5, false);

    } else if (lula.facing === 'up') {
      drawCane(-14, 3 + bob + legStep * 0.3, armSwing * 0.5, true);
      drawBriefcase(15, 6 + bob, -armSwing * 0.6);

      ctx.fillStyle = suitColor;
      ctx.beginPath();
      ctx.roundRect(-11, -7 + bob, 22, 16, 5);
      ctx.fill();

      ctx.beginPath();
      ctx.roundRect(-15, -5 + bob, 5, 11, 2.5);
      ctx.roundRect(10, -5 + bob, 5, 11, 2.5);
      ctx.fill();

      ctx.fillStyle = skinColor;
      ctx.beginPath();
      ctx.arc(-13, 5 + bob, 2.5, 0, Math.PI * 2);
      ctx.arc(13, 6 + bob, 2.5, 0, Math.PI * 2);
      ctx.fill();

    } else if (lula.facing === 'right') {
      drawBriefcase(-10, 6 + bob, armSwing * 0.7);

      ctx.fillStyle = suitColor;
      ctx.beginPath();
      ctx.roundRect(-8, -7 + bob, 16, 16, 5);
      ctx.fill();

      ctx.fillStyle = tieColor;
      ctx.fillRect(6, -3 + bob, 2.5, 9);

      ctx.fillStyle = suitColor;
      ctx.beginPath();
      ctx.roundRect(2, -3 + bob, 9, 5, 2.5);
      ctx.fill();
      ctx.fillStyle = skinColor;
      ctx.beginPath();
      ctx.arc(12, 0 + bob, 2.5, 0, Math.PI * 2);
      ctx.fill();
      drawCane(13, 0 + bob - legStep * 0.35, -0.1 + armSwing * 0.5, false);

    } else {
      drawBriefcase(10, 6 + bob, -armSwing * 0.7);

      ctx.fillStyle = suitColor;
      ctx.beginPath();
      ctx.roundRect(-8, -7 + bob, 16, 16, 5);
      ctx.fill();

      ctx.fillStyle = tieColor;
      ctx.fillRect(-8.5, -3 + bob, 2.5, 9);

      ctx.fillStyle = suitColor;
      ctx.beginPath();
      ctx.roundRect(-11, -3 + bob, 9, 5, 2.5);
      ctx.fill();
      ctx.fillStyle = skinColor;
      ctx.beginPath();
      ctx.arc(-12, 0 + bob, 2.5, 0, Math.PI * 2);
      ctx.fill();
      drawCane(-13, 0 + bob - legStep * 0.35, 0.1 - armSwing * 0.5, true);
    }

    if (lula.facing === 'up') {
      ctx.fillStyle = hairColor;
      ctx.beginPath();
      ctx.arc(0, headY, 9.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = beardShade;
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (lula.facing === 'down') {
      ctx.fillStyle = hairColor;
      ctx.beginPath();
      ctx.arc(-7, headY - 2, 4.5, 0, Math.PI * 2);
      ctx.arc(7, headY - 2, 4.5, 0, Math.PI * 2);
      ctx.arc(0, headY - 5, 8.5, Math.PI, 0);
      ctx.fill();

      ctx.fillStyle = skinColor;
      ctx.beginPath();
      ctx.arc(0, headY, 8.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(140, 90, 45, 0.45)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(-4, headY - 5);
      ctx.lineTo(4, headY - 5);
      ctx.moveTo(-3, headY - 3.5);
      ctx.lineTo(3, headY - 3.5);
      ctx.stroke();

      ctx.fillStyle = hairColor;
      ctx.beginPath();
      ctx.arc(0, headY + 3.5, 8.5, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.lineTo(-8, headY + 1);
      ctx.quadraticCurveTo(0, headY + 4, 8, headY + 1);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = beardShade;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-2.5, headY + 2.5, 3.5, 1.8, -0.15, 0, Math.PI * 2);
      ctx.ellipse(2.5, headY + 2.5, 3.5, 1.8, 0.15, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(-3.2, headY - 1, 1.3, 0, Math.PI * 2);
      ctx.arc(3.2, headY - 1, 1.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-5, headY - 2.8);
      ctx.lineTo(-1.5, headY - 2.5);
      ctx.moveTo(1.5, headY - 2.5);
      ctx.lineTo(5, headY - 2.8);
      ctx.stroke();

    } else {
      const dir = lula.facing === 'right' ? 1 : -1;

      ctx.fillStyle = skinColor;
      ctx.beginPath();
      ctx.arc(0, headY, 8.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = hairColor;
      ctx.beginPath();
      ctx.arc(-2 * dir, headY - 2, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = skinColor;
      ctx.beginPath();
      ctx.arc(2 * dir, headY, 6.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(8 * dir, headY + 0.5, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = hairColor;
      ctx.beginPath();
      ctx.ellipse(3.5 * dir, headY + 4.5, 6.5, 5, -0.2 * dir, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = beardShade;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(4.5 * dir, headY - 1, 1.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(2.5 * dir, headY - 3);
      ctx.lineTo(6.5 * dir, headY - 2.5);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Desenha tela de sobreposição para Estados (Início, Pausa, Vitória, Derrota e Conclusão)
   */
  function drawOverlays() {
    if (gameState === STATE_READY) {
      ctx.save();
      ctx.fillStyle = 'rgba(20, 14, 10, 0.82)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 28px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🇧🇷 BRASIL VIVO', CANVAS_WIDTH / 2, 195);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.fillText(MISSION_TEXT, CANVAS_WIDTH / 2, 238);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '17px system-ui, sans-serif';
      ctx.fillText('O mapa está devastado. Resgate as 10 constituições desviando de FlavioB!', CANVAS_WIDTH / 2, 275);

      ctx.fillStyle = '#4ade80';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillText('Pressione "Iniciar Expedição" abaixo ou a tecla P para começar!', CANVAS_WIDTH / 2, 325);

      ctx.restore();
    } else if (gameState === STATE_PAUSED) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 32px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⏸️ JOGO PAUSADO', CANVAS_WIDTH / 2, 220);

      if (pauseReason) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'italic 16px system-ui, sans-serif';
        ctx.fillText(pauseReason, CANVAS_WIDTH / 2, 260);
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = '18px system-ui, sans-serif';
      ctx.fillText('Pressione a tecla P ou clique no botão "Retomar" para continuar.', CANVAS_WIDTH / 2, 305);

      ctx.restore();
    } else if (gameState === STATE_VICTORY) {
      ctx.save();
      ctx.fillStyle = 'rgba(6, 46, 30, 0.86)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 36px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`🏆 ${VICTORY_TEXT}`, CANVAS_WIDTH / 2, 200);

      ctx.fillStyle = '#f8fafc';
      ctx.font = '20px system-ui, sans-serif';
      ctx.fillText(`Constituições resgatadas: ${collectedCount}/${TOTAL_CONSTITUTIONS}`, CANVAS_WIDTH / 2, 245);

      ctx.fillStyle = '#4ade80';
      ctx.font = 'bold 19px system-ui, sans-serif';
      ctx.fillText('Clique no botão "Recuperar Democracia" abaixo para colocar as 10 bandeiras!', CANVAS_WIDTH / 2, 290);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillText('Ou clique em "Reiniciar" (tecla R) para jogar o resgate novamente.', CANVAS_WIDTH / 2, 335);

      ctx.restore();
    } else if (gameState === STATE_DEFEAT) {
      ctx.save();
      ctx.fillStyle = 'rgba(45, 10, 20, 0.86)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.fillStyle = '#f87171';
      ctx.font = 'bold 34px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`⚠️ ${DEFEAT_TEXT}`, CANVAS_WIDTH / 2, 220);

      ctx.fillStyle = '#f8fafc';
      ctx.font = '19px system-ui, sans-serif';
      ctx.fillText(`Constituições resgatadas antes do contato: ${collectedCount}/${TOTAL_CONSTITUTIONS}`, CANVAS_WIDTH / 2, 265);

      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 17px system-ui, sans-serif';
      ctx.fillText('Clique em "Reiniciar" ou pressione R para restaurar o resgate do início.', CANVAS_WIDTH / 2, 315);

      ctx.restore();
    } else if (inRecoveryStage) {
      // Faixa inferior não bloqueante na etapa de colocação de bandeiras
      ctx.save();
      ctx.fillStyle = 'rgba(6, 78, 59, 0.90)';
      ctx.beginPath();
      const boxW = flagsPlaced > 0 ? 460 : 680;
      ctx.roundRect((CANVAS_WIDTH - boxW) / 2, CANVAS_HEIGHT - 46, boxW, 36, 8);
      ctx.fill();
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      ctx.fillStyle = '#fde047';
      ctx.font = flagsPlaced > 0 ? 'bold 17px system-ui, sans-serif' : 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const bannerMsg = flagsPlaced > 0
        ? `🌱 ${REVIVAL_TEXT} (${flagsPlaced}/${TOTAL_CONSTITUTIONS})`
        : `🏆 ${VICTORY_TEXT}! Encoste nos palanques (E / Clique / Toque) para colocar as 10 bandeiras`;
      ctx.fillText(bannerMsg, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 22);
      ctx.restore();
    }
  }

  /**
   * Loop Principal de Animação e Renderização
   */
  function gameLoop(timestamp) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    const dt = Math.min(Math.max((timestamp - lastTimestamp) / 1000, 0), 0.05);
    lastTimestamp = timestamp;

    if (gameState === STATE_PLAYING) {
      waveTimer += dt;
      updateGuard(dt);
      updateWildlife(dt);
      updatePlayer(dt);
      updateSparkles(dt);
    }

    if (ctx) {
      ctx.save();
      ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      drawDenseForestFloor();
      drawForestBoundary();
      drawSenado();
      drawPaulista();
      drawTunnel();
      drawDenseForestCanopies();
      drawPodiumsAndFlags();
      drawPaulistaWildlife();
      drawSignposts();
      drawConstitutions();
      drawSparkles();
      drawGuard();
      drawLula();
      drawOverlays();
      ctx.restore();
    }

    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(gameLoop);
    }
  }

  // ==========================================================================
  // Controle de Estado do Jogo (Iniciar, Pausar, Retomar, Reiniciar)
  // ==========================================================================

  function startGame() {
    if (gameState === STATE_READY || gameState === STATE_PAUSED) {
      gameState = STATE_PLAYING;
      pauseReason = '';
      lastTimestamp = 0;
      if (btnStart) btnStart.disabled = true;
      if (btnPause) {
        btnPause.disabled = false;
        btnPause.setAttribute('aria-label', 'Pausar o jogo');
      }
      if (pauseIcon) pauseIcon.textContent = '⏸';
      if (pauseLabel) pauseLabel.textContent = 'Pausar';
      if (stateTextEl) {
        stateTextEl.textContent = inRecoveryStage ? `🌱 ${REVIVAL_TEXT}` : '🟢 Em Expedição';
      }
      updatePlantButtonState();
      announceScreenReader('Expedição iniciada!');
    }
  }

  function pauseGame(reason = '') {
    if (gameState === STATE_PLAYING) {
      gameState = STATE_PAUSED;
      pauseReason = reason;
      lastTimestamp = 0;
      lula.isMoving = false;
      input.up = false;
      input.down = false;
      input.left = false;
      input.right = false;
      if (pauseIcon) pauseIcon.textContent = '▶';
      if (pauseLabel) pauseLabel.textContent = 'Retomar';
      if (btnPause) btnPause.setAttribute('aria-label', 'Retomar o jogo');
      if (stateTextEl) stateTextEl.textContent = '⏸️ Pausado';
      updatePlantButtonState();
      announceScreenReader(reason ? `Jogo pausado: ${reason}` : 'Jogo pausado. Pressione P ou o botão para retomar.');
    }
  }

  function resumeGame() {
    if (gameState === STATE_PAUSED) {
      gameState = STATE_PLAYING;
      pauseReason = '';
      lastTimestamp = 0;
      if (pauseIcon) pauseIcon.textContent = '⏸';
      if (pauseLabel) pauseLabel.textContent = 'Pausar';
      if (btnPause) btnPause.setAttribute('aria-label', 'Pausar o jogo');
      if (stateTextEl) {
        stateTextEl.textContent = (inRecoveryStage && flagsPlaced > 0)
          ? `🌱 ${REVIVAL_TEXT}`
          : (inRecoveryStage ? '🌱 Recuperar Democracia' : '🟢 Em Expedição');
      }
      updatePlantButtonState();
      announceScreenReader('Expedição retomada.');
    }
  }

  function togglePause() {
    if (gameState === STATE_READY) {
      startGame();
    } else if (gameState === STATE_PLAYING) {
      pauseGame();
    } else if (gameState === STATE_PAUSED) {
      resumeGame();
    }
  }

  /**
   * Reiniciar: limpa todas as bandeiras, restaura o mapa devastado,
   * restaura Lula, o guarda FlavioB, as 10 constituições e o contador 0/10.
   */
  function restartGame() {
    inRecoveryStage = false;
    collectedCount = 0;
    reserveCount = 0;
    flagsPlaced = 0;
    sparkles.length = 0;

    for (let i = 0; i < constitutions.length; i++) {
      constitutions[i].collected = false;
    }

    for (let i = 0; i < podiums.length; i++) {
      podiums[i].flags = 0;
      podiums[i].hasFlag = false;
    }

    if (missionBannerEl) {
      missionBannerEl.textContent = MISSION_TEXT;
    }

    if (btnRecover) {
      btnRecover.hidden = true;
      btnRecover.disabled = true;
    }

    updateCounterDisplay();
    updatePlantButtonState();

    // Restaura posição e estado inicial de Lula
    lula.x = 180;
    lula.y = 270;
    lula.facing = 'right';
    lula.isMoving = false;
    lula.walkCycle = 0;

    // Restaura posição, direção e atividade inicial do guarda de névoa FlavioB
    guard.active = true;
    guard.x = INITIAL_GUARD.x;
    guard.y = INITIAL_GUARD.y;
    guard.dirX = INITIAL_GUARD.dirX;
    guard.dirY = INITIAL_GUARD.dirY;
    guard.facing = INITIAL_GUARD.facing;
    guard.walkCycle = 0;

    input.up = false;
    input.down = false;
    input.left = false;
    input.right = false;

    gameState = STATE_PLAYING;
    pauseReason = '';
    lastTimestamp = 0;

    if (btnStart) btnStart.disabled = true;
    if (btnPause) {
      btnPause.disabled = false;
      btnPause.setAttribute('aria-label', 'Pausar o jogo');
    }
    if (pauseIcon) pauseIcon.textContent = '⏸';
    if (pauseLabel) pauseLabel.textContent = 'Pausar';
    if (stateTextEl) stateTextEl.textContent = '🟢 Em Expedição';

    updateCurrentZone();
    announceScreenReader('Partida reiniciada! Bandeiras limpas, dez constituições e guarda FlavioB restaurados.');
  }

  const resetPosition = restartGame;

  // ==========================================================================
  // Escutas de Eventos (Teclado, Clique, Toque, Foco de Aba)
  // ==========================================================================

  window.addEventListener('keydown', (e) => {
    if ((e.code === 'KeyP' || e.key === 'p' || e.key === 'P') && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      togglePause();
      return;
    }

    if ((e.code === 'KeyR' || e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      restartGame();
      return;
    }

    // Tecla E: aciona o palanque em que Lula está tocando (sem repetir caso segure a tecla)
    if ((e.code === 'KeyE' || e.key === 'e' || e.key === 'E') && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      if (!e.repeat) {
        placeFlag();
      }
      return;
    }

    const activeEl = document.activeElement;
    const isFocusOnButton = activeEl && (activeEl.tagName === 'BUTTON' || activeEl.tagName === 'INPUT');

    if (e.code === 'Space') {
      if (isFocusOnButton) {
        return;
      }
      e.preventDefault();
      return;
    }

    let handled = false;
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        if (gameState === STATE_PLAYING) input.up = true;
        handled = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        if (gameState === STATE_PLAYING) input.down = true;
        handled = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        if (gameState === STATE_PLAYING) input.left = true;
        handled = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        if (gameState === STATE_PLAYING) input.right = true;
        handled = true;
        break;
    }

    if (handled && gameState === STATE_PLAYING) {
      e.preventDefault();
    }
  });

  window.addEventListener('keyup', (e) => {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        input.up = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        input.down = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        input.left = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        input.right = false;
        break;
    }
  });

  // --- Acionamento do Palanque por Clique ou Toque no Canvas ---
  if (canvas) {
    canvas.addEventListener('pointerdown', (e) => {
      if (!inRecoveryStage || gameState !== STATE_PLAYING) return;
      const now = Date.now();
      if (now - lastPlantTimestamp < 120) return; // Impede duplo disparo toque + clique
      lastPlantTimestamp = now;
      placeFlag();
    });
  }

  // --- Controles de Toque (D-Pad Virtual) ---
  function setupTouchButton(btn, dir) {
    if (!btn) return;

    const startAction = (e) => {
      e.preventDefault();
      if (gameState === STATE_PLAYING) {
        input[dir] = true;
      }
      btn.classList.add('active');
      if (navigator.vibrate) {
        try { navigator.vibrate(10); } catch (_) {}
      }
    };

    const stopAction = (e) => {
      e.preventDefault();
      input[dir] = false;
      btn.classList.remove('active');
    };

    btn.addEventListener('pointerdown', startAction);
    btn.addEventListener('pointerup', stopAction);
    btn.addEventListener('pointercancel', stopAction);
    btn.addEventListener('pointerleave', stopAction);
  }

  setupTouchButton(touchButtons.up, 'up');
  setupTouchButton(touchButtons.down, 'down');
  setupTouchButton(touchButtons.left, 'left');
  setupTouchButton(touchButtons.right, 'right');

  window.addEventListener('pointerup', () => {
    input.up = false;
    input.down = false;
    input.left = false;
    input.right = false;
    Object.values(touchButtons).forEach(b => b && b.classList.remove('active'));
  });

  // --- Troca de Aba e Perda de Foco ---
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (gameState === STATE_PLAYING) {
        pauseGame('Pausado automaticamente ao trocar de aba.');
      }
    } else {
      if (gameState === STATE_PAUSED) {
        announceScreenReader('Você retornou à aba da expedição. O jogo está pausado. Pressione Retomar ou P para prosseguir.');
      }
    }
  });

  window.addEventListener('blur', () => {
    if (gameState === STATE_PLAYING) {
      pauseGame('Pausado ao perder foco da janela.');
    }
  });

  // --- Botões da Interface ---
  if (btnStart) {
    btnStart.addEventListener('click', () => {
      startGame();
      if (canvas) canvas.focus();
    });
  }

  if (btnRecover) {
    btnRecover.addEventListener('click', () => {
      startRecoveryPhase();
      if (canvas) canvas.focus();
    });
  }

  if (btnPlant) {
    btnPlant.addEventListener('click', () => {
      const now = Date.now();
      if (now - lastPlantTimestamp < 120) return;
      lastPlantTimestamp = now;
      placeFlag();
      if (canvas) canvas.focus();
    });
  }

  if (btnPause) {
    btnPause.addEventListener('click', () => {
      togglePause();
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      restartGame();
      if (canvas) canvas.focus();
    });
  }

  // --- Inicialização Única e Alta Resolução (HiDPI / Full HD) ---
  setupHighResCanvas();
  window.addEventListener('resize', setupHighResCanvas);
  updateCounterDisplay();
  updateCurrentZone();
  if (!animationLoopStarted && typeof requestAnimationFrame !== 'undefined') {
    animationLoopStarted = true;
    requestAnimationFrame(gameLoop);
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
      TOTAL_CONSTITUTIONS,
      CONSTITUTION_RADIUS,
      PODIUM_RADIUS,
      MISSION_TEXT,
      VICTORY_TEXT,
      DEFEAT_TEXT,
      REVIVAL_TEXT,
      STATE_READY,
      STATE_PLAYING,
      STATE_PAUSED,
      STATE_VICTORY,
      STATE_DEFEAT,
      LAND_REGIONS,
      DENSE_FOREST_TREES,
      INITIAL_GUARD,
      INITIAL_PODIUMS,
      PIGEONS,
      RATS,
      constitutions,
      podiums,
      sparkles,
      lula,
      lia,
      guard,
      flavio,
      input,
      getGameState: () => gameState,
      isInRecoveryStage: () => inRecoveryStage,
      getCollectedCount: () => collectedCount,
      getReserveCount: () => reserveCount,
      getFlagsPlaced: () => flagsPlaced,
      getRestorationProgress,
      getTouchedPodium,
      setupHighResCanvas,
      isPointOnLand,
      isBodyEntirelyOnLand,
      updatePlayer,
      updateGuard,
      updateWildlife,
      updateSparkles,
      checkConstitutionCollections,
      checkGuardCollision,
      triggerDefeat,
      startRecoveryPhase,
      placeFlag,
      startGame,
      pauseGame,
      resumeGame,
      togglePause,
      restartGame,
      resetPosition,
      drawDenseForestFloor,
      drawDenseForestCanopies,
      drawBareTreeBranches,
      drawLeafCluster,
      drawSenado,
      drawTunnel,
      drawPaulista,
      drawPodiumsAndFlags,
      drawPaulistaWildlife,
      drawGuard,
      drawBriefcase,
      drawCane,
      drawLula
    };
  }
})();
