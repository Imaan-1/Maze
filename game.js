import * as THREE from 'three';

// --- GLOBAL TEXTURE LOADER AND CACHE ---
const textureLoader = new THREE.TextureLoader();
const TEXTURES = {
    rocketBody: 'metal_texture.jpg', 
    asteroidSurface: 'asteroid.jpg', 
    saturnPlanet: 'saturn-colour.jpg', 
    saturnRing: 'saturn-rings.png' 
};
const textureCache = {};
let allTexturesLoaded = false;
let updateCharacterSelectorDisplay;
let updateLevelSelectorUI;
let startGame;

// --- Loading function for textures ---
function loadTextures(callback) {
    const texturePromises = Object.entries(TEXTURES).map(([key, url]) => {
        return new Promise((resolve) => {
            textureLoader.load(url, 
                (texture) => {
                    // Added wrapping and filtering for better texture quality
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    texture.minFilter = THREE.LinearMipMapLinearFilter;
                    textureCache[key] = texture;
                    resolve();
                },
                undefined,
                () => {
                    console.error(`Failed to load texture: ${url}. Using fallback color.`);
                    textureCache[key] = null; // Use null as fallback indicator
                    resolve();
                }
            );
        });
    });

    Promise.all(texturePromises).then(() => {
        allTexturesLoaded = true;
        console.log("All textures loaded (or failed to load).");
        if (callback) callback();
    });
}

// --- CHARACTER DEFINITIONS (Hyper Cube added back, trail color is less intense) ---
const PLAYER_OBJECTS = {
    rocket: { 
        name: "Galaxy Cruiser", 
        isUnlocked: true, 
        unlockLevel: 1, 
        createModel: createRocketModel, 
        colliderSize: { width: 1, height: 1, depth: 1.8 }, 
        trailColor: 0xff4500, // Orange-Red
        trailSize: 0.18, 
        trailMaterial: null,
        textures: { body: 'rocketBody', accent: null } 
    }, 
    asteroid: { 
        name: "Rogue Asteroid", 
        isUnlocked: false, 
        unlockLevel: 2, 
        createModel: createAsteroidModel, 
        colliderSize: { width: 1.2, height: 1.2, depth: 1.2 }, 
        trailColor: 0x90EE90, // Light Green
        trailSize: 0.22, 
        trailMaterial: null,
        textures: { surface: 'asteroidSurface' }
    },
    planet: { 
        name: "Wandering Saturn", 
        isUnlocked: false, 
        unlockLevel: 3, 
        createModel: createSaturnModel, 
        colliderSize: { width: 1.5, height: 1.5, depth: 1.5 }, 
        trailColor: 0xffd700, // Gold
        trailSize: 0.25, 
        trailMaterial: null,
        textures: { planet: 'saturnPlanet', ring: 'saturnRing' }
    },
    orb: { 
        name: "Swirling Orb", 
        isUnlocked: false, 
        unlockLevel: 3, 
        createModel: createOrbModel, 
        colliderSize: { width: 1.4, height: 1.4, depth: 1.4 }, 
        unlockText: "Score 1000 in Level 3", 
        trailColor: 0x00ffff, // Cyan
        trailSize: 0.15, 
        trailMaterial: null,
        textures: {}
    },
    // --- NEW CHARACTER ADDED BACK ---
    hypercube: { 
        name: "Hyper Cube", 
        isUnlocked: false, 
        unlockLevel: 3, 
        createModel: createHyperCubeModel, 
        colliderSize: { width: 1.2, height: 1.2, depth: 1.2 }, 
        unlockText: "Score 2000 in Level 3", 
        trailColor: 0x66ff66, // LESS INTENSE NEON GREEN
        trailSize: 0.2, 
        trailMaterial: null,
        textures: {}
    }
};
let selectedObjectId = 'rocket';
const characterOrder = ['rocket', 'asteroid', 'planet', 'orb', 'hypercube'];

// --- Level State Management (NO CHANGES) ---
let selectedLevel = 1;
const LEVEL_UNLOCK_SCORES = { 1: 1000, 2: 1000, 3: Infinity }; 
let unlockedLevels = { 1: true, 2: false, 3: false };
let highScores = { 1: 0, 2: 0, 3: 0 };

// --- Load Unlocks from localStorage (NO CHANGES) ---
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

