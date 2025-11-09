const ASSETS = {
  COLOR: {
    // Cores do asfalto
    ASFALTO: ["#585758ff", "#535253ff"],
    // Cores das faixas 
    FAIXA: ["#959298", "#f9fd00ff"],
    // Cores da areia
    AREIA: ["#eedccd", "#e6d4c5"],
  },

  // Define imagens 
  IMAGE: {
    // Sprite de uma árvore.
    TREE: {
      src: "img/tree.png",
      width: 142,
      height: 200,
    },

    // Sprite do carro do jogador
    HERO: {
      src: "img/hero.png",
      width: 110,
      height: 56,
    },

    // Sprite dos carros 
    CAR: {
      src: "img/car04.png",
      width: 110, 
      height: 56, 
    },

    // Sprite da linha de chegada.
    FINISH: {
      src: "img/finish.png",
      width: 339,
      height: 180,
      offset: -0.5, // Posição de deslocamento horizontal na pista.
    },

    // Imagem de fundo do céu/nuvens.
    SKY: {
      src: "img/img/ceu.png",
    },
  },

  // Define URLs dos arquivos de áudio.
  AUDIO: {
    theme:
      "https://s3-us-west-2.amazonaws.com/s.cdpn.io/155629/theme.mp3",
    engine:
      "https://s3-us-west-2.amazonaws.com/s.cdpn.io/155629/engine.wav",
    honk: "https://s3-us-west-2.amazonaws.com/s.cdpn.io/155629/honk.wav",
    beep: "https://s3-us-west-2.amazonaws.com/s.cdpn.io/155629/beep.wav",
  },
};

// ------------------------------------------------------------
// Variáveis e Funções Auxiliares (Helpers)
// ------------------------------------------------------------

// Adiciona um método para preencher números com zeros à esquerda (ex: 1 -> 001).
Number.prototype.pad = function (numZeros, char = 0) {
  // Garante que trabalhamos com inteiros e transforma o char em string
  let n = Math.abs(Math.floor(this));
  let zeros = Math.max(0, numZeros - n.toString().length);
  let ch = String(char);
  // Cria uma string com 'zeros' repetições do caractere desejado
  let zeroString = ch.repeat(zeros);
  return zeroString + n;
};

// Adiciona um método para limitar um número entre um valor mínimo e um máximo.
Number.prototype.clamp = function (min, max) {
  return Math.max(min, Math.min(this, max));
};

// Retorna o timestamp atual (tempo em milissegundos).
const timestamp = (_) => new Date().getTime();
// Calcula a nova velocidade após a aceleração. v = velocidade atual, accel = aceleração, dt = tempo decorrido.
const accelerate = (v, accel, dt) => v + accel * dt;
// Verifica se há colisão entre dois objetos (x1/x2 = posições, w1/w2 = "larguras").
const isCollide = (x1, w1, x2, w2) => (x1 - x2) ** 2 <= (w2 + w1) ** 2;

// Gera um número inteiro aleatório entre min e max.
function getRand(min, max) {
  return (Math.random() * (max - min) + min) | 0;
}

// Retorna um valor aleatório de um objeto (usado para escolher uma faixa aleatória de carro, por exemplo).
function randomProperty(obj) {
  let keys = Object.keys(obj);
  return obj[keys[(keys.length * Math.random()) << 0]];
}

// Função principal para desenhar um quadrilátero no canvas (usado para desenhar a estrada e suas faixas).
function drawQuad(color, x1, y1, w1, x2, y2, w2) {
  ctx.fillStyle = color;
  ctx.beginPath();
  
  // Define os 4 pontos do quadrilátero (x1, y1, w1 = ponto superior; x2, y2, w2 = ponto inferior).
  ctx.moveTo(x1 + w1, y1);
  ctx.lineTo(x2 + w2, y2);
  ctx.lineTo(x2 - w2, y2);
  ctx.lineTo(x1 - w1, y1);
  
  ctx.closePath();
  ctx.fill();
}

// Armazena o estado das teclas pressionadas.
const KEYS = {};
// Função chamada ao pressionar/soltar teclas para atualizar o estado em KEYS.
const keyUpdate = (e) => {
  KEYS[e.code] = e.type === `keydown`;
  e.preventDefault(); // Impede o comportamento padrão do navegador (como rolagem).
};
addEventListener(`keydown`, keyUpdate);
addEventListener(`keyup`, keyUpdate);

