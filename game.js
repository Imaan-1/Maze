import * as THREE from 'three';

// --- CHARACTER DEFINITIONS ---
const PLAYER_OBJECTS = {
    rocket: { name: "Galaxy Cruiser", isUnlocked: true, unlockLevel: 1, createModel: createRocketModel, colliderSize: { width: 1, height: 1, depth: 1.8 } },
    asteroid: { name: "Rogue Asteroid", isUnlocked: false, unlockLevel: 2, createModel: createAsteroidModel, colliderSize: { width: 1.2, height: 1.2, depth: 1.2 } },
    planet: { name: "Wandering Saturn", isUnlocked: false, unlockLevel: 3, createModel: createSaturnModel, colliderSize: { width: 1.5, height: 1.5, depth: 1.5 } }
};
let selectedObjectId = 'rocket';
const characterOrder = ['rocket', 'asteroid', 'planet'];

// --- Level State Management ---
let selectedLevel = 1;
const LEVEL_UNLOCK_SCORES = { 1: 1000, 2: 1000, 3: Infinity }; 
let unlockedLevels = { 1: true, 2: false, 3: false };
let highScores = { 1: 0, 2: 0, 3: 0 };

// --- Load Unlocks from localStorage ---
const savedUnlocks = JSON.parse(localStorage.getItem('spaceRunnerUnlocks'));
if (savedUnlocks) {
    savedUnlocks.forEach(id => {
        if (PLAYER_OBJECTS[id]) {
            PLAYER_OBJECTS[id].isUnlocked = true;
        }
    });
}
const savedLevelUnlocks = JSON.parse(localStorage.getItem('spaceRunnerUnlockedLevels'));
if (savedLevelUnlocks) {
    unlockedLevels = { ...unlockedLevels, ...savedLevelUnlocks };
}
const savedHighScores = JSON.parse(localStorage.getItem('spaceRunnerHighScores'));
if (savedHighScores) {
    highScores = { ...highScores, ...savedHighScores };
}

// --- INITIAL SETUP & GLOBAL FUNCTIONS ---
let updateCharacterSelectorDisplay;
let updateLevelSelectorUI;
let startGame;

setupMenu();
setupCharacterSelector();
initGame(); 

// --- MENU & CHARACTER SELECTOR LOGIC ---
function createStarfield() {
    const starfield = document.getElementById('starfield');
    if (!starfield || starfield.children.length > 0) return;
    for (let i = 0; i < 300; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.left = `${Math.random() * 100}%`;
        star.style.top = `${Math.random() * 100}%`;
        star.style.width = `${Math.random() * 2 + 1.5}px`;
        star.style.height = star.style.width;
        star.style.animationDelay = `${Math.random() * 3}s`;
        starfield.appendChild(star);
    }
    const createShootingStar = () => {
        const shootingStar = document.createElement('div');
        shootingStar.style.position = 'absolute';
        shootingStar.style.width = '2px';
        shootingStar.style.height = '150px';
        shootingStar.style.background = 'linear-gradient(to top, transparent, rgba(255, 255, 255, 0.7))';
        shootingStar.style.left = `${Math.random() * 100}%`;
        shootingStar.style.top = `${Math.random() * 100}%`;
        shootingStar.style.animation = `shootingStar ${Math.random() * 1 + 0.5}s linear forwards`;
        shootingStar.style.transform = 'rotate(45deg)';
        starfield.appendChild(shootingStar);
        setTimeout(() => { if (starfield.contains(shootingStar)) starfield.removeChild(shootingStar); }, 1500);
    };
    setInterval(createShootingStar, 2000);
}
function setupMenu() {
    createStarfield();
    document.getElementById('start-button').addEventListener('click', () => {
        if (startGame) startGame();
    });
    const starfield = document.getElementById('starfield');
    window.addEventListener('mousemove', (e) => {
        const xRatio = (e.clientX - window.innerWidth / 2) / window.innerWidth;
        const yRatio = (e.clientY - window.innerHeight / 2) / window.innerHeight;
        starfield.style.transform = `translate(${xRatio * -30}px, ${yRatio * -30}px)`;
    });

    const levelBtns = {
        1: document.getElementById('level-1-btn'),
        2: document.getElementById('level-2-btn'),
        3: document.getElementById('level-3-btn')
    };
    updateLevelSelectorUI = () => {
        for (const [level, btn] of Object.entries(levelBtns)) {
            if (unlockedLevels[level]) {
                btn.disabled = false;
                btn.innerHTML = `Level ${level}`;
            } else {
                btn.disabled = true;
                btn.innerHTML = `Level ${level} <span>🔒</span>`;
            }
            if (level == selectedLevel) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        }
    };
    levelBtns[1].addEventListener('click', () => { selectedLevel = 1; updateLevelSelectorUI(); });
    levelBtns[2].addEventListener('click', () => { if (unlockedLevels[2]) { selectedLevel = 2; updateLevelSelectorUI(); } });
    levelBtns[3].addEventListener('click', () => { if (unlockedLevels[3]) { selectedLevel = 3; updateLevelSelectorUI(); } });
    updateLevelSelectorUI();
}
function setupCharacterSelector() {
    const previewCanvas = document.getElementById('character-preview');
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, previewCanvas.clientWidth / previewCanvas.clientHeight, 0.1, 1000);
    camera.position.z = 2.5;
    const renderer = new THREE.WebGLRenderer({ canvas: previewCanvas, alpha: true, antialias: true });
    renderer.setSize(previewCanvas.clientWidth, previewCanvas.clientHeight);
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); scene.add(ambientLight);
    const keyLight = new THREE.DirectionalLight(0xffffff, 1); keyLight.position.set(-1, 1, 3); scene.add(keyLight);
    let currentModel;
    function renderPreview() { if (currentModel) scene.remove(currentModel); currentModel = PLAYER_OBJECTS[selectedObjectId].createModel(); currentModel.rotation.x = 0; scene.add(currentModel); }
    function animatePreview() { requestAnimationFrame(animatePreview); if (currentModel) { currentModel.rotation.y += 0.01; currentModel.rotation.x += 0.005; } renderer.render(scene, camera); }
    updateCharacterSelectorDisplay = () => {
        const obj = PLAYER_OBJECTS[selectedObjectId];
        document.getElementById('character-name').textContent = obj.name;
        const lockEl = document.getElementById('character-lock');
        const startBtn = document.getElementById('start-button');
        if (obj.isUnlocked) { lockEl.classList.add('hidden'); startBtn.disabled = false; } else { lockEl.classList.remove('hidden'); lockEl.querySelector('.unlock-text').textContent = `Unlock at Level ${obj.unlockLevel}`; startBtn.disabled = true; }
        renderPreview();
    };
    document.getElementById('next-char').addEventListener('click', () => { const i = characterOrder.indexOf(selectedObjectId); selectedObjectId = characterOrder[(i + 1) % characterOrder.length]; updateCharacterSelectorDisplay(); });
    document.getElementById('prev-char').addEventListener('click', () => { const i = characterOrder.indexOf(selectedObjectId); selectedObjectId = characterOrder[(i - 1 + characterOrder.length) % characterOrder.length]; updateCharacterSelectorDisplay(); });
    updateCharacterSelectorDisplay();
    animatePreview();
}

