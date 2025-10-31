import * as THREE from 'three';

// --- GLOBAL TEXTURE LOADER AND CACHE ---
const textureLoader = new THREE.TextureLoader();
const TEXTURES = {
    rocketBody: 'metal_texture.jpg',
    asteroidSurface: 'asteroid.jpg',
    saturnPlanet: 'saturn-colour.jpg',
    saturnRing: 'saturn-rings.png',
    // === 🛠️ ADDED SPACESHIP FLOOR TEXTURE ===
    spaceshipFloor: 'spaceship_floor_grid.jpg' 
    // ======================================
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

// ---- QUEST & REWARD SYSTEM DATA ----
const QUEST_TYPES = [
    {
        name: 'Jump X times in one run',
        key: 'jump',
        min: 3, max: 8,
        runOnly: true,
        checker: progress => progress.jumps >= progress.target,
        progressText: progress => `Jumps: ${progress.jumps} / ${progress.target}`,
        reward: 10,
    },
    {
        name: 'Survive Y points in one run',
        key: 'score',
        min: 100, max: 500,
        runOnly: true,
        checker: progress => progress.score >= progress.target,
        progressText: progress => `Score: ${progress.score} / ${progress.target}`,
        reward: 10,
    },
    {
        name: 'Don\'t crash more than Z times in 5 runs',
        key: 'deaths',
        min: 3, max: 5,
        runOnly: false,
        checker: progress => progress.deaths <= progress.target,
        progressText: progress => `Deaths: ${progress.deaths} / ${progress.target}`,
        reward: 10,
    },
];

function getRandomQuests(n = 3) {
    const chosen = [];
    const used = new Set();
    while (chosen.length < n && used.size < QUEST_TYPES.length) {
        const i = Math.floor(Math.random() * QUEST_TYPES.length);
        if (!used.has(i)) {
            used.add(i);
            const qt = QUEST_TYPES[i];
            const target = Math.floor(Math.random() * (qt.max - qt.min + 1)) + qt.min;
            const questData = {
                ...qt,
                target,
                done: false,
                jumps: 0,
                score: 0,
                deaths: 0
            };
            chosen.push(questData);
        }
    }
    return chosen;
}

function loadDailyQuests() {
    let quests = JSON.parse(localStorage.getItem('spaceRunnerQuests'));
    let lastDay = localStorage.getItem('spaceRunnerQuestDay');
    const nowDay = new Date().toDateString();
    if (!quests || lastDay !== nowDay) {
        quests = getRandomQuests();
        localStorage.setItem('spaceRunnerQuests', JSON.stringify(quests));
        localStorage.setItem('spaceRunnerQuestDay', nowDay);
        localStorage.setItem('spaceRunnerQuestRun', JSON.stringify({ jumps:0, deaths:0, completed:false }));
    } else {
        quests = quests.map(q => {
            const questType = QUEST_TYPES.find(qt => qt.key === q.key);
            if (questType) {
                return { ...q, ...questType };
            }
            return q;
        });
    }
    return quests;
}

function saveDailyQuests(quests) {
    localStorage.setItem('spaceRunnerQuests', JSON.stringify(quests));
}

let dailyQuests = loadDailyQuests();

// ---- DEBUG HELPERS (accessible from browser console) ----
window.resetQuests = function() {
    localStorage.removeItem('spaceRunnerQuests');
    localStorage.removeItem('spaceRunnerQuestDay');
    localStorage.removeItem('spaceRunnerQuestRewarded');
    console.log('Quests reset! Reload the page to get new quests.');
};

window.addStars = function(amount) {
    const stars = parseInt(localStorage.getItem('spaceRunnerStars') || '0', 10);
    localStorage.setItem('spaceRunnerStars', String(stars + amount));
    console.log(`Added ${amount} stars. New total: ${stars + amount}`);
};

window.checkQuests = function() {
    console.log('Current Quests:', dailyQuests);
    console.log('Current Stars:', localStorage.getItem('spaceRunnerStars'));
};

// ---- SHOP SYSTEM DATA ----
const SHOP_ITEMS = [
    {
        id: 'nebula_skin',
        name: 'Nebula Cruiser',
        icon: '🌌',
        price: 50,
        type: 'skin',
        description: 'A cosmic purple skin for Galaxy Cruiser',
        basedOn: 'rocket',
        color: 0x9333ea,
        trailColor: 0xc084fc
    },
    {
        id: 'fire_skin',
        name: 'Inferno Rocket',
        icon: '🔥',
        price: 75,
        type: 'skin',
        description: 'A fiery red skin for Galaxy Cruiser',
        basedOn: 'rocket',
        color: 0xff3333,
        trailColor: 0xff6b00
    },
    {
        id: 'ice_asteroid',
        name: 'Frozen Comet',
        icon: '❄️',
        price: 100,
        type: 'character',
        description: 'Exclusive icy variant of Rogue Asteroid',
        basedOn: 'asteroid',
        color: 0x7dd3fc,
        trailColor: 0xbfdbfe
    },
];

function loadShopPurchases() {
    return JSON.parse(localStorage.getItem('spaceRunnerShopPurchases')) || [];
}

function saveShopPurchases(purchases) {
    localStorage.setItem('spaceRunnerShopPurchases', JSON.stringify(purchases));
}

let shopPurchases = loadShopPurchases();

function getEquippedSkin() {
    return localStorage.getItem('spaceRunnerEquippedSkin') || null;
}

function setEquippedSkin(skinId) {
    if (skinId) {
        localStorage.setItem('spaceRunnerEquippedSkin', skinId);
    } else {
        localStorage.removeItem('spaceRunnerEquippedSkin');
    }
}

let equippedSkin = getEquippedSkin();

// ---- SOUND EFFECT SYSTEM ----
const audio = {
    bgm: new Audio('sounds/invasion-march-star-wars-style-cinematic-music-219585.mp3'),
    jump: new Audio('sounds/jump.wav'),
    crash: new Audio('sounds/dying.mp3'),
    click: new Audio('sounds/buttonclick.mp3'),
};

audio.bgm.loop = true;
audio.bgm.volume = 0.14;
audio.jump.volume = 1.0;

function playSound(s) {
    if (!audio[s]) return;
    if (s === 'crash') {
        audio.crash.volume = 1.0;
    }
    audio[s].currentTime = 0;
    audio[s].play();
}

// --- INITIAL SETUP & GLOBAL FUNCTIONS ---

loadTextures(() => {
    setupMenu();
    setupCharacterSelector();
    setupQuestsAndShop();
    initGame();
});

window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        audio.bgm.play().catch(()=>{});
    }, 700);
});