// Retorna uma Promise que resolve após um certo tempo (usado para criar atrasos).
function sleep(ms) {
  return new Promise(function (resolve, reject) {
    setTimeout((_) => resolve(), ms);
  });
}

// ------------------------------------------------------------
// Classes
// ------------------------------------------------------------

// Representa um segmento (linha) da estrada.
class Line {
  constructor() {
    // Coordenadas 3D no mundo do jogo (x, y, z).
    this.x = 0; // Deslocamento horizontal em 3D.
    this.y = 0; // Altura (elevação) em 3D.
    this.z = 0; // Profundidade (distância na pista) em 3D.

    // Coordenadas projetadas em 2D na tela (X, Y, W = largura).
    this.X = 0;
    this.Y = 0;
    this.W = 0;

    // Propriedades do segmento.
    this.curve = 0; // Curvatura do segmento.
    this.scale = 0; // Escala (fator de perspectiva).

    this.special = null; // Objeto especial (como a linha de chegada).
  }

  // Calcula a projeção 2D do segmento na tela (perspectiva).
  project(camX, camY, camZ) {
    // Calcula a escala baseada na distância (quanto mais longe, menor a escala).
    this.scale = camD / (this.z - camZ);
    // Calcula a posição horizontal 2D (X).
    this.X = (1 + this.scale * (this.x - camX)) * halfWidth;
    // Calcula a posição vertical 2D (Y).
    this.Y = Math.ceil(((1 - this.scale * (this.y - camY)) * height) / 2);
    // Calcula a largura 2D (W).
    this.W = this.scale * roadW * halfWidth;
  }

  // Desenha um sprite (árvore, carro, linha de chegada) no segmento de estrada.
  drawSprite(sprite, offset) {
    let image = sprite.img; 
    if (!image) return; 

    // Calcula a posição de destino X e Y do sprite na tela.
    let destX = this.X + this.W * offset;
    let destY = this.Y + 4;
    
    // Calcula a largura e altura do sprite baseado na perspectiva (W da linha).
    let destW = (sprite.width * this.W) / 250; 
    let destH = (sprite.height * this.W) / 250;

    // Ajusta a posição para que o sprite seja desenhado corretamente (centralizado/ancorado).
    destX -= destW / 2; // <--- ESTA É A LINHA CORRETA
    destY += destH * -1;
    
    // Desenha a imagem no canvas.
    ctx.drawImage(image, destX, destY, destW, destH);
  }
}

// Representa um carro inimigo na pista.
class Car {
  constructor(pos, type, lane) {
    this.pos = pos; // Posição Z na pista (em segmentos).
    this.type = type; // Objeto do sprite do carro.
    this.lane = lane; // Posição horizontal (faixa) na pista.
  }
}

// Gerencia a reprodução de áudio.
class Audio {
  constructor() {
    this.audioCtx = new AudioContext(); // Cria o contexto de áudio do navegador.

    this.destination = this.audioCtx.createGain(); // Nó para controlar o volume principal.
    this.volume = 1;
    this.destination.connect(this.audioCtx.destination); // Conecta ao hardware de áudio.

    this.files = {}; // Armazena os buffers de áudio carregados.

    let _self = this;
    // Carrega a música tema e a reproduz em loop com volume reduzido.
    this.load(ASSETS.AUDIO.theme, "theme", function (key) {
      let source = _self.audioCtx.createBufferSource();
      source.buffer = _self.files[key];

      let gainNode = _self.audioCtx.createGain();
      gainNode.gain.value = 0.6;
      source.connect(gainNode);
      gainNode.connect(_self.destination);

      source.loop = true;
      source.start(0);
    });
  }

  // Getter para o volume atual.
  get volume() {
    return this.destination.gain.value;
  }

  // Setter para definir o volume.
  set volume(level) {
    this.destination.gain.value = level;
  }

  // Reproduz um som, opcionalmente ajustando o 'pitch' (altura).
  play(key, pitch) {
    if (this.files[key]) {
      let source = this.audioCtx.createBufferSource();
      source.buffer = this.files[key];
      source.connect(this.destination);
      if (pitch) source.detune.value = pitch; // Altera a frequência (pitch).
      source.start(0);
    } else this.load(key, () => this.play(key)); // Se não estiver carregado, tenta carregar e reproduzir.
  }

