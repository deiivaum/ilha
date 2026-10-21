/**
 * Testes Automatizados para Brasil Vivo (Ilha Viva)
 * Valida:
 * 1. Missão e distribuição das 10 constituições alcançáveis (4 no Senado + 6 na Paulista).
 * 2. Coleta única sem repetição, brilho breve e contador de 0/10 até 10/10 (sem pontuação separada).
 * 3. Vitória em 10/10 ("Resgate concluído" e parada de movimento).
 * 4. Guarda de Névoa (FlavioB): linha fixa na Paulista, longe da entrada/início, velocidade constante menor que Lula, seta de direção, não persegue nem entra no túnel.
 * 5. Desvio e derrota ("O fascismo alcançou você" ao tocar o guarda).
 * 6. Pausa para o guarda e retomada sem saltos de posição.
 * 7. Reinício completo (Lula, guarda, 10 constituições, contador 0/10 e partida ativa).
 */

const fs = require('fs');
const path = require('path');

// Mock mínimo de DOM para carregar game.js diretamente em Node.js
const mockElements = {};
function getMockEl(id) {
  if (!mockElements[id]) {
    mockElements[id] = {
      id,
      textContent: '',
      disabled: false,
      attributes: {},
      classList: {
        add: () => {},
        remove: () => {}
      },
      setAttribute(k, v) { this.attributes[k] = v; },
      getAttribute(k) { return this.attributes[k]; },
      addEventListener: () => {},
      focus: () => {},
      getContext: () => null
    };
  }
  return mockElements[id];
}

global.window = {
  addEventListener: () => {}
};
global.document = {
  hidden: false,
  activeElement: null,
  getElementById: (id) => getMockEl(id),
  addEventListener: () => {}
};
global.navigator = {};

const htmlContent = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
const cssContent = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf-8');
const gameJsContent = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf-8');

const game = require('./game.js');

console.log('=== TESTES DE INTEGRIDADE E REQUISITOS - BRASIL VIVO ===\n');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    testsPassed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    testsFailed++;
  }
}

// 1. Verificação de Missão, Arquivos e Estrutura HTML/CSS
console.log('1. Verificação da Missão, Contador e Interface:');
const expectedMission = 'Resgate dez constituições para devolver a democracia ao Brasil';
assert(htmlContent.includes(expectedMission), 'index.html exibe a frase exata da missão');
assert(game.MISSION_TEXT === expectedMission, 'game.js contém a frase exata da missão');
assert(htmlContent.includes('id="constitution-counter"') && htmlContent.includes('0/10'), 'index.html exibe o contador inicial 0/10');
assert(htmlContent.includes('id="btn-reset"') && htmlContent.includes('Reiniciar'), 'index.html possui o botão Reiniciar');
assert(!htmlContent.toLowerCase().includes('pontuação') && !htmlContent.toLowerCase().includes('score'), 'Não existe pontuação separada na interface');
assert(!htmlContent.toLowerCase().includes('relógio') && !htmlContent.toLowerCase().includes('timer'), 'Não foi adicionado relógio ou novos modos');
assert(cssContent.includes(':focus-visible'), 'style.css preserva indicador visual de foco por teclado');
assert(cssContent.includes('aspect-ratio: 16 / 9'), 'style.css preserva proporção responsiva do canvas');

// 2. Verificação das 10 Constituições (4 no Senado + 6 na Paulista, todas alcançáveis)
console.log('\n2. Distribuição e Alcance das 10 Constituições:');
assert(game.constitutions.length === 10, 'Existem exatamente 10 constituições no cenário');

const senadoItems = game.constitutions.filter(c => c.zone === 'senado' && c.x < 375);
const paulistaItems = game.constitutions.filter(c => c.zone === 'paulista' && c.x > 585);
assert(senadoItems.length === 4, `Existem 4 constituições no Senado (encontradas: ${senadoItems.length})`);
assert(paulistaItems.length === 6, `Existem 6 constituições na Paulista (encontradas: ${paulistaItems.length})`);

const allReachable = game.constitutions.every(c =>
  game.isBodyEntirelyOnLand(c.x, c.y, game.lula.radius)
);
assert(allReachable, 'Todas as 10 constituições estão em posições 100% alcançáveis por Lula');