// --- MENU BUTTON CLICK SOUNDS ---
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

    // Start mission button on the character screen
    document.getElementById('start-button').addEventListener('click', () => {
        const obj = PLAYER_OBJECTS[selectedObjectId];
        if (obj.isUnlocked) {
            if (startGame) startGame();
        }
    });

    // Back to levels button on character screen
    document.getElementById('back-to-levels-btn').addEventListener('click', () => {
        showScreen('levelSelectionScreen');
    });

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
        const startBtn = document.getElementById('start-button');
        if (startBtn) {
            startBtn.textContent = `🎮 START LEVEL ${selectedLevel}`;
        }

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

    // Wait a moment for CSS to apply, then get size
    setTimeout(() => {
        const computedStyle = window.getComputedStyle(previewCanvas);
        const canvasWidth = parseInt(computedStyle.width) || 300;
        const canvasHeight = parseInt(computedStyle.height) || 300;
        const canvasSize = Math.min(canvasWidth, canvasHeight);

        // Set canvas rendering size
        previewCanvas.width = canvasSize;
        previewCanvas.height = canvasSize;

        if (renderer) {
            renderer.setSize(canvasSize, canvasSize);
            renderPreview();
        }
    }, 100);

    // Initial size
    previewCanvas.width = 300;
    previewCanvas.height = 300;

    const scene = new THREE.Scene();
    scene.background = null; // Transparent background for the scene

    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.set(0, 0, 2.5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
        canvas: previewCanvas,
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: true
    });
    renderer.setClearColor(0x000000, 0); // Transparent clear color
    renderer.setSize(300, 300);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
    keyLight.position.set(2, 2, 3);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
    fillLight.position.set(-2, 0, -1);
    scene.add(fillLight);

    let currentModel;

    console.log('Character selector initialized');

    // FIX: Character preview rendering logic
    function renderPreview() {
        if (!allTexturesLoaded) {
            console.log('Textures not loaded yet');
            return;
        }
        // Remove old model completely
        if (currentModel) {
            scene.remove(currentModel);
            // Dispose of geometries and materials to free memory
            currentModel.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(material => material.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
            currentModel = null;
        }

        // Create new model for the selected character
        const characterObj = PLAYER_OBJECTS[selectedObjectId];
        console.log('Creating model for:', selectedObjectId, characterObj);

        currentModel = characterObj.createModel();
        currentModel.rotation.x = 0;
        currentModel.position.set(0, 0, 0);
        scene.add(currentModel);
        renderer.render(scene, camera); // Render once immediately
        console.log('Character rendered:', selectedObjectId, currentModel);
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
        const startBtn = document.getElementById('start-button');
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
            // statusEl is not found in index.html, so commenting out to avoid error (but keeping the original structure)
            // if (statusEl) {
            //     statusEl.classList.remove('hidden');
            //     statusEl.textContent = 'UNLOCKED!';
            // }
            startBtn.disabled = false; // <--- FIX: Ensure button is enabled when unlocked
            lockOverlayEl.classList.add('hidden'); // NEW: Hide the lock overlay
        } else {
            lockEl.classList.remove('hidden');
            // if (statusEl) {
            //     statusEl.classList.add('hidden');
            // }

            if (obj.unlockText) {
                lockEl.querySelector('.unlock-text').textContent = obj.unlockText;
            } else {
                lockEl.querySelector('.unlock-text').textContent = `Unlock at Level ${obj.unlockLevel}`;
            }

            startBtn.disabled = true; // <--- FIX: Ensure button is disabled when locked
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

    // Force initial render after a short delay
    setTimeout(() => {
        console.log('Force initial render');
        renderPreview();
    }, 500);

    updateCharacterSelectorDisplay();
    animatePreview();

    console.log('Character selector setup complete');
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


// Apply skin colors to player model
function applySkinToPlayer(player, skinItem) {
    if (!player || !skinItem) return;

    // Apply color to all meshes in the visual model
    player.visualModel.traverse(child => {
        if (child.isMesh && child.material) {
            if (Array.isArray(child.material)) {
                child.material.forEach(mat => {
                    if (mat.color && !mat.isShaderMaterial) {
                        mat.color.setHex(skinItem.color);
                    }
                });
            } else {
                if (child.material.color && !child.material.isShaderMaterial) {
                    child.material.color.setHex(skinItem.color);
                }
            }
        }
    });

    console.log(`Applied skin: ${skinItem.name} with color ${skinItem.color.toString(16)}`);
}

// =================================================================
// === NEW: STARFIELD & SHOOTING STAR LOGIC ========================
// =================================================================

// New global array to hold the THREE.js shooting stars
let shootingStars = [];

// Global variable for the shooting star interval ID
let shootingStarInterval;

// Function to create a single THREE.js shooting star
function spawnShootingStar() {
    // Geometry is a thin cylinder or box
    const geometry = new THREE.CylinderGeometry(0.05, 0.0, 15, 32); 
    const material = new THREE.MeshBasicMaterial({ 
        color: 0xffffff, 
        transparent: true, 
        opacity: 0.8,
        blending: THREE.AdditiveBlending // Makes it glow
    });
    
    const star = new THREE.Mesh(geometry, material);
    
    // Random position far in front of the camera, high up
    const x = (Math.random() - 0.5) * 60;
    const y = 20 + Math.random() * 20;
    // Set it far in front of the player, in the visible distance (relative to player's Z)
    const z = player.position.z - 200 - Math.random() * 100; 
    
    star.position.set(x, y, z);
    
    // Rotate to give a diagonal trail look
    star.rotation.z = Math.PI / 4 + (Math.random() * 0.5 - 0.25); 
    star.rotation.x = Math.PI / 2; // Point it back
    
    // Store properties for animation and cleanup
    star.userData.speed = 0.5 + Math.random() * 0.5;
    star.userData.lifetime = 0;
    star.userData.maxLifetime = 100; // Frames before removal
    
    scene.add(star);
    shootingStars.push(star);
}

// MODIFIED: createGalaxyBackground now creates static stars that are always visible
let galaxy; // Declare galaxy globally so it can be accessed in animate()

function createGalaxyBackground() { 
    const particleCount = 8000; 
    const positions = []; 
    // Increased the size of the box for the stars to spread out more
    const range = 500; 
    for (let i = 0; i < particleCount; i++) { 
        // Use a box to distribute stars in 3D space
        const x = (Math.random() - 0.5) * range; 
        const y = (Math.random() - 0.5) * range; 
        const z = (Math.random() - 0.5) * range; 
        positions.push(x, y, z); 
    } 
    const geometry = new THREE.BufferGeometry(); 
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); 
    const material = new THREE.PointsMaterial({ 
        size: 0.15, // Small size for distant stars
        color: 0xffffff, 
        transparent: true, 
        opacity: 0.9, 
        depthWrite: false // Important: Allows stars to be seen even if they are far away
    }); 
    
    // Assign to global variable
    galaxy = new THREE.Points(geometry, material); 
    
    // Set a very low renderOrder to ensure it renders behind all obstacles and ground
    galaxy.renderOrder = -999; 
    
    // Initially place stars far away
    galaxy.position.z = -200; 
    
    return galaxy; 
}
// =================================================================
// === END STARFIELD & SHOOTING STAR LOGIC =========================
// =================================================================

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
                { x: 1, z: 0 }, { x: 4, z: 0 },
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
    
    // --- MODIFIED: Create, but don't add to scene yet ---
    createGalaxyBackground(); 
    // --- END MODIFIED ---
    
    const spaceLight = new THREE.DirectionalLight(0xffffff, 1.5); spaceLight.position.set(5, 5, 2); spaceLight.castShadow = true; scene.add(spaceLight);
    scene.add(new THREE.AmbientLight(0x87CEEB, .5));
    const keys = { a: { pressed: false }, d: { pressed: false } };

    // MODIFIED: startGame now removes ALL menu screens and ensures gameScreen is visible
    startGame = () => {
        // 1. Hide ALL menu screens FIRST
        document.querySelectorAll('.menuScreen').forEach(screen => screen.classList.remove('active'));

        // 2. Make the gameScreen visible IMMEDIATELY
        document.getElementById('gameScreen').classList.remove('hidden');

        // 3. Setup and start the rendering loop
        setupNewGame();
    };
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

        // Reset run-only quest progress
        resetQuestProgressForRun();

        // --- NEW: Shooting Star Setup ---
        if (shootingStarInterval) clearInterval(shootingStarInterval);
        shootingStarInterval = setInterval(spawnShootingStar, 3000); // Spawn a shooting star every 3 seconds
        // --- END NEW: Shooting Star Setup ---

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

        // Use skin trail color if equipped
        if (equippedSkin) {
            const skinItem = SHOP_ITEMS.find(item => item.id === equippedSkin);
            if (skinItem && skinItem.basedOn === selectedObjectId && skinItem.trailColor) {
                trailColor = skinItem.trailColor;
            } else {
                trailColor = charData.trailColor;
            }
        } else {
            trailColor = charData.trailColor;
        }

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

        player=new Player({characterId:selectedObjectId});

        // Apply equipped skin if any
        if (equippedSkin) {
            const skinItem = SHOP_ITEMS.find(item => item.id === equippedSkin);
            if (skinItem && skinItem.basedOn === selectedObjectId) {
                applySkinToPlayer(player, skinItem);
            }
        }

        scene.add(player);
        
        // --- NEW: Add starfield to player's group, not scene directly ---
        player.add(galaxy);
        // --- END NEW ---
        
        // === 🛠️ MODIFIED GROUND CREATION TO USE TEXTURE ===
        const groundTexture = textureCache['spaceshipFloor'];
        if (groundTexture) {
            // Set repeat values for the texture
            // --- MODIFIED: DECREASED REPEAT VALUES FOR LARGER TEXTURE ---
            groundTexture.repeat.set(2, 10); // Repeat 2 times across width, 5 times across depth for a much larger look
            // ==========================================================
            groundTexture.needsUpdate = true;
        }
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: groundTexture ? 0xffffff : 0x1a1a2e, // Use white if using texture, otherwise fallback to old color
            map: groundTexture || null, // Apply the texture if it loaded
            emissive: 0x111111,
            emissiveIntensity: 0.1,
            metalness: 0.9,
            roughness: 0.8
        });

        for(let i=0;i<2;i++){
            const g=new Box({width:10,height:.5,depth:200,color:0x1a1a2e,position:{x:0,y:-2,z:-i*200},emissiveIntensity:0});
            g.material = groundMaterial.clone(); // Clone to allow individual material updates if needed, though mostly for depth
            g.receiveShadow=true;
            scene.add(g);
            grounds.push(g)
        }
        // =================================================

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

        playSound('crash'); // Play crash SFX once only
        
        // --- NEW: Stop Shooting Star Spawner ---
        if (shootingStarInterval) clearInterval(shootingStarInterval);
        // --- END NEW: Stop Shooting Star Spawner ---

        // Track quest progress for death and score
        updateQuestProgress('deaths');
        updateQuestProgress('score', gameState.score);

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

    function cleanUpScene() { 
        if (player) {
            // --- NEW: Remove starfield from player before removing player ---
            player.remove(galaxy);
            scene.remove(player); 
        }
        // --- NEW: Add galaxy back to scene so it's not disposed with player, 
        //          but just sitting there waiting to be re-parented ---
        scene.add(galaxy); 
        // --- END NEW ---
        
        obstacles.forEach(o => scene.remove(o.group)); 
        grounds.forEach(g => scene.remove(g)); 
        trailParticles.forEach(p => scene.remove(p)); 
        // --- NEW: Cleanup Shooting Stars ---
        shootingStars.forEach(s => scene.remove(s));
        shootingStars = [];
        // --- END NEW: Cleanup Shooting Stars ---
        obstacles = []; grounds = []; trailParticles = []; 
    }

    function resetGame(){
        document.getElementById('gameOverScreen').style.display = 'none';
        cleanUpScene();
        setupNewGame();
    }

    // MODIFIED: backToMenu now shows the Level Selection Screen
    function backToMenu() {
        if(animationId) cancelAnimationFrame(animationId);
        
        // --- NEW: Stop Shooting Star Spawner ---
        if (shootingStarInterval) clearInterval(shootingStarInterval);
        // --- END NEW: Stop Shooting Star Spawner ---

        isPaused = false;
        pauseButton.style.display = 'none';
        pauseScreen.style.display = 'none';

        cleanUpScene();
        document.getElementById('gameOverScreen').style.display = 'none';
        document.getElementById('gameScreen').classList.add('hidden'); // Use class list for consistency

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
                    updateQuestProgress('jump'); // Track jump for quests
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
        
        // --- NEW: Anchor the starfield to the player/camera ---
        if (galaxy && player) {
            // Keep the galaxy positioned far behind the player and slightly below to fill the background
            galaxy.position.set(0, 0, -300); 
            // The player's group rotation causes the starfield to rotate as the player moves (galaxy is a child of player)
            galaxy.rotation.y += 0.0001; 
        }
        // --- END NEW ---

        // --- NEW: Update Shooting Stars (Permanent Background Fix) ---
        for (let i = shootingStars.length - 1; i >= 0; i--) {
            const star = shootingStars[i];
            
            // Move the star (shooting diagonally towards the player/camera)
            star.position.z += star.userData.speed * 2; 
            star.position.y -= star.userData.speed * 0.1;
            
            star.userData.lifetime++;
            
            // Fade and remove after maxLifetime
            if (star.userData.lifetime > star.userData.maxLifetime) {
                star.material.opacity *= 0.95;
            }
            
            // Remove if completely faded or too close to the player
            if (star.material.opacity < 0.05 || star.position.z > player.position.z) {
                scene.remove(star);
                shootingStars.splice(i, 1);
                star.geometry.dispose(); 
                star.material.dispose(); 
            }
        }
        // --- END NEW: Update Shooting Stars ---

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
        // galaxy rotation is handled in the new block above
        

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

// ---- QUESTS & SHOP UI SETUP ----
function setupQuestsAndShop() {
    document.getElementById('quests-btn').addEventListener('click', () => {
        document.getElementById('questsScreen').style.display = 'flex';
        renderQuestScreen();
    });

    document.getElementById('close-quests-btn').addEventListener('click', () => {
        document.getElementById('questsScreen').style.display = 'none';
    });

    document.getElementById('shop-btn').addEventListener('click', () => {
        document.getElementById('shopScreen').style.display = 'flex';
        renderShopScreen();
    });

    document.getElementById('close-shop-btn').addEventListener('click', () => {
        document.getElementById('shopScreen').style.display = 'none';
    });
}

function renderQuestScreen() {
    const quests = dailyQuests;
    const container = document.getElementById('quest-list-container');
    if (!container) return;

    let html = '';
    let completedAll = true;
    let unclaimedStars = 0;
    let hasUnclaimedQuests = false;

    quests.forEach(q => {
        const questClass = q.done ? 'quest-item completed' : 'quest-item';
        const isClaimed = q.claimed !== false;

        html += `<div class="${questClass}">`;
        html += `<div class="quest-title">${q.name.replace(/ X | Y | Z /g, ` ${q.target} `)}</div>`;
        html += `<div class="quest-progress">${q.progressText(q)}</div>`;
        if (q.done) {
            if (isClaimed) {
                html += `<div class="quest-completed-badge">✓ CLAIMED (+${q.reward} ⭐)</div>`;
            } else {
                html += `<div class="quest-completed-badge" style="background: linear-gradient(45deg, #fbbf24, #f59e0b);">⭐ READY TO CLAIM (+${q.reward} ⭐)</div>`;
                unclaimedStars += q.reward;
                hasUnclaimedQuests = true;
            }
        }
        html += `</div>`;
        if (!q.done) completedAll = false;
    });

    if (completedAll && !localStorage.getItem('spaceRunnerQuestRewarded')) {
        unclaimedStars += 30;
    }

    if (hasUnclaimedQuests || (completedAll && !localStorage.getItem('spaceRunnerQuestRewarded'))) {
        html += `<div class="unclaimed-stars-info">💫 Unclaimed Rewards: ${unclaimedStars} Stars</div>`;
        html += `<button class="claim-rewards-btn" onclick="claimQuestRewards()">✨ CLAIM ${unclaimedStars} STARS ✨</button>`;
    } else if (completedAll && localStorage.getItem('spaceRunnerQuestRewarded')) {
        html += `<div class="quest-reward-info">✅ All daily quests completed! New quests available tomorrow.</div>`;
    } else {
        html += `<div class="quest-reward-info">Complete quests to earn stars!</div>`;
    }

    container.innerHTML = html;
}

window.claimQuestRewards = function() {
    let totalStars = 0;

    dailyQuests.forEach(q => {
        if (q.done && q.claimed === false) {
            totalStars += q.reward;
            q.claimed = true;
        }
    });

    const allDone = dailyQuests.every(q => q.done);
    if (allDone && !localStorage.getItem('spaceRunnerQuestRewarded')) {
        totalStars += 30;
        localStorage.setItem('spaceRunnerQuestRewarded', 'yes');
    }

    const currentStars = parseInt(localStorage.getItem('spaceRunnerStars') || '0', 10);
    localStorage.setItem('spaceRunnerStars', String(currentStars + totalStars));

    saveDailyQuests(dailyQuests);
    renderQuestScreen();
    playSound('click');

    console.log(`Claimed ${totalStars} stars! New total: ${currentStars + totalStars}`);
};

function renderShopScreen() {
    const stars = parseInt(localStorage.getItem('spaceRunnerStars') || '0', 10);
    document.getElementById('stars-count').textContent = stars;

    const equippedInfoDiv = document.getElementById('equipped-info');
    if (equippedInfoDiv) {
        if (equippedSkin) {
            const equippedItem = SHOP_ITEMS.find(item => item.id === equippedSkin);
            if (equippedItem) {
                equippedInfoDiv.innerHTML = `
                    <div style="background: rgba(34, 197, 94, 0.1); border: 2px solid #22c55e; padding: 12px; border-radius: 10px;">
                        <div style="color: #22c55e; font-weight: bold; margin-bottom: 8px;">Currently Equipped: ${equippedItem.icon} ${equippedItem.name}</div>
                        <button class="shop-buy-btn" style="background: linear-gradient(45deg, #f59e0b, #ef4444); font-size: 0.9rem; padding: 8px 20px;" onclick="unequipSkin()">REMOVE SKIN</button>
                    </div>
                `;
            }
        } else {
            equippedInfoDiv.innerHTML = '<div style="color: #9ca3af; font-size: 0.95rem;">No skin equipped (using default appearance)</div>';
        }
    }

    const container = document.getElementById('shop-items-container');
    if (!container) return;

    let html = '';

    SHOP_ITEMS.forEach(item => {
        const owned = shopPurchases.includes(item.id);
        const isEquipped = equippedSkin === item.id;
        const itemClass = owned ? 'shop-item owned' : 'shop-item';

        html += `<div class="${itemClass}">`;
        html += `<div class="shop-item-icon">${item.icon}</div>`;
        html += `<div class="shop-item-name">${item.name}</div>`;
        html += `<div class="shop-item-price">⭐ ${item.price}</div>`;

        if (owned) {
            if (isEquipped) {
                html += `<div class="shop-owned-badge" style="background: linear-gradient(45deg, #22c55e, #10b981);">✓ EQUIPPED</div>`;
            } else {
                html += `<button class="shop-buy-btn" style="background: linear-gradient(45deg, #3b82f6, #60a5fa);" onclick="equipShopItem('${item.id}')">EQUIP</button>`;
            }
        } else {
            const canAfford = stars >= item.price;
            const btnDisabled = canAfford ? '' : 'disabled';
            html += `<button class="shop-buy-btn" ${btnDisabled} onclick="buyShopItem('${item.id}')">BUY</button>`;
        }

        html += `</div>`;
    });

    if (SHOP_ITEMS.length === 0) {
        html = '<p style="color: #e5e7eb;">No items available yet. Check back soon!</p>';
    }

    container.innerHTML = html;
}

window.buyShopItem = function(itemId) {
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) return;

    const stars = parseInt(localStorage.getItem('spaceRunnerStars') || '0', 10);

    if (stars < item.price) {
        alert('Not enough stars!');
        return;
    }

    if (shopPurchases.includes(itemId)) {
        alert('Already owned!');
        return;
    }

    localStorage.setItem('spaceRunnerStars', String(stars - item.price));
    shopPurchases.push(itemId);
    saveShopPurchases(shopPurchases);
    renderShopScreen();
    playSound('click');
    alert(`Purchased ${item.name}! You can now equip it.`);
};