  // Carrega um arquivo de áudio via XMLHttpRequest e o decodifica.
  load(src, key, callback) {
    let _self = this;
    let request = new XMLHttpRequest();
    request.open("GET", src, true);
    request.responseType = "arraybuffer";
    request.onload = function () {
      _self.audioCtx.decodeAudioData(
        request.response,
        function (beatportBuffer) {
          _self.files[key] = beatportBuffer; // Armazena o buffer de áudio decodificado.
          if (callback) callback(key);
        },
        function () {}
      );
    };
    request.send();
  }
}

// ------------------------------------------------------------
// Variáveis Globais
// ------------------------------------------------------------

// Array para armazenar os melhores tempos (scores).
const highscores = [];

// Dimensões do canvas.
const width = 800;
const halfWidth = width / 2;
const height = 500;
// Largura da estrada em unidades do jogo.
const roadW = 4000;
// Comprimento de um segmento de estrada (em unidades).
const segL = 200;
// Distância da câmera (perspectiva).
const camD = 0.2;
// Altura da câmera (distância vertical do chão).
const H = 1500;
// Número de segmentos de estrada visíveis/renderizados.
const N = 70;

// Configurações de velocidade e aceleração do carro.
const maxSpeed = 200;
const accel = 38; // Aceleração normal.
const breaking = -80; // Desaceleração de freio.
const decel = -40; // Desaceleração por inércia/soltar acelerador.
const maxOffSpeed = 40; // Velocidade máxima fora da pista principal.
const offDecel = -70; // Desaceleração fora da pista.
const enemy_speed = 8; // Velocidade dos carros inimigos.
const hitSpeed = 20; // Velocidade após uma colisão.

// Posições horizontais (em unidades do jogo) para as faixas (A, B, C).
const LANE = {
 A: -0.7, // Faixa esquerda (dentro de -1.0)
 B: 0, // Faixa central
 C: 0.7, // Faixa direita (dentro de 1.0)
};

// Comprimento total da pista.
const mapLength = 15000;

// Variáveis do loop do jogo.
let then = timestamp(); // Último tempo registrado.
const targetFrameRate = 1000 / 25; // Define o alvo de 25 frames por segundo (em ms).

let audio; // Objeto de áudio.

// Variáveis de estado do jogo.
let inGame; // Booleano: se o jogo está ativo.
let start; // Timestamp do início da volta.
let playerX; // Posição horizontal do jogador.
let speed; // Velocidade atual.
let scoreVal; // Pontuação/distância percorrida.
let pos; // Posição Z total percorrida na pista (global).
let cloudOffset; // Deslocamento para o fundo de nuvens.
let sectionProg; // Progresso na seção de mapa atual.
let mapIndex; // Índice da seção de mapa atual.
let countDown; // Cronômetro de tempo restante.
let lines = []; // Array de objetos Line (segmentos da estrada).
let cars = []; // Array de objetos Car (carros inimigos).

// Variáveis globais do Canvas.
let roadCanvas; // Referência ao elemento Canvas.
let ctx; // Contexto de renderização 2D do Canvas.
let loadedImages = 0; // Contador de imagens carregadas.
let totalImages = Object.keys(ASSETS.IMAGE).length; // Total de imagens a carregar.


// ------------------------------------------------------------
// Geração e Estrutura do Mapa
// ------------------------------------------------------------

// Função auxiliar (não usada no código atual, mas definida)
function getFun(val) {
  return (i) => val;
}

// Gera o mapa da pista, composto por seções de curvas e elevações.
function genMap() {
  let map = [];
  // Loop para criar seções aleatórias do mapa.
  for (var i = 0; i < mapLength; i += getRand(0, 50)) {
    let section = {
      from: i, // Início da seção.
      to: (i = i + getRand(300, 600)), // Fim da seção (i é atualizado para o próximo início).
    };

    let randHeight = getRand(-5, 5); // Altura aleatória.
    let randCurve = getRand(5, 30) * (Math.random() >= 0.5 ? 1 : -1); // Curva aleatória (esquerda/direita).
    let randInterval = getRand(20, 40); // Intervalo para variação de altura/curva.

    // Atribui funções de curva e altura para a seção, criando variações.
    if (Math.random() > 0.9)
      Object.assign(section, {
        curve: (_) => randCurve,
        height: (_) => randHeight,
      });
    else if (Math.random() > 0.8)
      Object.assign(section, {
        curve: (_) => 0,
        height: (i) => Math.sin(i / randInterval) * 1000, // Altura ondulatória.
      });
    else if (Math.random() > 0.8)
      Object.assign(section, {
        curve: (_) => 0,
        height: (_) => randHeight,
      });
    else
      Object.assign(section, {
        curve: (_) => randCurve,
        height: (_) => 0,
      });

    map.push(section); // Adiciona a seção ao mapa.
  }

  // Adiciona a seção da linha de chegada ao final.
  map.push({
    from: i,
    to: i + N,
    curve: (_) => 0,
    height: (_) => 0,
    special: ASSETS.IMAGE.FINISH,
  });
  // Adiciona uma seção "infinita" após a linha de chegada.
  map.push({ from: Infinity });
  return map;
}

