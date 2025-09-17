// main.js
// === MAIN VARIABLES ===
let scene, camera, renderer;
let player;
let floor;
let keys = {};
let playerVelocity = new THREE.Vector3();
let isOnFloor = false;

// === INITIALIZE THE GAME ===
function init() {
    createScene();
    createLights();
    createFloor();
    createPlayer();
    createSkybox();
    setupEventListeners();
    animate();
    console.log("Game initialized! If you see this, Three.js is working.");
}

// === SETUP THE BASIC 3D SCENE ===
function createScene() {
    // 1. Create the scene
    scene = new THREE.Scene();

    // 2. Create the camera (PerspectiveCamera: FOV, aspect ratio, near clip, far clip)
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, 5); // Start behind and above the player

    // 3. Create the renderer
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x87CEEB); // Set background to sky blue
    document.body.appendChild(renderer.domElement); // Add the <canvas> to the page

    // Handle window resizing
    window.addEventListener('resize', onWindowResize);
}

// === CREATE LIGHTS ===
function createLights() {
    // Ambient light (global light)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    // Directional light (like the sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    scene.add(directionalLight);
}

// === CREATE A FLOOR ===
function createFloor() {
    const floorGeometry = new THREE.PlaneGeometry(20, 20);
    const floorMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x44aa88 // Greenish color
    });
    floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2; // Rotate to be horizontal
    scene.add(floor);
}

// === CREATE A PLAYER (SIMPLE CUBE) ===
function createPlayer() {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0xff9900 }); // Orange color
    player = new THREE.Mesh(geometry, material);
    player.position.y = 0.5; // Place it on the floor
    scene.add(player);
}

// === CREATE A SIMPLE SKYBOX (Using a large cube) ===
function createSkybox() {
    const skyboxGeometry = new THREE.BoxGeometry(100, 100, 100);
    const skyboxMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x87CEEB, // Sky blue
        side: THREE.BackSide // Render the inside of the cube
    });
    const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
    scene.add(skybox);
}

// === EVENT LISTENERS FOR KEYBOARD ===
function setupEventListeners() {
    // Keyboard controls
    document.addEventListener('keydown', (event) => {
        keys[event.code] = true;
    });
    document.addEventListener('keyup', (event) => {
        keys[event.code] = false;
    });
}

// === HANDLE WINDOW RESIZING ===
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// === SIMPLE PHYSICS AND MOVEMENT ===
function updatePlayer(deltaTime) {
    const speed = 5.0 * deltaTime;

    // Move forward/backward
    if (keys['KeyW']) player.position.z -= speed;
    if (keys['KeyS']) player.position.z += speed;
    // Move left/right
    if (keys['KeyA']) player.position.x -= speed;
    if (keys['KeyD']) player.position.x += speed;

    // Make camera follow the player
    camera.position.x = player.position.x;
    camera.position.z = player.position.z + 5;
    camera.lookAt(player.position.x, player.position.y, player.position.z);
}

// === MAIN ANIMATION LOOP ===
function animate() {
    requestAnimationFrame(animate);

    // Calculate time since last frame for smooth movement
    const deltaTime = 0.016; // Fixed time step for simplicity

    updatePlayer(deltaTime);

    // Render the scene
    renderer.render(scene, camera);
}

// === START EVERYTHING AFTER THE PAGE LOADS ===
// This is the crucial fix: wait for the DOM to be fully ready.
document.addEventListener('DOMContentLoaded', function() {
    // Let's also add a quick check to see if Three.js loaded correctly
    if (typeof THREE === 'undefined') {
        console.error('Three.js library failed to load! Check your internet connection or the CDN link.');
        document.getElementById('info').innerHTML += '<p style="color: red;">Error: Three.js failed to load.</p>';
    } else {
        console.log('Three.js loaded successfully. Starting game...');
        init();
    }
});