// ---- SOUND EFFECT SYSTEM ----
const audio = {
    bgm: new Audio('sounds/invasion-march-star-wars-style-cinematic-music-219585.mp3'),
    jump: new Audio('sounds/jump.wav'),
    crash: new Audio('sounds/dying.mp3'),
    click: new Audio('sounds/buttonclick.mp3'),
};

audio.bgm.loop = true;
audio.bgm.volume = 0.14; 

function playSound(s) {
    if (!audio[s]) return;
    if (s === 'crash') {
        audio.crash.volume = 1.0; 
    }
    audio[s].currentTime = 0; 
    audio[s].play().catch(e => console.log("Sound play prevented:", e));
}

// --- INITIAL SETUP & GLOBAL FUNCTIONS ---

loadTextures(() => {
    setupMenu();
    setupCharacterSelector();
    initGame(); 
});

window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        audio.bgm.play().catch(()=>{}); 
    }, 700);
});

document.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.classList.contains('level-select-btn')) {
        playSound('click');
    }
});

// --- MENU & CHARACTER SELECTOR LOGIC (MODIFIED for 2-page structure) ---

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

// NEW: Function to manage screen transitions
function showScreen(id) {
    document.querySelectorAll('.menuScreen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(id).classList.add('active');
}

function setupMenu() {
    createStarfield();
    
    // --- Mouse Parallax Effect ---
    const starfield = document.getElementById('starfield');
    window.addEventListener('mousemove', (e) => {
        const xRatio = (e.clientX - window.innerWidth / 2) / window.innerWidth;
        const yRatio = (e.clientY - window.innerHeight / 2) / window.innerHeight;
        starfield.style.transform = `translate(${xRatio * -30}px, ${yRatio * -30}px)`;
    });

    // --- BUTTON EVENT LISTENERS (NEW LOGIC) ---
    document.getElementById('choose-char-button').addEventListener('click', () => {
        showScreen('characterSelectionScreen');
        updateCharacterSelectorDisplay(); // Ensure the character selector updates
    });
    
    document.getElementById('back-to-level-button').addEventListener('click', () => {
        showScreen('levelSelectionScreen');
    });

    // Start mission button on the character screen
    document.getElementById('start-mission-button-char').addEventListener('click', () => {
        const obj = PLAYER_OBJECTS[selectedObjectId];
        if (obj.isUnlocked) {
            if (startGame) startGame();
        }
    });

    // Select button on the character screen just sets the character (if unlocked)
    // Removed event listener for removed button (handled in HTML)
    
    // --- Level Selection Logic ---
    const levelBtns = {
        1: document.getElementById('level-1-btn'),
        2: document.getElementById('level-2-btn'),
        3: document.getElementById('level-3-btn')
    };
    
    updateLevelSelectorUI = () => {
        for (const [level, btn] of Object.entries(levelBtns)) {
            const levelNum = parseInt(level);
            if (unlockedLevels[levelNum]) {
                btn.disabled = false;
                btn.innerHTML = `LEVEL ${levelNum}: ${getLevelName(levelNum)}`;
            } else {
                btn.disabled = true;
                btn.innerHTML = `LEVEL ${levelNum}: ${getLevelName(levelNum)} <span>🔒</span>`;
            }
            if (levelNum === selectedLevel) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        }

        // Update the Start Mission button text on the char screen to reflect the selected level
        document.getElementById('start-mission-button-char').textContent = `START LEVEL ${selectedLevel}`;

        const unlock2Info = document.getElementById('unlock-level-2-info');
        const unlock3Info = document.getElementById('unlock-level-3-info');
        const unlockContainer = document.getElementById('unlock-info-container');

        // Show/Hide Level 2 unlock text
        if (unlockedLevels[2]) {
            unlock2Info.classList.add('hidden');
        } else {
            unlock2Info.classList.remove('hidden');
        }

        // Show/Hide Level 3 unlock text
        if (unlockedLevels[3]) {
            unlock3Info.classList.add('hidden');
        } else {
            unlock3Info.classList.remove('hidden');
        }
        
        // Hide the whole container if BOTH are unlocked
        if (unlockedLevels[2] && unlockedLevels[3]) {
            unlockContainer.classList.add('hidden');
        } else {
            unlockContainer.classList.remove('hidden');
        }
    };
    
    function getLevelName(level) {
        switch(level) {
            case 1: return "ASTEROID FIELD";
            case 2: return "NEBULA DRIFT";
            case 3: return "PLANETARY RING";
            default: return `Level ${level}`;
        }
    }
    
    levelBtns[1].addEventListener('click', () => { selectedLevel = 1; updateLevelSelectorUI(); });
    levelBtns[2].addEventListener('click', () => { if (unlockedLevels[2]) { selectedLevel = 2; updateLevelSelectorUI(); } });
    levelBtns[3].addEventListener('click', () => { if (unlockedLevels[3]) { selectedLevel = 3; updateLevelSelectorUI(); } });
    updateLevelSelectorUI();
}
function setupCharacterSelector() {
    const previewCanvas = document.getElementById('character-preview');
    // Ensure canvas size is set for 3D rendering
    previewCanvas.width = 200; 
    previewCanvas.height = 200;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, previewCanvas.width / previewCanvas.height, 0.1, 1000);
    camera.position.z = 2.5;
    const renderer = new THREE.WebGLRenderer({ canvas: previewCanvas, alpha: true, antialias: true });
    renderer.setSize(previewCanvas.width, previewCanvas.height);
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); scene.add(ambientLight);
    const keyLight = new THREE.DirectionalLight(0xffffff, 1); keyLight.position.set(-1, 1, 3); scene.add(keyLight);
    let currentModel;
    
    // FIX: Character preview rendering logic
    function renderPreview() { 
        if (!allTexturesLoaded) return; 
        if (currentModel) scene.remove(currentModel); 
        currentModel = PLAYER_OBJECTS[selectedObjectId].createModel(); 
        currentModel.rotation.x = 0; 
        scene.add(currentModel); 
        renderer.render(scene, camera); // Render once immediately
    }
    
    function animatePreview() { 
        requestAnimationFrame(animatePreview); 
        const time = Date.now();
        if (currentModel) { 
            if (currentModel.userData.customAnimate) {
                currentModel.userData.customAnimate(time);
            } else if (currentModel.userData.shaderMaterial) {
                currentModel.userData.shaderMaterial.uniforms.time.value += 0.05;
                currentModel.rotation.y += 0.01; 
            } else {
                currentModel.rotation.y += 0.01; 
            }
        } 
        renderer.render(scene, camera); 
    }
    
    // MODIFIED FUNCTION
    updateCharacterSelectorDisplay = () => {
        const obj = PLAYER_OBJECTS[selectedObjectId];
        document.getElementById('character-name').textContent = obj.name;
        
        const lockEl = document.getElementById('character-lock');
        const statusEl = document.getElementById('character-status');
        const startBtn = document.getElementById('start-mission-button-char');
        const previewEl = document.getElementById('character-preview');
        const lockOverlayEl = document.getElementById('lock-overlay'); // NEW: Get the overlay
        
        // --- VISUAL FEEDBACK: Update border color and shadow dynamically ---
        if (obj.isUnlocked) {
            previewEl.style.borderColor = 'var(--neon-green)';
            previewEl.style.boxShadow = '0 0 10px var(--neon-green)';
        } else {
            // Set neutral color and shadow when locked
            previewEl.style.borderColor = '#9ca3af'; 
            previewEl.style.boxShadow = '0 0 10px #9ca3af'; 
        }
        
        if (obj.isUnlocked) { 
            lockEl.classList.add('hidden'); 
            statusEl.classList.remove('hidden');
            statusEl.textContent = 'UNLOCKED!';
            startBtn.disabled = false;
            lockOverlayEl.classList.add('hidden'); // NEW: Hide the lock overlay
        } else { 
            lockEl.classList.remove('hidden'); 
            statusEl.classList.add('hidden'); 
            
            if (obj.unlockText) {
                lockEl.querySelector('.unlock-text').textContent = obj.unlockText;
            } else {
                lockEl.querySelector('.unlock-text').textContent = `Unlock at Level ${obj.unlockLevel}`;
            }
            
            startBtn.disabled = true;
            lockOverlayEl.classList.remove('hidden'); // NEW: Show the lock overlay
        }
        if (allTexturesLoaded) { 
            renderPreview();
        }
    };

    document.getElementById('next-char').addEventListener('click', () => { 
        const i = characterOrder.indexOf(selectedObjectId); 
        selectedObjectId = characterOrder[(i + 1) % characterOrder.length]; 
        updateCharacterSelectorDisplay(); 
    });
    document.getElementById('prev-char').addEventListener('click', () => { 
        const i = characterOrder.indexOf(selectedObjectId); 
        selectedObjectId = characterOrder[(i - 1 + characterOrder.length) % characterOrder.length]; 
        updateCharacterSelectorDisplay(); 
    });

    updateCharacterSelectorDisplay();
    animatePreview();
}