// Gera o mapa da pista uma vez.
let map = genMap();

// ------------------------------------------------------------
// Controles Adicionais (Teclado)
// ------------------------------------------------------------

// Listener para a tecla `keyup` (soltar a tecla).
addEventListener(`keyup`, function (e) {
  // Tecla 'M': Liga/desliga o volume do áudio.
  if (e.code === "KeyM") {
    e.preventDefault();

    audio.volume = audio.volume === 0 ? 1 : 0;
    return;
  }

  // Tecla 'C' (ou Enter no contexto do jogo original): Inicia o jogo com contagem regressiva.
  if (e.code === "KeyC") {
    e.preventDefault();

    if (inGame) return; // Não faz nada se já estiver no jogo.

    // Sequência de contagem regressiva e som 'beep'.
    sleep(0)
      .then((_) => {
        text.classList.remove("blink");
        text.innerText = 3;
        audio.play("beep");
        return sleep(1000);
      })
      .then((_) => {
        text.innerText = 2;
        audio.play("beep");
        return sleep(1000);
      })
      .then((_) => {
        reset(); // Reseta o estado do jogo.

        // Esconde tela inicial, mostra carro e HUD.
        home.style.display = "none";
        hero.style.display = "block";
        hud.style.display = "block";

        audio.play("beep", 500); // Som de início de corrida.

        inGame = true; // Inicia o jogo.
      });

    return;
  }

  // Tecla 'Escape': Reseta o jogo para a tela inicial.
  if (e.code === "Escape") {
    e.preventDefault();

    reset();
  }
});

// ------------------------------------------------------------
// Loop Principal do Jogo
// ------------------------------------------------------------