// --- 3D MODEL CREATION FUNCTIONS ---
function createRocketModel() {
    const modelGroup = new THREE.Group();
    const materials = { body: new THREE.MeshStandardMaterial({ color: 0xe1e1e1, metalness: 0.6, roughness: 0.4 }), accent: new THREE.MeshStandardMaterial({ color: 0xd1201b, metalness: 0.4, roughness: 0.5 }), engine: new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.3 }) };
    const bodyGeo = new THREE.CylinderGeometry(0.35, 0.5, 1.8, 32); const body = new THREE.Mesh(bodyGeo, materials.body); body.castShadow = true; modelGroup.add(body);
    const noseGeo = new THREE.ConeGeometry(0.35, 0.6, 32); const nose = new THREE.Mesh(noseGeo, materials.accent); nose.position.y = 1.2; nose.castShadow = true; modelGroup.add(nose);
    const engineGeo = new THREE.CylinderGeometry(0.3, 0.4, 0.3, 32); const engine = new THREE.Mesh(engineGeo, materials.engine); engine.position.y = -1.05; modelGroup.add(engine);
    for (let i = -1; i <= 1; i += 2) { const bGroup = new THREE.Group(); const bGeo = new THREE.CylinderGeometry(0.15, 0.18, 1.2, 16); const booster = new THREE.Mesh(bGeo, materials.body); booster.castShadow = true; bGroup.add(booster); const bnGeo = new THREE.ConeGeometry(0.15, 0.25, 16); const bNose = new THREE.Mesh(bnGeo, materials.accent); bNose.position.y = 0.725; bNose.castShadow = true; bGroup.add(bNose); bGroup.position.set(i * 0.5, -0.2, 0); modelGroup.add(bGroup); }
    return modelGroup;
}
function createSaturnModel() {
    const modelGroup = new THREE.Group();
    const planetMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.2, roughness: 0.7 }); const planetGeo = new THREE.SphereGeometry(0.7, 32, 32);
    const planet = new THREE.Mesh(planetGeo, planetMat); planet.castShadow = true; modelGroup.add(planet);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, side: THREE.DoubleSide }); const ringGeo = new THREE.RingGeometry(0.9, 1.4, 64);
    const ring = new THREE.Mesh(ringGeo, ringMat); ring.rotation.x = Math.PI / 2.5; ring.receiveShadow = true; modelGroup.add(ring);
    return modelGroup;
}
function createAsteroidModel() {
    const modelGroup = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.8 }); const geo = new THREE.IcosahedronGeometry(0.8, 1);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(pos, i); v.multiplyScalar(1 + (Math.random() - 0.5) * 0.4); pos.setXYZ(i, v.x, v.y, v.z); }
    geo.computeVertexNormals(); const asteroid = new THREE.Mesh(geo, mat); asteroid.castShadow = true; modelGroup.add(asteroid);
    return modelGroup;
}