// 3. Limites do Cenário, Travessia e Movimento
console.log('\n3. Teste de Movimento, Travessia e Limites da Mata Fechada:');
const R = game.lula.radius;
assert(game.isBodyEntirelyOnLand(180, 270, R), 'Posição inicial de Lula (180, 270) está 100% na área transitável');
assert(!game.isBodyEntirelyOnLand(10, 10, R), 'Mata fechada superior esquerda (10, 10) é bloqueada');
assert(!game.isBodyEntirelyOnLand(480, 50, R), 'Mata fechada ao norte do túnel (480, 50) é bloqueada');
assert(!game.isBodyEntirelyOnLand(480, 480, R), 'Mata fechada ao sul do túnel (480, 480) é bloqueada');
assert(!game.isBodyEntirelyOnLand(950, 270, R), 'Mata fechada a leste da Paulista (950, 270) é bloqueada');

let crossingPossible = true;
for (let x = 180; x <= 700; x += 5) {
  if (!game.isBodyEntirelyOnLand(x, 270, R)) {
    crossingPossible = false;
    break;
  }
}
assert(crossingPossible, 'Travessia contínua do Senado à Paulista pelo Túnel (y=270)');

game.startGame();
assert(game.getGameState() === game.STATE_PLAYING, 'Jogo entra no estado PLAYING ao iniciar');

game.input.right = true;
game.updatePlayer(0.5);
assert(game.lula.x > 180, `Lula moveu para a direita (X = ${game.lula.x.toFixed(1)})`);

game.input.right = false;
const stoppedX = game.lula.x;
game.updatePlayer(0.5);
assert(game.lula.x === stoppedX && !game.lula.isMoving, 'Ao soltar a tecla, Lula para imediatamente');

// 4. Teste do Guarda de Névoa (FlavioB), Direção e Desvio
console.log('\n4. Teste do Guarda de Névoa (FlavioB), Direção e Espaço de Desvio:');
game.restartGame();
assert(game.guard.name === 'FlavioB', 'Guarda possui o nome FlavioB');
assert(game.guard.x === 730 && game.guard.fixedX === 730, 'Guarda fica numa área aberta da Av. Paulista (x=730), longe do túnel (x=590) e do início de Lula (x=180)');
assert(game.guard.speed > 0 && game.guard.speed < game.lula.speed, `Velocidade constante do FlavioB (${game.guard.speed}) é menor que a de Lula (${game.lula.speed})`);
assert(typeof game.drawGuard === 'function' && gameJsContent.includes('FlavioB ${dirSymbol}'), 'Desenha o guarda com seta visual e indicador de direção');

// Movimento em linha fixa sem perseguir Lula
game.lula.x = 620;
game.lula.y = 270;
const initialGuardY = game.guard.y;
game.updateGuard(1.0);
assert(game.guard.x === 730 && game.guard.y > initialGuardY, 'Guarda se move apenas na linha fixa vertical (não persegue Lula nem entra no túnel)');

// Verificar inversão de direção e seta ao atingir extremidade inferior (maxY) e superior (minY)
game.updateGuard(3.0);
assert(game.guard.y === game.guard.maxY && game.guard.dirY === -1 && game.guard.facing === 'up', 'Guarda inverte direção e seta para cima ao atingir o limite inferior da patrulha');
game.updateGuard(3.0);
assert(game.guard.y === game.guard.minY && game.guard.dirY === 1 && game.guard.facing === 'down', 'Guarda inverte direção e seta para baixo ao atingir o limite superior da patrulha');

// Verificar que há amplo espaço de desvio na Paulista (à esquerda x=630, à direita x=850, acima y=95 e abaixo y=445)
assert(game.isBodyEntirelyOnLand(630, 270, R) && Math.abs(630 - game.guard.fixedX) > R + game.guard.radius, 'Espaço livre à esquerda da linha do guarda para desviar');
assert(game.isBodyEntirelyOnLand(850, 270, R) && Math.abs(850 - game.guard.fixedX) > R + game.guard.radius, 'Espaço livre à direita da linha do guarda para desviar');
assert(game.isBodyEntirelyOnLand(730, 95, R) && (game.guard.minY - 95) > R + game.guard.radius, 'Espaço livre ao norte da linha do guarda para contornar');
assert(game.isBodyEntirelyOnLand(730, 445, R) && (445 - game.guard.maxY) > R + game.guard.radius, 'Espaço livre ao sul da linha do guarda para contornar');