// Função de atualização a cada quadro (step = tempo decorrido desde o último quadro em segundos).
function update(step) {
  // Atualiza a posição Z (profundidade) do jogador, simulando o movimento circular da estrada.
  pos += speed;
  while (pos >= N * segL) pos -= N * segL; // Garante que pos fique dentro do comprimento N*segL.
  while (pos < 0) pos += N * segL;

  // Calcula a posição do segmento de estrada visível mais próximo do jogador (startPos).
  var startPos = (pos / segL) | 0;
  // Calcula a posição do último segmento de estrada (mais distante) que será reusado.
  let endPos = (startPos + N - 1) % N;

  // Atualiza pontuação e cronômetro.
  scoreVal += speed * step;
  countDown -= step;

  // Movimento horizontal automático devido à curva da estrada.
  playerX -= (lines[startPos].curve / 5000) * step * speed;

  // Controle de movimento lateral do jogador com as setas.
  if (KEYS.ArrowRight)
    (hero.style.backgroundPosition = "-220px 0"), // Altera sprite do carro para a direita.
      (playerX += 0.007 * step * speed);
  else if (KEYS.ArrowLeft)
    (hero.style.backgroundPosition = "0 0"), // Altera sprite do carro para a esquerda.
      (playerX -= 0.007 * step * speed);
  else hero.style.backgroundPosition = "-110px 0"; // Sprite do carro centralizado.

  // Limita a posição horizontal do jogador.
  playerX = playerX.clamp(-3, 3);

  // Controle de velocidade (aceleração/frenagem/desaceleração).
  if (inGame && KEYS.ArrowUp) speed = accelerate(speed, accel, step);
  else if (KEYS.ArrowDown) speed = accelerate(speed, breaking, step);
  else speed = accelerate(speed, decel, step);

// Desaceleração se o jogador estiver fora da pista principal (areia).
if (Math.abs(playerX) > 1.15 && speed >= maxOffSpeed) {
    speed = accelerate(speed, offDecel, step);
}

  // Limita a velocidade entre 0 e maxSpeed.
  speed = speed.clamp(0, maxSpeed);

  // Atualiza o mapa (curvatura e elevação) no segmento de estrada mais distante (endPos).
  let current = map[mapIndex];
  let use = current.from < scoreVal && current.to > scoreVal;
  if (use) sectionProg += speed * step; // Acompanha o progresso na seção atual.
  lines[endPos].curve = use ? current.curve(sectionProg) : 0; // Aplica a curva da seção.
  lines[endPos].y = use ? current.height(sectionProg) : 0; // Aplica a elevação da seção.
  lines[endPos].special = null;

  // Avança para a próxima seção do mapa quando a atual terminar.
  if (current.to <= scoreVal) {
    mapIndex++;
    sectionProg = 0;

    lines[endPos].special = map[mapIndex].special; // Aplica o sprite especial da próxima seção (ex: linha de chegada).
  }

  // Lógica de fim de jogo e atualização da interface (UI).
  if (!inGame) {
    speed = accelerate(speed, breaking, step);
    speed = speed.clamp(0, maxSpeed);
  } else if (countDown <= 0 || lines[startPos].special) { // Fim de jogo por tempo ou linha de chegada.
    tacho.style.display = "none";

    home.style.display = "block";
    text.innerText = "Pressione Enter para jogar!";

    // Salva o tempo atual no ranking.
    highscores.push(lap.innerText);
    highscores.sort();
    updateHighscore();

    inGame = false;
  } else {
    // Atualiza a interface (tempo, pontuação, velocidade, tempo de volta).
    time.innerText = (countDown | 0).pad(3);
    score.innerText = (scoreVal | 0).pad(8);
    tacho.innerText = speed | 0;

    let cT = new Date(timestamp() - start);
    lap.innerText = `${cT.getMinutes()}'${cT.getSeconds().pad(2)}"${cT
      .getMilliseconds()
      .pad(3)}`;
  }

  // Reproduz o som do motor, ajustando o pitch com base na velocidade.
  if (speed > 0) audio.play("engine", speed * 4);

  // Move o fundo de nuvens (DOM) com base na curva da pista.
  cloud.style.backgroundPosition = `${
    (cloudOffset -= lines[startPos].curve * step * speed * 0.13) | 0
  }px 0`;

  // Atualização dos carros inimigos.
  for (let car of cars) {
    car.pos = (car.pos + enemy_speed * step) % N; // Move o carro.

    // Reposiciona o carro inimigo (respawn) se ele passou da visão (endPos).
    if ((car.pos | 0) === endPos) {
      if (speed < 30) car.pos = startPos;
      else car.pos = endPos - 2; // Posiciona um pouco mais perto se a velocidade for alta.
      car.lane = randomProperty(LANE); // Escolhe uma faixa aleatória.
    }

    // Verificação de colisão com o jogador.
    const offsetRatio = 5;
    if (
      (car.pos | 0) === startPos && // O carro inimigo está no mesmo segmento que o jogador.
      isCollide(playerX, 0.2, car.lane, 0.2) // <<-- LINHA TOTALMENTE MODIFICADA
    ) {
      speed = Math.min(hitSpeed, speed); // Reduz a velocidade após a colisão.
      if (inGame) audio.play("honk"); // Toca o som de buzina/colisão.
    }
  }
  
  // Limpa todo o canvas a cada quadro.
  ctx.clearRect(0, 0, width, height);

  // Desenho da estrada.
  let maxy = height; // Y máximo visível (parte inferior da tela).
  let camH = H + lines[startPos].y; // Altura efetiva da câmera (H + elevação da pista).
  let x = 0; // Posição horizontal acumulada.
  let dx = 0; // Mudança horizontal acumulada (devido à curva).

  // Loop para desenhar os segmentos de estrada (N segmentos visíveis).
 // --- INÍCIO DA CORREÇÃO ---

  // Loop 1: Desenha APENAS a estrada (de trás para frente)
  for (let n = startPos; n < startPos + N; n++) {
    let l = lines[n % N]; // Segmento de estrada atual (usa módulo N para loop).

    // Projeta as coordenadas 3D para 2D.
    l.project(
      playerX * roadW - x, // Ajusta o desvio horizontal da câmera.
      camH,
      startPos * segL - (n >= N ? N * segL : 0) // Ajusta a profundidade (Z).
    );
    x += dx;
    dx += l.curve;

    if (l.Y >= maxy) {
      l.visible = false; 
      continue; // Pula se o segmento estiver abaixo do segmento anterior (não visível).
    }

    // Se o loop chegou aqui, o segmento é visível
    l.visible = true; 
    maxy = l.Y; // Atualiza o Y máximo visível (AGORA ESTÁ FORA E DEPOIS DO 'IF')

    let even = ((n / 2) | 0) % 2; // ...
    let areia = ASSETS.COLOR.AREIA[even * 1]; // Cor da grama.
    let faixa = ASSETS.COLOR.FAIXA[even * 1]; // Cor da faixa de trepidação.
    let asfalto = ASSETS.COLOR.ASFALTO[even * 1]; // Cor do asfalto.

    let p = lines[(n - 1) % N]; // Segmento anterior (para desenhar o quadrilátero entre p e l).

    // Desenha a Estrada usando drawQuad:
    // Grama esquerda
    drawQuad(areia, width / 4, p.Y, halfWidth + 2, width / 4, l.Y, halfWidth);
    // Grama direita
    drawQuad(areia, (width / 4) * 3, p.Y, halfWidth + 2, (width / 4) * 3, l.Y, halfWidth);

    // Faixa lateral e asfalto principal.
    drawQuad(faixa, p.X, p.Y, p.W * 1.15, l.X, l.Y, l.W * 1.15);
    drawQuad(asfalto, p.X, p.Y, p.W, l.X, l.Y, l.W);

    if (!even) {
      // Linha central (faixa tracejada) - desenha a cor da faixa e depois a cor do asfalto.
      drawQuad(ASSETS.COLOR.FAIXA[1], p.X, p.Y, p.W * 0.4, l.X, l.Y, l.W * 0.4);
      drawQuad(asfalto, p.X, p.Y, p.W * 0.35, l.X, l.Y, l.W * 0.35);
    }
    
    // TODAS AS CHAMADAS drawSprite() FORAM MOVIDAS PARA O PRÓXIMO LOOP
  }

  // Loop 2: Desenha APENAS os sprites (de trás para frente)
  for (let n = (startPos + N) - 1; n >= startPos; n--) { // <--- CORREÇÃO AQUI
    let l = lines[n % N]; // Pega a linha correspondente (já projetada pelo loop anterior)

    if (!l.visible) continue;
    // Desenho dos Sprites de cenário (árvores).
    if (n % 10 === 0) l.drawSprite(ASSETS.IMAGE.TREE, -2); // Árvore na esquerda.
    if ((n + 5) % 10 === 0) l.drawSprite(ASSETS.IMAGE.TREE, 1.3); // Árvore na direita.

    // Desenha o sprite especial (linha de chegada).
    if (l.special) l.drawSprite(l.special, l.special.offset || 0);

    // Desenha os carros inimigos.
    for (let car of cars)
      if ((car.pos | 0) === n % N) 
        l.drawSprite(car.type, car.lane);
  }
// --- FIM DA CORREÇÃO ---
}