// --- 3D MODEL CREATION FUNCTIONS (NO CHANGES) ---

function createRocketModel() { 
    const modelGroup = new THREE.Group();
    const bodyTexture = textureCache['rocketBody'];
    const materials = { 
        body: new THREE.MeshStandardMaterial({ 
            color: bodyTexture ? 0xffffff : 0xbbbbbb, 
            map: bodyTexture, 
            metalness: 0.9, 
            roughness: 0.7,
            flatShading: false 
        }), 
        accent: new THREE.MeshStandardMaterial({ 
            color: 0xcc3333, 
            metalness: 0.5, 
            roughness: 0.3, 
            flatShading: false 
        }), 
        engine: new THREE.MeshStandardMaterial({ 
            color: 0x111111, 
            metalness: 0.9, 
            roughness: 0.1, 
            emissive: 0x333333, 
            emissiveIntensity: 0.2 
        }) 
    };
    const bodyGeo = new THREE.CylinderGeometry(0.35, 0.5, 1.8, 64); 
    const body = new THREE.Mesh(bodyGeo, materials.body); 
    body.castShadow = true; 
    modelGroup.add(body);
    const noseGeo = new THREE.ConeGeometry(0.35, 0.8, 32); 
    const nose = new THREE.Mesh(noseGeo, materials.accent); 
    nose.position.y = 1.3; 
    nose.castShadow = true; 
    modelGroup.add(nose);
    const engineGeo = new THREE.CylinderGeometry(0.4, 0.55, 0.5, 32); 
    const engine = new THREE.Mesh(engineGeo, materials.engine); 
    engine.position.y = -1.15; 
    engine.castShadow = true; 
    modelGroup.add(engine);
    for (let i = -1; i <= 1; i += 2) { 
        const bGroup = new THREE.Group(); 
        const bGeo = new THREE.CylinderGeometry(0.15, 0.18, 1.2, 16); 
        const booster = new THREE.Mesh(bGeo, materials.body); 
        booster.castShadow = true; 
        bGroup.add(booster); 
        const bnGeo = new THREE.ConeGeometry(0.15, 0.25, 16); 
        const bNose = new THREE.Mesh(bnGeo, materials.accent); 
        bNose.position.y = 0.725; 
        bNose.castShadow = true; 
        bGroup.add(bNose); 
        bGroup.position.set(i * 0.5, -0.2, 0); 
        modelGroup.add(bGroup); 
    }
    return modelGroup;
}
function createSaturnModel() { 
    const modelGroup = new THREE.Group();
    const planetTexture = textureCache['saturnPlanet'];
    const ringTexture = textureCache['saturnRing'];
    const planetMat = new THREE.MeshStandardMaterial({ 
        color: planetTexture ? 0xffffff : 0xffd700,
        map: planetTexture, 
        metalness: 0.1, 
        roughness: 0.9 
    }); 
    const planetGeo = new THREE.SphereGeometry(0.7, 64, 64); 
    const planet = new THREE.Mesh(planetGeo, planetMat); 
    planet.castShadow = true; 
    modelGroup.add(planet);
    const ringMat = new THREE.MeshBasicMaterial({ 
        color: ringTexture ? 0xffffff : 0x8B4513,
        map: ringTexture, 
        side: THREE.DoubleSide, 
    }); 
    const ringGeo = new THREE.RingGeometry(0.8, 1.5, 128); 
    if (ringTexture) {
        const uvs = ringGeo.attributes.uv.array;
        for (let i = 0; i < uvs.length; i += 2) {
            uvs[i + 1] *= 0.5; 
        }
        ringGeo.attributes.uv.needsUpdate = true;
    }
    const ring = new THREE.Mesh(ringGeo, ringMat); 
    ring.rotation.x = Math.PI / 2.5; 
    ring.receiveShadow = true; 
    modelGroup.add(ring);
    return modelGroup;
}
function createAsteroidModel() { 
    const modelGroup = new THREE.Group();
    const surfaceTexture = textureCache['asteroidSurface'];
    const mat = new THREE.MeshStandardMaterial({ 
        color: surfaceTexture ? 0xffffff : 0x555555,
        map: surfaceTexture, 
        roughness: 1.0, 
        metalness: 0.0, 
        flatShading: true,
        emissive: 0x333333,
        emissiveIntensity: 0.1
    }); 
    const geo = new THREE.IcosahedronGeometry(0.8, 2); 
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) { 
        const v = new THREE.Vector3().fromBufferAttribute(pos, i); 
        v.multiplyScalar(1 + (Math.random() - 0.5) * 0.6); 
        pos.setXYZ(i, v.x, v.y, v.z); 
    }
    geo.computeVertexNormals(); 
    const asteroid = new THREE.Mesh(geo, mat); 
    asteroid.castShadow = true; 
    if (surfaceTexture) {
        surfaceTexture.repeat.set(4, 4); 
        surfaceTexture.needsUpdate = true;
    }
    modelGroup.add(asteroid);
    return modelGroup;
}
function createOrbModel() { 
    const modelGroup = new THREE.Group();
    const orbMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0.0 },
            color: { value: new THREE.Color(0x00ffff) } 
        },
        vertexShader: `
            varying vec2 vUv;
            varying vec3 vPosition;
            void main() {
                vUv = uv;
                vPosition = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float time;
            uniform vec3 color;
            varying vec2 vUv;
            varying vec3 vPosition;

            void main() {
                float swirl = sin(vUv.x * 10.0 + time * 2.0) * cos(vUv.y * 10.0 + time * 1.5);
                swirl += sin(vUv.y * 15.0 + time * 3.0) * 0.5;
                float glow = 1.0 - length(vUv - 0.5) * 2.0;
                glow = max(0.0, glow + swirl * 0.3);
                glow = pow(glow, 2.0); 
                gl_FragColor = vec4(color * glow, glow);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending, 
        side: THREE.DoubleSide
    });
    const geometry = new THREE.SphereGeometry(0.7, 64, 64);
    const orb = new THREE.Mesh(geometry, orbMaterial);
    orb.userData.shaderMaterial = orbMaterial; 
    modelGroup.add(orb);
    const pointLight = new THREE.PointLight(0x00ffff, 2, 10);
    modelGroup.add(pointLight);
    return modelGroup;
}

// --- NEW MODEL: Hyper Cube (Trail color updated to match new green) ---
function createHyperCubeModel() {
    const modelGroup = new THREE.Group();
    
    // 1. Main Cube - Glowing Wireframe
    const geometry = new THREE.BoxGeometry(1.2, 1.2, 1.2);
    const material = new THREE.MeshBasicMaterial({
        color: 0x66ff66, // LESS INTENSE NEON GREEN
        wireframe: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending 
    });
    
    const cube = new THREE.Mesh(geometry, material);
    
    // 2. Inner Core - Solid for a better center point
    const coreGeo = new THREE.SphereGeometry(0.2, 8, 8);
    const coreMat = new THREE.MeshBasicMaterial({
        color: 0x66ff66, // LESS INTENSE NEON GREEN
        emissive: 0x66ff66, // LESS INTENSE NEON GREEN
        emissiveIntensity: 1.5
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    
    modelGroup.add(cube);
    modelGroup.add(core);
    
    // Custom animation for the cube for the selector and in-game
    modelGroup.userData.customAnimate = (time) => {
        cube.rotation.x += 0.01;
        cube.rotation.y += 0.02;
        cube.rotation.z += 0.015;
        // Pulse the scale for an energy effect
        const scalePulse = 1.0 + Math.sin(time * 0.005) * 0.05;
        cube.scale.set(scalePulse, scalePulse, scalePulse);
    };

    return modelGroup;
}
// --- END 3D MODEL CREATION FUNCTIONS ---


function initGame() {
  let isFirstPerson = false;
  let isPaused = false; 
  
  const gameState = { score: 0, internalLevel: 1, isGameOver: false, newlyUnlockedCharacterId: null, newlyUnlockedLevel: null, singularityUsed: false, highScoreNotified: false, startingHighScore: 0 };
  const gameConfig = { playerSpeed: -0.15, spawnInterval: 25, levelColors: { 1: { bg: '#010103' }, 2: { bg: '#0c0a1f' }, 3: { bg: '#1d0b30' } } };
  const INTERNAL_LEVEL_THRESHOLDS = { 4: 4000, 5: 7000}; 
  
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(gameConfig.levelColors[1].bg);
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById('gameScreen').appendChild(renderer.domElement);
  
  // --- PAUSE MENU DOM ELEMENTS ---
  const pauseButton = document.getElementById('pause-button');
  const pauseScreen = document.getElementById('pauseScreen');
  const resumeButton = document.getElementById('resume-button');
  const restartPauseButton = document.getElementById('restart-pause-button');
  const menuPauseButton = document.getElementById('menu-pause-button');

  document.getElementById('highScore').innerText = `High Score: ${highScores[selectedLevel]}`;

  let player, obstacles = [], trailParticles = [], grounds = [], lastSpawnZ, animationId;
  let trailMaterial, trailGeometry, trailColor, trailSize; // Trail variables

  
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
              { x: -4, z: -2 }, { x: -1, z: -2 },  
              { x: 1,  z: 0 },  { x: 4,  z: 0 },   
              { x: -4, z: 2 }, { x: -1, z: 2 }   
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

  // MODIFIED: startGame now removes ALL menu screens
  startGame = () => { 
      document.querySelectorAll('.menuScreen').forEach(screen => screen.classList.remove('active'));
      document.getElementById('gameScreen').style.display = 'block'; 
      setupNewGame(); 
  };
  function createGalaxyBackground() { /* ... (no changes) */ const particleCount = 5000; const positions = []; for (let i = 0; i < particleCount; i++) { const radius = Math.random() * 200 + 20; const angle = Math.random() * Math.PI * 2; const x = Math.cos(angle) * radius; const y = Math.random() * 40 + 5; const z = Math.sin(angle) * radius; positions.push(x, y, z - 100); } const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); const material = new THREE.PointsMaterial({ size: 0.2, color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false }); const galaxy = new THREE.Points(geometry, material); galaxy.renderOrder = -1; return galaxy; }
  function boxCollision({box1,box2}){const b1p=new THREE.Vector3();box1.getWorldPosition(b1p);const b2p=new THREE.Vector3();box2.getWorldPosition(b2p);const b1=box1.geometry.parameters;const b2=box2.geometry.parameters;return(Math.abs(b1p.x-b2p.x)*2<(b1.width+b2.width))&&(Math.abs(b1p.y-b2p.y)*2<(b1.height+b2.height))&&(Math.abs(b1p.z-b2p.z)*2<(b1.depth+b2.depth))}
  
  function setupNewGame() {
      isPaused = false; 
      // FIX: Ensure pause screens are hidden at start
      pauseScreen.style.display = 'none'; 
      pauseButton.style.display = 'flex'; 

      gameState.isGameOver=false;gameState.score=0;
      gameState.internalLevel = selectedLevel; 
      gameState.newlyUnlockedCharacterId=null; 
      gameState.newlyUnlockedLevel = null; 
      gameState.singularityUsed = false;
      gameState.highScoreNotified = false; 
      gameState.startingHighScore = highScores[selectedLevel]; 
      
      // --- MODIFICATION: Speeds adjusted to be even slower ---
      switch(selectedLevel) {
        case 1:
            gameConfig.playerSpeed = -0.08; 
            gameConfig.spawnInterval = 25;
            scene.background = new THREE.Color(gameConfig.levelColors[1].bg);
            break;
        case 2:
            gameConfig.playerSpeed = -0.12; 
            gameConfig.spawnInterval = 22;
            scene.background = new THREE.Color(gameConfig.levelColors[2].bg);
            break;
        case 3: 
            gameConfig.playerSpeed = -0.16; 
            gameConfig.spawnInterval = 18;
            scene.background = new THREE.Color(gameConfig.levelColors[3].bg);
            break;
      }
      
      lastSpawnZ=-20;
      obstacles=[];trailParticles=[];grounds=[];
      
      // --- NEW TRAIL SETUP ---
      const charData = PLAYER_OBJECTS[selectedObjectId];
      trailColor = charData.trailColor;
      trailSize = charData.trailSize;
      
      // Create new materials if not already created
      if (!charData.trailMaterial) {
          charData.trailMaterial = new THREE.MeshBasicMaterial({ 
              color: trailColor, 
              transparent: true, 
              blending: THREE.AdditiveBlending, // Added blending for a glowing look
              opacity: 0.9 
          });
      }
      trailMaterial = charData.trailMaterial;
      trailGeometry = new THREE.SphereGeometry(trailSize, 6, 6); // Use character-specific size
      // --- END NEW TRAIL SETUP ---

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
          availableObstacles = obstacleTypes.slice(0, 2); 
      } else if (selectedLevel === 2) {
          availableObstacles = obstacleTypes.slice(0, 3); 
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
      
      playSound('crash'); 
      pauseButton.style.display = 'none'; 
      pauseScreen.style.display = 'none'; 
      isPaused = false; 
      
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
              combinedBtn.className = 'play-combined-button'; 
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

      // --- MODIFIED --- (Fix crash bug for shader material)
      player.visualModel.traverse(c => {
          if (c.isMesh && c.material) {
              if (Array.isArray(c.material)) {
                  c.material.forEach(mat => {
                      if (mat.isShaderMaterial) {
                          mat.uniforms.color.value.set(0xd1201b); 
                      } else if (mat.color) {
                          mat.color.set(0xd1201b);
                      }
                  });
              } else {
                  if (c.material.isShaderMaterial) {
                      // Handle shader material (the orb)
                      c.material.uniforms.color.value.set(0xd1201b); // Set the color uniform to red
                  } else if (c.material.color) {
                      // Handle standard materials (rocket, etc.)
                      c.material.color.set(0xd1201b);
                  }
              }
          }
      });
      // --- END MODIFIED ---
      
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

  // MODIFIED: backToMenu now shows the Level Selection Screen
  function backToMenu() { 
    if(animationId) cancelAnimationFrame(animationId); 
    
    isPaused = false; 
    pauseButton.style.display = 'none'; 
    pauseScreen.style.display = 'none'; 

    cleanUpScene(); 
    document.getElementById('gameOverScreen').style.display = 'none'; 
    document.getElementById('gameScreen').style.display = 'none'; 
    
    // Show the primary menu screen
    showScreen('levelSelectionScreen');
    
    updateCharacterSelectorDisplay(); 
    updateLevelSelectorUI(); 
  }
  
  window.addEventListener('keydown', e => {
      switch(e.code){
          case 'KeyA':
              keys.a.pressed = true;
              break;
          case 'KeyD':
              keys.d.pressed = true;
              break;
          case 'Space':
              if(player && player.onGround){
                  playSound('jump');
                  player.velocity.y=.12;
              }
              break;
          case 'KeyR':
              if(gameState.isGameOver)resetGame();
              break;
          case 'KeyP':
              togglePause(!isPaused);
              break;
      }
  });

  window.addEventListener('keyup',e=>{switch(e.code){case'KeyA':keys.a.pressed=false;case'KeyD':keys.d.pressed=false;}});
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
      if (gameState.isGameOver) return; 
      isPaused = pauseState;
      pauseScreen.style.display = isPaused ? 'block' : 'none';
      
      if (!isPaused && !gameState.isGameOver) {
          pauseButton.style.display = 'flex'; 
      } else {
          pauseButton.style.display = 'none';
      }
      
      if (isPaused) {
          cancelAnimationFrame(animationId); 
      } else {
          animate(); 
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
    if (isPaused) return; 

    animationId = requestAnimationFrame(animate);
    player.update(grounds);

    const time = Date.now();
    if (player.visualModel) {
        if (player.visualModel.userData.shaderMaterial) {
            player.visualModel.userData.shaderMaterial.uniforms.time.value += 0.05;
        }
        if (player.visualModel.userData.customAnimate) {
            player.visualModel.userData.customAnimate(time);
        }
    }

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

        if (gameState.score > highScores[selectedLevel]) {
            if (!gameState.highScoreNotified && gameState.startingHighScore > 0) {
                gameState.highScoreNotified = true; 
                const lUE = document.getElementById('levelUp');
                lUE.innerText = `🌟 New High Score! 🌟`; 
                lUE.classList.add('show');
                setTimeout(() => lUE.classList.remove('show'), 2500); 
            }
            highScores[selectedLevel] = gameState.score;
            localStorage.setItem('spaceRunnerHighScores', JSON.stringify(highScores));
            document.getElementById('highScore').innerText = `High Score: ${highScores[selectedLevel]}`;
        }
        
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

        // Check for Orb Unlock (from Level 3, score 1000)
        if (selectedLevel === 3 && !PLAYER_OBJECTS['orb'].isUnlocked && gameState.score >= 1000) {
            PLAYER_OBJECTS['orb'].isUnlocked = true;
            const unlocked = JSON.parse(localStorage.getItem('spaceRunnerUnlocks')) || ['rocket'];
            if (!unlocked.includes('orb')) { 
                unlocked.push('orb');
                localStorage.setItem('spaceRunnerUnlocks', JSON.stringify(unlocked));
            }
            gameState.newlyUnlockedCharacterId = 'orb'; 
            
            const uN=document.getElementById('unlock-notification');
            uN.innerHTML=`New Vehicle Unlocked:<br/><strong>${PLAYER_OBJECTS['orb'].name}</strong>`;
            uN.classList.add('show');
            setTimeout(()=>uN.classList.remove('show'), 3000);
        }

        // Check for Hyper Cube Unlock (from Level 3, score 2000)
        if (selectedLevel === 3 && !PLAYER_OBJECTS['hypercube'].isUnlocked && gameState.score >= 2000) {
            PLAYER_OBJECTS['hypercube'].isUnlocked = true;
            const unlocked = JSON.parse(localStorage.getItem('spaceRunnerUnlocks')) || ['rocket'];
            if (!unlocked.includes('hypercube')) { 
                unlocked.push('hypercube');
                localStorage.setItem('spaceRunnerUnlocks', JSON.stringify(unlocked));
            }
            gameState.newlyUnlockedCharacterId = 'hypercube'; 
            
            const uN=document.getElementById('unlock-notification');
            uN.innerHTML=`New Vehicle Unlocked:<br/><strong>${PLAYER_OBJECTS['hypercube'].name}</strong>`;
            uN.classList.add('show');
            setTimeout(()=>uN.classList.remove('show'), 3000);
        }
        
        // --- Level 3 Progression ---
        if (selectedLevel === 3) {
            const nIL = gameState.internalLevel + 1; 
            if (INTERNAL_LEVEL_THRESHOLDS[nIL] && gameState.score >= INTERNAL_LEVEL_THRESHOLDS[nIL]) {
                
                gameState.internalLevel = nIL; 
                document.getElementById('level').innerText=`Level: 3 (Stage ${nIL-2})`;
                
                const lUE=document.getElementById('levelUp');
                lUE.innerText=`Stage ${nIL-2}`;
                lUE.classList.add('show');
                setTimeout(()=>lUE.classList.remove('show'),2000);
                
                if (nIL === 4) {
                    gameConfig.playerSpeed -= .01; 
                    gameConfig.spawnInterval = 16; 
                } else if (nIL === 5) {
                    gameConfig.playerSpeed -= .01; 
                    gameConfig.spawnInterval = 14;
                }
            }
        }
    }

    if(selectedLevel === 3 && gameState.internalLevel >= 3) gameConfig.playerSpeed-=.000001; 

    player.velocity.x=0;player.velocity.z=gameConfig.playerSpeed;
    if(keys.a.pressed)player.velocity.x=-.05;else if(keys.d.pressed)player.velocity.x=.05;
    galaxy.rotation.y += 0.0001;
    
    if (!gameState.isGameOver && trailParticles.length < 50) { 
        const trailParticle = new THREE.Mesh(trailGeometry, trailMaterial.clone()); 
        
        const randomColor = new THREE.Color(trailColor);
        randomColor.offsetHSL(0, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.2);
        trailParticle.material.color.set(randomColor);
        
        trailParticle.position.copy(player.position); 
        if (selectedObjectId === 'rocket') { 
            trailParticle.position.z += player.depth / 2; 
        } 
        scene.add(trailParticle); 
        trailParticles.push(trailParticle); 
    }
    for (let i = trailParticles.length - 1; i >= 0; i--) { 
        const p = trailParticles[i]; 
        p.material.opacity *= 0.93; 
        if (p.material.opacity < 0.01) { 
            scene.remove(p); 
            trailParticles.splice(i, 1); 
        } 
    }
    
    renderer.render(scene, camera);
  }
}