// 5. Teste de Pausa e Retomada (incluindo parada do guarda e ausência de saltos)
console.log('\n5. Teste de Pausa (Lula e Guarda) e Retomada sem Saltos:');
game.restartGame();
game.updateGuard(0.5);
const guardYBeforePause = game.guard.y;
game.pauseGame('Teste de pausa');
assert(game.getGameState() === game.STATE_PAUSED, 'Jogo entra em estado PAUSED');

// Tentar atualizar jogador e guarda durante a pausa
game.input.right = true;
game.updatePlayer(1.0);
game.updateGuard(1.0);
assert(game.lula.x === 180 && game.guard.y === guardYBeforePause, 'Tanto Lula quanto o guarda FlavioB ficam parados durante a pausa');
game.input.right = false;

game.resumeGame();
assert(game.getGameState() === game.STATE_PLAYING, 'Jogo retoma para PLAYING com resumeGame()');
assert(game.guard.y === guardYBeforePause, 'Retomar não causa salto de posição no guarda');

// 6. Teste de Derrota ao tocar no Guarda ("O fascismo alcançou você")
console.log('\n6. Teste de Derrota ao Contatar o Guarda:');
game.restartGame();
// Colocar Lula em contato com FlavioB
game.lula.x = game.guard.x;
game.lula.y = game.guard.y + 10;
game.updatePlayer(0.016);

assert(game.getGameState() === game.STATE_DEFEAT, 'Contato com FlavioB muda o estado para STATE_DEFEAT');
assert(game.DEFEAT_TEXT === 'O fascismo alcançou você', 'Texto de derrota é exatamente "O fascismo alcançou você"');
assert(mockElements['state-text'].textContent.includes('O fascismo alcançou você'), 'Painel de estado mostra "O fascismo alcançou você"');

// Garantir que Lula e o guarda param após a derrota
const defeatLulaX = game.lula.x;
const defeatGuardY = game.guard.y;
game.input.left = true;
game.updatePlayer(0.5);
game.updateGuard(0.5);
assert(game.lula.x === defeatLulaX && game.guard.y === defeatGuardY, 'Movimento de Lula e do guarda para imediatamente após a derrota');
game.input.left = false;

// 7. Teste de Coleta Única, 10 Coletas (Vitória) e Reinício Completo
console.log('\n7. Teste de Coleta sem Repetição, Vitória (10/10) e Reinício Completo:');
game.restartGame();
assert(game.getGameState() === game.STATE_PLAYING, 'Reiniciar após derrota restaura partida ativa');
assert(game.lula.x === 180 && game.lula.y === 270, 'Reiniciar restaura posição inicial de Lula');
assert(game.guard.x === game.INITIAL_GUARD.x && game.guard.y === game.INITIAL_GUARD.y && game.guard.dirY === 1, 'Reiniciar restaura posição e direção inicial do guarda FlavioB');

// Coletar a primeira constituição sem repetição
const firstTarget = game.constitutions[0];
game.lula.x = firstTarget.x;
game.lula.y = firstTarget.y;
game.checkConstitutionCollections();
assert(firstTarget.collected === true && game.getCollectedCount() === 1, 'Primeira constituição coletada (1/10)');
game.checkConstitutionCollections();
assert(game.getCollectedCount() === 1, 'Coleta não se repete no mesmo local');

// Coletar as demais até 10/10 (desviando do guarda)
game.guard.y = 390; // Guarda lá embaixo enquanto Lula coleta
for (let i = 1; i < game.constitutions.length; i++) {
  const target = game.constitutions[i];
  game.lula.x = target.x;
  game.lula.y = target.y;
  game.checkConstitutionCollections();
}

assert(game.getCollectedCount() === 10, 'Contador atingiu 10/10');
assert(game.isInRecoveryStage() === true && game.getGameState() === game.STATE_PLAYING, 'Dez coletas iniciam automaticamente a etapa de colocação de bandeiras sem precisar clicar em botão');
assert(mockElements['state-text'].textContent.includes('Resgate concluído'), 'Vitória exibe "Resgate concluído"');

// Reiniciar após concluir o resgate
game.restartGame();
assert(game.getCollectedCount() === 0 && mockElements['constitution-counter'].textContent === '0/10', 'Reiniciar zera o contador para 0/10');
assert(game.constitutions.every(c => c.collected === false), 'Reiniciar restaura as 10 constituições');
assert(game.lula.x === 180 && game.lula.y === 270, 'Reiniciar restaura Lula para (180, 270)');
assert(game.guard.x === 730 && game.guard.y === 140, 'Reiniciar restaura o guarda FlavioB');