// ------------------------------------------------------------
// Inicialização
// ------------------------------------------------------------

// Reseta o estado do jogo para a tela inicial.
function reset() {
  inGame = false;

  start = timestamp(); // Grava o tempo de início da sessão.
  // Calcula o tempo inicial de contagem regressiva (baseado no comprimento da pista + buffer).
  countDown = map[map.length - 2].to / 130 + 10;

  // Zera as variáveis de movimento e pontuação.
  playerX = 0;
  speed = 0;
  scoreVal = 0;

  pos = 0;
  cloudOffset = 0;
  sectionProg = 0;
  mapIndex = 0;

  // Reseta a curva e elevação de todos os segmentos da estrada.
  for (let line of lines) line.curve = line.y = 0;
  
  if (ctx) ctx.clearRect(0, 0, width, height); // Limpa o canvas.

  text.innerText = "Pressione Enter para começar!";
  text.classList.add("blink");

  // Configura a visibilidade da interface.
  hud.style.display = "none";
  home.style.display = "block";
  tacho.style.display = "block";
}

// Atualiza a lista de melhores tempos (highscores) na interface.
function updateHighscore() {
  let hN = Math.min(12, highscores.length);
  for (let i = 0; i < hN; i++) {
    highscore.children[i].innerHTML = `${(i + 1).pad(2, "&nbsp;")}. ${
      highscores[i]
    }`;
  }
}