window.equipShopItem = function(itemId) {
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) return;

    if (!shopPurchases.includes(itemId)) {
        alert('You must purchase this item first!');
        return;
    }

    equippedSkin = itemId;
    setEquippedSkin(itemId);
    renderShopScreen();
    playSound('click');
    console.log(`Equipped: ${item.name}`);
};

window.unequipSkin = function() {
    equippedSkin = null;
    setEquippedSkin(null);
    renderShopScreen();
    playSound('click');
    console.log('Skin removed - using default appearance');
};

// ---- QUEST PROGRESS UPDATE HOOKS ----
function updateQuestProgress(type, value) {
    let newlyCompleted = false;
    dailyQuests.forEach(q => {
        if (q.key === type && !q.done) {
            const wasDone = q.done;
            if (type === 'jump') {
                q.jumps = (q.jumps || 0) + 1;
                if (q.jumps >= q.target) {
                    q.done = true;
                }
            } else if (type === 'score') {
                q.score = Math.max(q.score || 0, value);
                if (q.score >= q.target) {
                    q.done = true;
                }
            } else if (type === 'deaths') {
                q.deaths = (q.deaths || 0) + 1;
                if (q.deaths <= q.target) {
                    q.done = true;
                }
            }

            if (!wasDone && q.done) {
                newlyCompleted = true;
                q.claimed = false;
                console.log(`Quest completed! Claim your ${q.reward} stars in the Quests menu!`);
                showQuestCompleteNotification();
            }
        }
    });

    if (newlyCompleted) {
        const allDone = dailyQuests.every(q => q.done);
        if (allDone && !localStorage.getItem('spaceRunnerQuestRewarded')) {
            console.log('All quests completed! Claim your +30 bonus stars!');
        }
    }

    saveDailyQuests(dailyQuests);
}

function showQuestCompleteNotification() {
    const notification = document.getElementById('quest-complete-notification');
    if (!notification) return;

    notification.classList.remove('shooting');
    void notification.offsetWidth;
    notification.classList.add('shooting');

    setTimeout(() => {
        notification.classList.remove('shooting');
    }, 2000);
}

function resetQuestProgressForRun() {
    dailyQuests.forEach(q => {
        if (q.runOnly && !q.done) {
            q.jumps = 0;
            q.score = 0;
        }
    });
    saveDailyQuests(dailyQuests);
}