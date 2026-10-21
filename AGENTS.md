# AGENTS.md - Ilha Viva

Documento de decisões de design, arquitetura e diretrizes operacionais para o desenvolvimento do jogo **Ilha Viva**.

---

## 1. Visão Geral do Jogo
- **Título**: Brasil Vivo
- **Gênero / Estilo**: Aventura 2D em visão top-down / visão aérea.
- **Protagonista**: Lula, um senhor explorador de cerca de 80 anos, de cabelos e barba brancos, segurando uma maleta em uma mão e uma bengala na outra.
- **Objetivo**: 
  1. Recuperar 10 constituições pelo cenário.
  2. Plantar as 10 sementes da democracia para devolver à ilha a democracia.

---

## 2. Cenário e Dinâmica de Jogo
- **Ambientes**:
  - **Senado** e **avenida paulista**, conectados por um tunel.
- **Fronteiras e Restrições**:
  - Lula deve permanecer em terra firme (limites intransponíveis para água/mar).
  - Todas as sementes devem ser acessíveis e alcançáveis por terra.
- **Inimigos / Desafios**:
  - **Flavio**: Patrulha ativamente a região do bosque.
  - O contato físico com o guarda encerra a expedição/resgate (derrota/recomeço).
- **Progressão**:
  - Fase de Coleta: Coleta de 10 constituições.
  - Fase de Apoio ao povo: Atingir 10 coletas desbloqueia e permite iniciar o plano do novo governo.

---

## 3. Tecnologias e Arquitetura
- **Stack**: HTML5, CSS3, JavaScript puro (Vanilla JS) e HTML5 Canvas 2D.
- **Zero Dependências**: Nenhuma biblioteca externa ou framework (sem dependências npm, CDNs externas, etc.).
- **Responsividade e Adaptação**:
  - Tela adaptável a diferentes resoluções e dispositivos (desktop e mobile).
- **Acessibilidade e Feedback Sensorial**:
  - Indicadores e sinais visuais/auditivos acessíveis: nunca depender exclusivamente de cor ou de som para comunicar estados, perigos ou objetivos (usar ícones, textos, formas, animações).

---

## 4. Controles e Interação
- **Movimentação de Lula**:
  - Teclado: Teclas **WASD** e **Setas direcionais**.
  - Toque (Mobile / Touch): Botões táteis na tela / D-Pad virtual.
- **Pausa**:
  - Tecla **P** (ou botão de interface correspondente) pausa e retoma o jogo.
- **Ações Especiais**:
  - Tecla **Espaço**: Reservada exclusivamente para a habilidade de escudo opcional.
- **Navegação de Interface**:
  - Todos os botões da interface devem ser totalmente operáveis via teclado (foco por Tab, acionamento por Enter/Espaço).
  - Indicação visual clara e explícita de qual botão está selecionado/em foco no momento.

---

## 5. Diretrizes para Próximos Passos e Iterações
- **Preservação**: Preservar sempre o que já está funcionando em implementações anteriores.
- **Testes e Verificação**: Testar e validar tudo o que for alterado ou adicionado a cada iteração.
- **Status Atual**: Apenas registro e salvamento de decisões neste estágio; implementação de código postergada para as próximas instruções.