// 8. Verificação de Alta Resolução (HiDPI / Full HD), Transição do Túnel e Detalhes de Folhas
console.log('\n8. Verificação de Alta Resolução, Transição do Túnel e Detalhes de Folhas:');
assert(typeof game.setupHighResCanvas === 'function' && mockElements['gameCanvas'].width >= 1920, `Canvas configurado em alta definição (${mockElements['gameCanvas'].width}x${mockElements['gameCanvas'].height})`);
assert(typeof game.drawLeafCluster === 'function', 'Possui função drawLeafCluster() para desenhar folhas com lâmina e nervura central');
assert(game.DENSE_FOREST_TREES.every(t => Array.isArray(t.leaves) && t.leaves.length > 0 && Array.isArray(t.lobes)), 'Todas as árvores da mata fechada possuem lóbulos e folhas detalhadas');
assert(gameJsContent.includes('roadBlend') && gameJsContent.includes('sidewalkGrad'), 'Túnel possui rampas e gradientes suaves de transição entre Senado e Avenida Paulista');
assert(gameJsContent.includes("e.code === 'KeyR'") && gameJsContent.includes('restartGame()'), 'Tecla R configurada para reiniciar a partida');
assert(!gameJsContent.includes('🌴'), 'Emojis de palmeiras removidos do Senado');

// 9. Teste de Recuperar Democracia: Mapa Devastado, Palanques, Bandeiras, Reserva, Vida na Paulista e Reinício
console.log('\n9. Teste da Etapa Recuperar Democracia (Palanques, Bandeiras, Reserva, Pombos/Ratos e Reinício):');
game.restartGame();
assert(game.getRestorationProgress() === 0, 'Mapa inicia devastado (progresso de restauração = 0, vegetação queimada e árvores sem folhas)');
assert(typeof game.drawBareTreeBranches === 'function', 'Possui função drawBareTreeBranches() para desenhar árvores secas sem folhas no mapa devastado');
assert(!htmlContent.includes('id="btn-recover"'), 'Não exige botão separado para entrar na etapa de colocação de bandeiras');

// Garantir que a colocação de bandeiras não começa antes da vitória
const startedEarly = game.startRecoveryPhase();
assert(startedEarly === false && !game.isInRecoveryStage(), 'Etapa Recuperar Democracia não pode iniciar antes de coletar as 10 constituições');
assert(game.placeFlag() === false, 'Não é possível colocar bandeiras durante a fase de resgate');

// Coletar todas as 10 constituições para vencer o resgate e entrar automaticamente na colocação de bandeiras
game.guard.y = 390;
for (let i = 0; i < game.constitutions.length; i++) {
  game.lula.x = game.constitutions[i].x;
  game.lula.y = game.constitutions[i].y;
  game.checkConstitutionCollections();
}
assert(game.isInRecoveryStage() === true, 'Ao coletar a 10ª constituição, entra automaticamente na etapa de colocação de bandeiras sem precisar clicar em botão');
assert(game.getGameState() === game.STATE_PLAYING, 'Jogo permanece ativo em STATE_PLAYING sem interromper o jogador');
assert(game.guard.active === false, 'Etapa Recuperar Democracia é sem perigo (FlavioB desativado)');
assert(game.getReserveCount() === 10 && mockElements['reserve-counter'].textContent === '10', 'Inicia etapa com 10 constituições na reserva');
assert(game.getFlagsPlaced() === 0, 'Inicia etapa com 0 bandeiras colocadas');

// Verificar palanques espalhados pelo Senado e Paulista (> 10 para distribuição livre)
const senadoPodiums = game.podiums.filter(p => p.zone === 'senado');
const paulistaPodiums = game.podiums.filter(p => p.zone === 'paulista');
assert(game.podiums.length > 10 && senadoPodiums.length >= 5 && paulistaPodiums.length >= 6, `Vários palanques espalhados pelo Senado (${senadoPodiums.length}) e Paulista (${paulistaPodiums.length}) para livre escolha`);
assert(game.podiums.every(p => game.isBodyEntirelyOnLand(p.x, p.y, R)), 'Todos os palanques são alcançáveis por Lula');