// Carrega todas as imagens definidas em ASSETS.IMAGE.
function loadImages(callback) {
  let loaded = 0;
  let total = Object.keys(ASSETS.IMAGE).length;
  
  // Função de controle chamada quando uma imagem termina de carregar.
  function imageLoaded() {
    loaded++;
    if (loaded >= total) {
      callback(); // Chama a função de inicialização (init) quando tudo estiver pronto.
    }
  }
  
  // Cria um objeto Image para cada asset e anexa-o.
  for (let key in ASSETS.IMAGE) {
    let img = new Image();
    img.src = ASSETS.IMAGE[key].src;
    ASSETS.IMAGE[key].img = img; // Anexa o objeto Image ao asset para uso posterior.
    
    img.onload = imageLoaded;
    img.onerror = function() {
      console.error("Erro ao carregar imagem:", img.src);
      imageLoaded(); // Conta como carregada mesmo com erro para não travar o jogo.
    };
  }
}

// Função de inicialização principal do jogo.
function init() {
  // Configura as dimensões do contêiner do jogo.
  game.style.width = width + "px";
  game.style.height = height + "px";
  
  // Obtém a referência ao canvas e ao contexto 2D.
  roadCanvas = document.getElementById('roadCanvas');
  ctx = roadCanvas.getContext('2d');

  // Configura o estilo e a posição do sprite do carro do jogador (DOM).
  hero.style.top = height - 80 + "px";
  hero.style.left = halfWidth - ASSETS.IMAGE.HERO.width / 2 + "px";
  hero.style.background = `url(${ASSETS.IMAGE.HERO.src})`;
  hero.style.width = `${ASSETS.IMAGE.HERO.width}px`;
  hero.style.height = `${ASSETS.IMAGE.HERO.height}px`;

  // Configura o fundo de nuvens (DOM).
  cloud.style.backgroundImage = `url(${ASSETS.IMAGE.SKY.src})`;

  // Inicializa o sistema de áudio e carrega todos os sons.
  audio = new Audio();
  Object.keys(ASSETS.AUDIO).forEach((key) =>
    audio.load(ASSETS.AUDIO[key], key, (_) => 0)
  );

  // Inicializa a lista de carros inimigos (posição inicial, sprite, faixa).
  cars.push(new Car(0, ASSETS.IMAGE.CAR, LANE.C));
  cars.push(new Car(10, ASSETS.IMAGE.CAR, LANE.B));
  cars.push(new Car(20, ASSETS.IMAGE.CAR, LANE.C));
  cars.push(new Car(35, ASSETS.IMAGE.CAR, LANE.C));
  cars.push(new Car(50, ASSETS.IMAGE.CAR, LANE.A));
  cars.push(new Car(60, ASSETS.IMAGE.CAR, LANE.B));
  cars.push(new Car(70, ASSETS.IMAGE.CAR, LANE.A));

  // Inicializa os N segmentos de estrada (linhas) e define suas posições Z iniciais.
  for (let i = 0; i < N; i++) {
    var line = new Line();
    line.z = i * segL + 270;

    lines.push(line);
  }

  // Cria os elementos DOM para exibir o ranking.
  for (let i = 0; i < 12; i++) {
    var element = document.createElement("p");
    highscore.appendChild(element);
  }
  updateHighscore();

  reset(); // Configura o estado inicial do jogo.

  // Inicia o loop principal do jogo (game loop).
  (function loop() {
    requestAnimationFrame(loop); // Pede ao navegador para chamar loop na próxima animação.

    let now = timestamp();
    let delta = now - then; // Tempo decorrido desde o último quadro.

    // Roda a atualização do jogo apenas se o tempo for maior que o frame rate alvo.
    if (delta > targetFrameRate) {
      then = now - (delta % targetFrameRate); // Ajusta 'then' para manter a cadência de frames.
      update(delta / 1000); // Chama a função de atualização, passando o tempo em segundos.
    }
  })();
}

// Chama o carregador de imagens; o carregamento bem-sucedido iniciará o jogo via init().
loadImages(init);
//# sourceURL=pen.js