function initGame() {
  let isFirstPerson = false;
  let isPaused = false; // NEW PAUSE STATE
  
  // ADDED highScoreNotified property
  const gameState = { score: 0, internalLevel: 1, isGameOver: false, newlyUnlockedCharacterId: null, newlyUnlockedLevel: null, singularityUsed: false, highScoreNotified: false };
  const gameConfig = { playerSpeed: -0.15, spawnInterval: 25, levelColors: { 1: { bg: '#010103' }, 2: { bg: '#0c0a1f' }, 3: { bg: '#1d0b30' } } };
  const INTERNAL_LEVEL_THRESHOLDS = { 4: 4000, 5: 7000}; 
  
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(gameConfig.levelColors[1].bg);
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById('gameScreen').appendChild(renderer.domElement);
  
  // --- NEW: PAUSE MENU DOM ELEMENTS ---
  const pauseButton = document.getElementById('pause-button');
  const pauseScreen = document.getElementById('pauseScreen');
  const resumeButton = document.getElementById('resume-button');
  const restartPauseButton = document.getElementById('restart-pause-button');
  const menuPauseButton = document.getElementById('menu-pause-button');

  document.getElementById('highScore').innerText = `High Score: ${highScores[selectedLevel]}`;

  let player, obstacles = [], trailParticles = [], grounds = [], lastSpawnZ, animationId;
  const trailMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true }); const trailGeometry = new THREE.SphereGeometry(0.15, 6, 6);
  
  // --- Classes (Box, Player, AsteroidField, UFO, EnergyField, PlasmaShots, QuantumGate) ---
  class Box extends THREE.Mesh { constructor({width,height,depth,color,position,emissiveIntensity}) { super(new THREE.BoxGeometry(width,height,depth), new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:emissiveIntensity===undefined?0.2:emissiveIntensity})); this.width=width;this.height=height;this.depth=depth;this.position.set(position.x,position.y,position.z);}}
  class Player extends THREE.Group { constructor({ characterId, velocity = {x:0,y:0,z:0}, position={x:0,y:0,z:0}}) { super(); this.position.set(position.x, position.y, position.z); this.velocity = velocity; this.gravity = -0.004; this.onGround = false; const objData = PLAYER_OBJECTS[characterId]; this.width = objData.colliderSize.width; this.height = objData.colliderSize.height; this.depth = objData.colliderSize.depth; this.visualModel = objData.createModel(); if (characterId === 'rocket') { this.visualModel.rotation.x = -Math.PI / 2; this.visualModel.position.z = -0.2; } this.add(this.visualModel); const colliderGeo = new THREE.BoxGeometry(this.width, this.height, this.depth); const colliderMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }); this.colliderBox = new THREE.Mesh(colliderGeo, colliderMat); this.add(this.colliderBox); this.orbitingObstacles = []; } update(grounds) { this.position.x += this.velocity.x; this.position.z += this.velocity.z; this.applyGravity(grounds); if (this.orbitingObstacles.length > 0) { this.orbitingObstacles.forEach((obstacle, index) => { const angle = Date.now() * 0.001 + index; obstacle.group.position.x = Math.cos(angle) * 3; obstacle.group.position.z = Math.sin(angle) * 3; }); } } applyGravity(grounds) { this.velocity.y += this.gravity; this.position.y += this.velocity.y; this.onGround = false; for (const ground of grounds) { if (boxCollision({ box1: this.colliderBox, box2: ground })) { this.onGround = true; this.velocity.y = 0; this.position.y = (ground.position.y + ground.height / 2) + this.height / 2; break; } } } }
  class AsteroidField { constructor(p){this.group=new THREE.Group();p.y=-1.75;this.group.position.copy(p);scene.add(this.group);this.colliders=[];for(let i=0;i<4;i++){const a=new Box({width:Math.random()*1+.8,height:Math.random()*1+.8,depth:Math.random()*1+.8,color:['#8B4513','#CD853F','#D2691E','#A0522D'][i],position:{x:(i-2)*2,y:.4,z:0},emissiveIntensity:0});a.scale.set(Math.random()*.3+.7,Math.random()*.3+.7,Math.random()*.3+.7);a.castShadow=true;this.group.add(a);this.colliders.push(a)}}update(){const t=Date.now()*.001;this.group.children.forEach((a,i)=>{a.position.x=(i-2)*2+Math.sin(t+i)*2.5;a.rotation.x+=.01;a.rotation.y+=.015;a.rotation.z+=.008})}}
  class UFO { constructor(p){this.group=new THREE.Group();p.y=-1.75;this.group.position.copy(p);scene.add(this.group);this.colliders=[];const b=new Box({width:3,height:1,depth:3,color:'#FFD700',position:{x:0,y:.5,z:0}});const d=new Box({width:2,height:1.5,depth:2,color:'#FF6B6B',position:{x:0,y:1.25,z:0}});b.castShadow=true;d.castShadow=true;this.group.add(b);this.group.add(d);this.colliders.push(b,d)}update(){const t=Date.now()*.0008;this.group.position.x=Math.sin(t)*4;this.group.children.forEach(c=>{c.rotation.y=t*.5})}}
  class EnergyField {
      constructor(p) {
          this.group = new THREE.Group();
          p.y = -1.75;
          this.group.position.copy(p);
          scene.add(this.group);
          this.colliders = [];
          const colors = ['#00FFFF', '#FF00FF', '#00FF00'];
          const beamPositions = [
              { x: -4, z: -2 }, { x: -1, z: -2 },  // Gate 1: Pass on the right
              { x: 1,  z: 0 },  { x: 4,  z: 0 },   // Gate 2: Pass on the left
              { x: -4, z: 2 }, { x: -1, z: 2 }   // Gate 3: Pass on the right again
          ];
          beamPositions.forEach((pos, i) => {
              const beam = new Box({
                  width: .4,
                  height: 4,
                  depth: .4,
                  color: colors[i % colors.length],
                  position: { x: pos.x, y: 2, z: pos.z },
                  emissiveIntensity: .3
              });
              beam.castShadow = true;
              this.group.add(beam);
              this.colliders.push(beam);
          });
      }
      update() {
          const t = Date.now() * .002;
          this.group.children.forEach(b => {
              b.material.emissiveIntensity = .3 + Math.sin(t * 2) * .2
          });
      }
  }
  class PlasmaShots{constructor(p){this.group=new THREE.Group();p.y=-1.75;this.group.position.copy(p);scene.add(this.group);this.colliders=[];for(let i=0;i<3;i++){const s=new Box({width:.6,height:.6,depth:.6,color:'#FF4500',position:{x:i*2-2,y:.3,z:0},emissiveIntensity:.4});s.castShadow=true;this.group.add(s);this.colliders.push(s)}}update(){const t=Date.now()*.0015;this.group.children.forEach((s,i)=>{s.position.x=(i*2-2)+Math.sin(t+i)*3;s.position.z=Math.sin(t*.8+i)*2;s.rotation.x+=.05;s.rotation.z+=.03})}}
  class QuantumGate{constructor(p){this.group=new THREE.Group();p.y=-1.75;this.group.position.copy(p);scene.add(this.group);this.colliders=[];for(let i=0;i<8;i++){const a=i/8*Math.PI*2,r=3;const g=new Box({width:.4,height:4,depth:.4,color:'#00FF7F',position:{x:Math.cos(a)*r,y:2,z:Math.sin(a)*r},emissiveIntensity:.3});g.castShadow=true;this.group.add(g);this.colliders.push(g)}}update(){const t=Date.now()*.0005;this.group.children.forEach((g,i)=>{const a=i/8*Math.PI*2+t,r=3;g.position.x=Math.cos(a)*r;g.position.z=Math.sin(a)*r;g.material.emissiveIntensity=.3+Math.sin(t*3)*.2})}}

  
  const obstacleTypes = [AsteroidField, PlasmaShots, EnergyField, UFO, QuantumGate];
  const galaxy = createGalaxyBackground(); scene.add(galaxy);
  const spaceLight = new THREE.DirectionalLight(0xffffff, 1.5); spaceLight.position.set(5, 5, 2); spaceLight.castShadow = true; scene.add(spaceLight);
  scene.add(new THREE.AmbientLight(0x87CEEB, .5));
  const keys = { a: { pressed: false }, d: { pressed: false } };

  startGame = () => { document.getElementById('menuScreen').style.display = 'none'; document.getElementById('gameScreen').style.display = 'block'; setupNewGame(); };
  function createGalaxyBackground() { /* ... (no changes) */ const particleCount = 5000; const positions = []; for (let i = 0; i < particleCount; i++) { const radius = Math.random() * 200 + 20; const angle = Math.random() * Math.PI * 2; const x = Math.cos(angle) * radius; const y = Math.random() * 40 + 5; const z = Math.sin(angle) * radius; positions.push(x, y, z - 100); } const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); const material = new THREE.PointsMaterial({ size: 0.2, color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false }); const galaxy = new THREE.Points(geometry, material); galaxy.renderOrder = -1; return galaxy; }
  function boxCollision({box1,box2}){const b1p=new THREE.Vector3();box1.getWorldPosition(b1p);const b2p=new THREE.Vector3();box2.getWorldPosition(b2p);const b1=box1.geometry.parameters;const b2=box2.geometry.parameters;return(Math.abs(b1p.x-b2p.x)*2<(b1.width+b2.width))&&(Math.abs(b1p.y-b2p.y)*2<(b1.height+b2.height))&&(Math.abs(b1p.z-b2p.z)*2<(b1.depth+b2.depth))}
  
  function setupNewGame() {
      isPaused = false; // NEW
      pauseScreen.style.display = 'none'; // NEW
      pauseButton.style.display = 'flex'; // MODIFIED: Changed from 'block' to 'flex'

      gameState.isGameOver=false;gameState.score=0;
      gameState.internalLevel = selectedLevel; 
      gameState.newlyUnlockedCharacterId=null; 
      gameState.newlyUnlockedLevel = null; 
      gameState.singularityUsed = false;
      gameState.highScoreNotified = false; // <-- ADD THIS LINE
      
      // --- MODIFICATION: Speeds adjusted to be even slower ---
      switch(selectedLevel) {
        case 1:
            gameConfig.playerSpeed = -0.08; // Was -0.10
            gameConfig.spawnInterval = 25;
            scene.background = new THREE.Color(gameConfig.levelColors[1].bg);
            break;
        case 2:
            gameConfig.playerSpeed = -0.12; // Was -0.15
            gameConfig.spawnInterval = 22;
            scene.background = new THREE.Color(gameConfig.levelColors[2].bg);
            break;
        case 3: 
            gameConfig.playerSpeed = -0.16; // Was -0.20
            gameConfig.spawnInterval = 18;
            scene.background = new THREE.Color(gameConfig.levelColors[3].bg);
            break;
      }
      
      lastSpawnZ=-20;
      obstacles=[];trailParticles=[];grounds=[];
      player=new Player({characterId:selectedObjectId}); scene.add(player);
      for(let i=0;i<2;i++){const g=new Box({width:10,height:.5,depth:200,color:'#1a1a2e',position:{x:0,y:-2,z:-i*200},emissiveIntensity:0});g.receiveShadow=true;scene.add(g);grounds.push(g)}
      for(let i=0;i<8;i++)spawnObstacle();

      document.getElementById('score').innerText='Score: 0';
      document.getElementById('level').innerText=`Level: ${selectedLevel}`;
      document.getElementById('highScore').innerText=`High Score: ${highScores[selectedLevel]}`;
      
      if(animationId) cancelAnimationFrame(animationId); 
      animate();
  }

  function spawnObstacle() {
      let availableObstacles;
      if (selectedLevel === 1) {
          availableObstacles = obstacleTypes.slice(0, 2); // AsteroidField, PlasmaShots
      } else if (selectedLevel === 2) {
          availableObstacles = obstacleTypes.slice(0, 3); // ... + EnergyField
      } else {
          const sliceEnd = Math.min(gameState.internalLevel + 1, obstacleTypes.length);
          availableObstacles = obstacleTypes.slice(0, sliceEnd);
      }
      const oC = availableObstacles[Math.floor(Math.random() * availableObstacles.length)];
      const sI = gameConfig.spawnInterval + (Math.random() - .5) * 15;
      const p = new THREE.Vector3((Math.random() - .5) * 3, 0, lastSpawnZ - sI);
      const nO = new oC(p);
      obstacles.push(nO);
      lastSpawnZ -= sI;
  }

  // --- MODIFICATION: Updated triggerGameOver with new button logic ---
  function triggerGameOver(r){
      if(gameState.isGameOver)return;
      gameState.isGameOver=true;
      
      pauseButton.style.display = 'none'; // NEW
      pauseScreen.style.display = 'none'; // NEW
      isPaused = false; // NEW
      
      cancelAnimationFrame(animationId);
      document.getElementById('gameOverReason').textContent=r;
      
      const gOS = document.getElementById('gameOverScreen');
      const buttonContainer = document.getElementById('game-over-buttons');
      const unlockPromptContainer = document.getElementById('unlock-prompt');

      buttonContainer.innerHTML = '';
      unlockPromptContainer.innerHTML = '';
      unlockPromptContainer.style.display = 'none';

      let unlockHTML = '';
      let hasUnlock = false;

      // Check for Level Unlock
      if (gameState.newlyUnlockedLevel) {
          unlockHTML += `<p class="unlock-congrats">🎊 Level ${gameState.newlyUnlockedLevel} Unlocked! 🎊</p>`;
          hasUnlock = true;
      }

      // Check for Character Unlock
      if (gameState.newlyUnlockedCharacterId) {
          const unlockedChar = PLAYER_OBJECTS[gameState.newlyUnlockedCharacterId];
          unlockHTML += `<p class="unlock-congrats">🎉 You've unlocked the <strong>${unlockedChar.name}</strong>! 🎉</p>`;
          hasUnlock = true;
      }

      // Now update the DOM with new button logic
      if (hasUnlock) {
          unlockPromptContainer.innerHTML = unlockHTML;
          let buttonAdded = false;

          // --- NEW: Combined Button Logic ---
          if (gameState.newlyUnlockedLevel && gameState.newlyUnlockedCharacterId) {
              const combinedBtn = document.createElement('button');
              combinedBtn.className = 'play-combined-button'; // Use new gold style
              combinedBtn.textContent = `Play Level ${gameState.newlyUnlockedLevel} with ${PLAYER_OBJECTS[gameState.newlyUnlockedCharacterId].name}`;
              combinedBtn.onclick = () => {
                  selectedLevel = gameState.newlyUnlockedLevel;
                  selectedObjectId = gameState.newlyUnlockedCharacterId;
                  resetGame();
              };
              unlockPromptContainer.appendChild(combinedBtn);
              buttonAdded = true;
          } 
          
          // --- FALLBACK: If only a level is unlocked (future-proofing) ---
          if (gameState.newlyUnlockedLevel && !gameState.newlyUnlockedCharacterId) {
              const playNextBtn = document.createElement('button');
              playNextBtn.className = 'play-next-button'; 
              playNextBtn.textContent = `▶️ Play Level ${gameState.newlyUnlockedLevel}`;
              playNextBtn.onclick = () => {
                  selectedLevel = gameState.newlyUnlockedLevel;
                  resetGame();
              };
              if (buttonAdded) playNextBtn.style.marginTop = '10px';
              unlockPromptContainer.appendChild(playNextBtn);
              buttonAdded = true;
          }

          // --- FALLBACK: If only a character is unlocked (future-proofing) ---
          if (gameState.newlyUnlockedCharacterId && !gameState.newlyUnlockedLevel) {
              const tryNewBtn = document.createElement('button');
              tryNewBtn.className = 'try-new-button';
              tryNewBtn.textContent = `🚀 Try the ${PLAYER_OBJECTS[gameState.newlyUnlockedCharacterId].name}`;
              tryNewBtn.onclick = () => {
                  selectedObjectId = gameState.newlyUnlockedCharacterId;
                  resetGame();
              };
              if (buttonAdded) tryNewBtn.style.marginTop = '10px';
              unlockPromptContainer.appendChild(tryNewBtn);
          }
          
          unlockPromptContainer.style.display = 'block';
      }

      player.visualModel.traverse(c=>{if(c.isMesh&&c.material)c.material.color.set(0xd1201b)});
      
      const playAgainBtn=document.createElement('button');
      playAgainBtn.className='restart-button';
      playAgainBtn.textContent='Play Again';
      playAgainBtn.onclick=resetGame;

      const menuBtn=document.createElement('button');
      menuBtn.className='menu-button';
      menuBtn.textContent='Back to Menu';
      menuBtn.onclick=backToMenu;

      buttonContainer.appendChild(playAgainBtn);
      buttonContainer.appendChild(menuBtn);
      
      gOS.style.display='block';
  }

  function cleanUpScene() { if (player) scene.remove(player); obstacles.forEach(o => scene.remove(o.group)); grounds.forEach(g => scene.remove(g)); trailParticles.forEach(p => scene.remove(p)); obstacles = []; grounds = []; trailParticles = []; }
  
  function resetGame(){ 
    document.getElementById('gameOverScreen').style.display = 'none'; 
    cleanUpScene(); 
    setupNewGame(); 
  }

  function backToMenu() { 
    if(animationId) cancelAnimationFrame(animationId); 
    
    isPaused = false; // NEW
    pauseButton.style.display = 'none'; // NEW
    pauseScreen.style.display = 'none'; // NEW

    cleanUpScene(); 
    document.getElementById('gameOverScreen').style.display = 'none'; 
    document.getElementById('gameScreen').style.display = 'none'; 
    document.getElementById('menuScreen').style.display = 'flex'; 
    updateCharacterSelectorDisplay(); 
    updateLevelSelectorUI(); 
  }
  
  window.addEventListener('keydown',e=>{switch(e.code){case'KeyA':keys.a.pressed=true;break;case'KeyD':keys.d.pressed=true;break;case'Space':if(player&&player.onGround)player.velocity.y=.12;break;case'KeyR':if(gameState.isGameOver)resetGame();break;case'KeyP':togglePause(!isPaused);break;}}); // Added 'P' to pause
  window.addEventListener('keyup',e=>{switch(e.code){case'KeyA':keys.a.pressed=false;break;case'KeyD':keys.d.pressed=false;break}});
  window.addEventListener('resize',()=>{camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();renderer.setSize(window.innerWidth,window.innerHeight)});
  window.addEventListener('keydown', e => {
    if(e.code === 'KeyV') isFirstPerson = !isFirstPerson;
  });

  // --- SINGULARITY ABILITY ---
  window.addEventListener('keydown', e => {
      if (e.code === 'KeyQ' && selectedObjectId === 'planet' && !gameState.singularityUsed) {
          activateSingularity();
      }
  });
  let rippleEffect; 
  function activateSingularity() {
      if (gameState.singularityUsed) return;
      gameState.singularityUsed = true;
      const rippleGeometry = new THREE.SphereGeometry(1, 32, 32);
      const rippleMaterial = new THREE.MeshBasicMaterial({
          color: 0x00ffff,
          transparent: true,
          opacity: 0.5,
          wireframe: true
      });
      rippleEffect = new THREE.Mesh(rippleGeometry, rippleMaterial);
      rippleEffect.position.copy(player.position);
      scene.add(rippleEffect);
      let rippleSize = 1;
      const animateRipple = () => {
          rippleSize += 0.1;
          rippleEffect.scale.set(rippleSize, rippleSize, rippleSize);
          rippleEffect.material.opacity -= 0.01;
          if (rippleEffect.material.opacity <= 0) {
              scene.remove(rippleEffect);
              rippleEffect.geometry.dispose();
              rippleEffect.material.dispose();
              rippleEffect = null;
          } else {
              requestAnimationFrame(animateRipple);
          }
      };
      animateRipple();
      obstacles.forEach(obstacle => {
          const distance = player.position.distanceTo(obstacle.group.position);
          if (distance < 8) {
              player.orbitingObstacles.push(obstacle);
              obstacle.group.position.set(0, 2, 0); 
              player.add(obstacle.group); 
              obstacle.group.traverse(child => {
                  if (child instanceof THREE.Mesh) {
                      child.material.emissive = new THREE.Color(0x00ffff);
                      child.material.emissiveIntensity = 0.5;
                  }
              });
          }
      });
      setTimeout(() => {
          releaseOrbitingObstacles();
      }, 3000);
  }
  function releaseOrbitingObstacles() {
      player.orbitingObstacles.forEach(obstacle => {
          player.remove(obstacle.group); 
          scene.add(obstacle.group); 
          obstacle.group.traverse(child => {
              if (child instanceof THREE.Mesh) {
                  child.material.emissive = new THREE.Color(0x000000);
                  child.material.emissiveIntensity = 0;
              }
          });
          const force = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize().multiplyScalar(0.5);
          obstacle.group.velocity = force; 
          const animateOutward = () => {
              obstacle.group.position.add(obstacle.group.velocity);
              obstacle.group.velocity.multiplyScalar(0.95); 
              if (obstacle.group.velocity.length() > 0.01) {
                  requestAnimationFrame(animateOutward);
              }
          };
          animateOutward();
      });
      player.orbitingObstacles = [];
  }

  // --- NEW PAUSE LOGIC ---
  function togglePause(pauseState) {
      if (gameState.isGameOver) return; // Don't allow pause on game over
      isPaused = pauseState;
      pauseScreen.style.display = isPaused ? 'block' : 'none';
      
      // Only show pause button if not paused AND not game over
      if (!isPaused && !gameState.isGameOver) {
          pauseButton.style.display = 'flex'; // MODIFIED: Changed from 'block' to 'flex'
      } else {
          pauseButton.style.display = 'none';
      }
      
      if (isPaused) {
          cancelAnimationFrame(animationId); // Stop the loop
      } else {
          animate(); // Restart the loop
      }
  }

  pauseButton.addEventListener('click', () => togglePause(true));
  resumeButton.addEventListener('click', () => togglePause(false));
  
  restartPauseButton.addEventListener('click', () => {
      pauseScreen.style.display = 'none';
      isPaused = false;
      resetGame(); 
  });

  menuPauseButton.addEventListener('click', () => {
      pauseScreen.style.display = 'none';
      isPaused = false;
      backToMenu();
  });
  
  function animate() {
    if (isPaused) return; // NEW: Check if paused

    animationId = requestAnimationFrame(animate);
    player.update(grounds);
    if (isFirstPerson) {
        const fpHeight = player.height * 1.4;
        const forward = new THREE.Vector3(0, 0, -1); 
        forward.applyQuaternion(player.quaternion);
        camera.position.copy(player.position);
        camera.position.y += fpHeight;
        camera.lookAt(camera.position.clone().add(forward));
    } else {
        const cO = new THREE.Vector3(0, 2, 8);
        camera.position.copy(player.position).add(cO);
        camera.lookAt(player.position);
    }

    if(player.position.y<-10)triggerGameOver("You fell into deep space!");
    
    if (player.position.z < lastSpawnZ + 100) {
        spawnObstacle();
    }

    obstacles.forEach(o=>{o.update();o.colliders.forEach(c=>{if(boxCollision({box1:player.colliderBox,box2:c}))triggerGameOver("You crashed into an obstacle!")})});
    grounds.forEach(g=>{if(camera.position.z<g.position.z-g.depth/2)g.position.z-=grounds.length*g.depth});
    
    if(!gameState.isGameOver){
        gameState.score=Math.floor(-player.position.z); 
        document.getElementById('score').innerText=`Score: ${gameState.score}`;

        // MODIFIED THIS BLOCK
        if (gameState.score > highScores[selectedLevel]) {
            if (!gameState.highScoreNotified) { // Check if already notified
                gameState.highScoreNotified = true; // Set flag
                const lUE = document.getElementById('levelUp');
                lUE.innerText = `🌟 New High Score! 🌟`; // New message
                lUE.classList.add('show');
                setTimeout(() => lUE.classList.remove('show'), 2500); // 2.5s duration
            }
            highScores[selectedLevel] = gameState.score;
            localStorage.setItem('spaceRunnerHighScores', JSON.stringify(highScores));
            document.getElementById('highScore').innerText = `High Score: ${highScores[selectedLevel]}`;
        }
        // END OF MODIFICATION
        
        // --- Level & Character Unlock Logic (Non-Stopping) ---
                
        // Check for Level 2 Unlock (from Level 1)
        if (selectedLevel === 1 && !unlockedLevels[2] && gameState.score >= LEVEL_UNLOCK_SCORES[1]) {
            unlockedLevels[2] = true;
            localStorage.setItem('spaceRunnerUnlockedLevels', JSON.stringify(unlockedLevels));
            gameState.newlyUnlockedLevel = 2; 
            
            const lUE=document.getElementById('levelUp'); 
            lUE.innerText=`Level 2 Unlocked!`;
            lUE.classList.add('show');
            setTimeout(()=>lUE.classList.remove('show'),3000);
            
            if (!PLAYER_OBJECTS['asteroid'].isUnlocked) {
                PLAYER_OBJECTS['asteroid'].isUnlocked = true;
                const unlocked = JSON.parse(localStorage.getItem('spaceRunnerUnlocks')) || ['rocket'];
                if (!unlocked.includes('asteroid')) { 
                    unlocked.push('asteroid');
                    localStorage.setItem('spaceRunnerUnlocks', JSON.stringify(unlocked));
                }
                gameState.newlyUnlockedCharacterId = 'asteroid'; 
                
                const uN=document.getElementById('unlock-notification');
                uN.innerHTML=`New Vehicle Unlocked:<br/><strong>${PLAYER_OBJECTS['asteroid'].name}</strong>`;
                uN.classList.add('show');
                setTimeout(()=>uN.classList.remove('show'), 3000);
            }
        }
        
        // Check for Level 3 Unlock (from Level 2)
        if (selectedLevel === 2 && !unlockedLevels[3] && gameState.score >= LEVEL_UNLOCK_SCORES[2]) {
            unlockedLevels[3] = true;
            localStorage.setItem('spaceRunnerUnlockedLevels', JSON.stringify(unlockedLevels));
            gameState.newlyUnlockedLevel = 3; 
            
            const lUE=document.getElementById('levelUp');
            lUE.innerText=`Level 3 Unlocked!`;
            lUE.classList.add('show');
            setTimeout(()=>lUE.classList.remove('show'),3000);

            if (!PLAYER_OBJECTS['planet'].isUnlocked) {
                PLAYER_OBJECTS['planet'].isUnlocked = true;
                const unlocked = JSON.parse(localStorage.getItem('spaceRunnerUnlocks')) || ['rocket'];
                if (!unlocked.includes('planet')) { 
                    unlocked.push('planet');
                    localStorage.setItem('spaceRunnerUnlocks', JSON.stringify(unlocked));
                }
                gameState.newlyUnlockedCharacterId = 'planet'; 
                
                const uN=document.getElementById('unlock-notification');
                uN.innerHTML=`New Vehicle Unlocked:<br/><strong>${PLAYER_OBJECTS['planet'].name}</strong>`;
                uN.classList.add('show');
                setTimeout(()=>uN.classList.remove('show'), 3000);
            }
        }
        
        // --- Level 3 Progression ---
        if (selectedLevel === 3) {
            const nIL = gameState.internalLevel + 1; // Next Internal Level
            if (INTERNAL_LEVEL_THRESHOLDS[nIL] && gameState.score >= INTERNAL_LEVEL_THRESHOLDS[nIL]) {
                
                gameState.internalLevel = nIL; 
                document.getElementById('level').innerText=`Level: 3 (Stage ${nIL-2})`;
                
                const lUE=document.getElementById('levelUp');
                lUE.innerText=`Stage ${nIL-2}`;
                lUE.classList.add('show');
                setTimeout(()=>lUE.classList.remove('show'),2000);
                
                // --- MODIFICATION: Slower speed increase for stages ---
                if (nIL === 4) {
                    gameConfig.playerSpeed -= .01; // Was -0.02
                    gameConfig.spawnInterval = 16; 
                } else if (nIL === 5) {
                    gameConfig.playerSpeed -= .01; // Was -0.02
                    gameConfig.spawnInterval = 14;
                }
            }
        }
    }

    // --- MODIFICATION: Slower progressive speed increase ---
    if(selectedLevel === 3 && gameState.internalLevel >= 3) gameConfig.playerSpeed-=.000001; // Was -0.000003

    player.velocity.x=0;player.velocity.z=gameConfig.playerSpeed;
    if(keys.a.pressed)player.velocity.x=-.05;else if(keys.d.pressed)player.velocity.x=.05;
    galaxy.rotation.y += 0.0001;
    if (!gameState.isGameOver && trailParticles.length < 50) { const trailParticle = new THREE.Mesh(trailGeometry, trailMaterial.clone()); trailParticle.position.copy(player.position); if (selectedObjectId === 'rocket') { trailParticle.position.z += player.depth / 2; } scene.add(trailParticle); trailParticles.push(trailParticle); }
    for (let i = trailParticles.length - 1; i >= 0; i--) { const p = trailParticles[i]; p.material.opacity *= 0.93; if (p.material.opacity < 0.01) { scene.remove(p); trailParticles.splice(i, 1); } }
    renderer.render(scene, camera);
  }
}