// Testar colocação de 1 bandeira ao tocar no primeiro palanque (1 ação = 1 constituição gasta, nunca 2)
const p0 = game.podiums[0];
game.lula.x = p0.x;
game.lula.y = p0.y;
const reserveBeforeFirst = game.getReserveCount();
const placedFirst = game.placeFlag();
const spentInOneAction = reserveBeforeFirst - game.getReserveCount();
assert(placedFirst === true && p0.hasFlag === true, 'Acionar palanque em que Lula está tocando coloca uma bandeira');
assert(spentInOneAction === 1 && game.getReserveCount() === 9 && game.getFlagsPlaced() === 1, 'Uma única ação gasta exatamente 1 constituição (nunca gasta duas constituições)');
assert(Math.abs(game.getRestorationProgress() - 0.1) < 1e-6, 'Progresso de restauração sobe gradualmente (10% na 1ª bandeira)');
assert(mockElements['state-text'].textContent.includes('O Brasil voltando à vida'), 'Exibe "O Brasil voltando à vida" ao colocar bandeiras');

// Testar pausa durante a etapa de recuperação
game.pauseGame('Teste de pausa na recuperação');
assert(game.getGameState() === game.STATE_PAUSED, 'Pausa funciona normalmente durante a etapa Recuperar Democracia');
assert(game.placeFlag() === false, 'Não permite colocar bandeira enquanto pausado');
game.resumeGame();

// Distribuir livremente as 9 constituições restantes nos próximos 9 palanques (deixando 4 vazios)
for (let i = 1; i < 10; i++) {
  const pod = game.podiums[i];
  game.lula.x = pod.x;
  game.lula.y = pod.y;
  const reserveBefore = game.getReserveCount();
  const ok = game.placeFlag();
  assert(ok === true && (reserveBefore - game.getReserveCount() === 1), `Bandeira ${i + 1}/10 colocada com sucesso no palanque #${pod.id} (${pod.zone}) gastando 1 constituição`);
}

assert(game.getReserveCount() === 0 && mockElements['reserve-counter'].textContent === '0', 'Reserva zerou após 10 bandeiras colocadas');
assert(game.getFlagsPlaced() === 10 && game.getRestorationProgress() === 1, '10 bandeiras colocadas: Paulista 100% colorida, árvores com folhas e vida nova');
assert(mockElements['mission-banner'].textContent.includes('O Brasil voltando à vida') && mockElements['state-text'].textContent.includes('O Brasil voltando à vida'), 'Mensagem "O Brasil voltando à vida" destacada ao concluir as 10 bandeiras');
assert(Array.isArray(game.PIGEONS) && game.PIGEONS.length >= 6 && Array.isArray(game.RATS) && game.RATS.length >= 5 && typeof game.drawPaulistaWildlife === 'function', 'Pombos voando e ratos presentes na vida nova da Avenida Paulista');

// Quando a reserva zerar, impedir novas colocações de bandeiras mesmo em palanque vazio
const emptyPodium = game.podiums[10];
game.lula.x = emptyPodium.x;
game.lula.y = emptyPodium.y;
const blockedWhenZero = game.placeFlag();
assert(blockedWhenZero === false && emptyPodium.hasFlag === false && game.getReserveCount() === 0 && game.getFlagsPlaced() === 10, 'Quando a reserva zera (0), impede novas colocações de bandeiras em palanques vazios');

// Reiniciar limpa as bandeiras e restaura o resgate inicial, com 10 constituições e o FlavioB
game.restartGame();
assert(!game.isInRecoveryStage() && game.getFlagsPlaced() === 0 && game.getReserveCount() === 0, 'Reiniciar limpa a etapa de recuperação e zera bandeiras/reserva');
assert(game.podiums.every(p => p.hasFlag === false), 'Reiniciar limpa todas as bandeiras dos palanques');
assert(game.getRestorationProgress() === 0, 'Reiniciar restaura o mapa devastado inicial');
assert(game.constitutions.length === 10 && game.constitutions.every(c => c.collected === false) && game.getCollectedCount() === 0, 'Reiniciar restaura as 10 constituições e o contador 0/10');
assert(game.guard.active === true && game.guard.x === 730 && game.guard.y === 140, 'Reiniciar restaura o guarda FlavioB ativo na Avenida Paulista');

console.log(`\n========================================`);
console.log(`RESULTADO FINAL: ${testsPassed} passaram, ${testsFailed} falharam.`);
console.log(`========================================`);

if (testsFailed > 0) {
  process.exit(1);
}
