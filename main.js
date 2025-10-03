import * as THREE from 'three';

// Scene setup
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x87CEEB, 20, 80); // Light blue fog
scene.background = new THREE.Color(0x87CEEB); // Light blue sky

// Camera setup
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.6, 0);

// Renderer setup
const canvas = document.querySelector('canvas.webgl');
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true 
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.8;

// Controls
const keys = {};
const mouse = { x: 0, y: 0 };
let isPointerLocked = false;

// Player state
const player = {
  position: new THREE.Vector3(0, 0, 0),
  velocity: new THREE.Vector3(0, 0, 0),
  speed: 0.1,
  rotation: 0
};

// Maze configuration
const MAZE_SIZE = 15;
const CELL_SIZE = 2;
const WALL_HEIGHT = 3;

// Generate maze using recursive backtracking
function generateMaze(size) {
  const maze = Array(size).fill().map(() => Array(size).fill(1));
  const stack = [];
  const start = { x: 1, y: 1 };
  
  maze[start.y][start.x] = 0;
  stack.push(start);
  
  const directions = [
    { x: 0, y: -2 }, // up
    { x: 2, y: 0 },  // right
    { x: 0, y: 2 },  // down
    { x: -2, y: 0 }  // left
  ];
  
  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const neighbors = [];
    
    for (const dir of directions) {
      const nx = current.x + dir.x;
      const ny = current.y + dir.y;
      
      if (nx > 0 && nx < size - 1 && ny > 0 && ny < size - 1 && maze[ny][nx] === 1) {
        neighbors.push({ x: nx, y: ny, dir: dir });
      }
    }
    
    if (neighbors.length > 0) {
      const next = neighbors[Math.floor(Math.random() * neighbors.length)];
      const wallX = current.x + next.dir.x / 2;
      const wallY = current.y + next.dir.y / 2;
      
      maze[next.y][next.x] = 0;
      maze[wallY][wallX] = 0;
      stack.push({ x: next.x, y: next.y });
    } else {
      stack.pop();
    }
  }
  
  // Ensure we have a clear path and some open spaces
  for (let i = 0; i < size; i++) {
    maze[0][i] = 0; // Top row
    maze[size-1][i] = 0; // Bottom row
    maze[i][0] = 0; // Left column
    maze[i][size-1] = 0; // Right column
  }
  
  return maze;
}

// Create stone wall material
function createStoneMaterial() {
  const textureLoader = new THREE.TextureLoader();
  
  // Create procedural stone texture
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  
  // Base stone color - grey
  ctx.fillStyle = '#6a6a6a';
  ctx.fillRect(0, 0, 512, 512);
  
  // Add stone blocks pattern
  const blockSize = 64;
  for (let y = 0; y < 512; y += blockSize) {
    for (let x = 0; x < 512; x += blockSize) {
      // Offset every other row
      const offsetX = (Math.floor(y / blockSize) % 2) * blockSize / 2;
      const actualX = x + offsetX;
      
      if (actualX < 512) {
        // Draw stone block
        const blockColor = `hsl(${200 + Math.random() * 20}, ${10 + Math.random() * 10}%, ${35 + Math.random() * 15}%)`;
        ctx.fillStyle = blockColor;
        ctx.fillRect(actualX, y, blockSize, blockSize);
        
        // Add stone texture details
        for (let i = 0; i < 50; i++) {
          const px = actualX + Math.random() * blockSize;
          const py = y + Math.random() * blockSize;
          const size = Math.random() * 4 + 1;
          const alpha = Math.random() * 0.4 + 0.1;
          
          ctx.fillStyle = `rgba(${Math.random() * 40 + 60}, ${Math.random() * 40 + 60}, ${Math.random() * 40 + 60}, ${alpha})`;
          ctx.fillRect(px, py, size, size);
        }
        
        // Add mortar lines
        ctx.fillStyle = '#4a4a4a';
        ctx.fillRect(actualX, y, blockSize, 2);
        ctx.fillRect(actualX, y, 2, blockSize);
      }
    }
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  
  return new THREE.MeshLambertMaterial({ 
    map: texture,
    color: 0x7a7a7a
  });
}

// Create brick floor texture
function createBrickTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  
  // Base brick color
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(0, 0, 512, 512);
  
  // Draw brick pattern
  const brickWidth = 64;
  const brickHeight = 32;
  const mortarThickness = 4;
  
  for (let y = 0; y < 512; y += brickHeight + mortarThickness) {
    for (let x = 0; x < 512; x += brickWidth + mortarThickness) {
      // Offset every other row
      const offsetX = (Math.floor(y / (brickHeight + mortarThickness)) % 2) * (brickWidth + mortarThickness) / 2;
      const actualX = x + offsetX;
      
      if (actualX < 512) {
        // Draw brick
        ctx.fillStyle = '#A0522D';
        ctx.fillRect(actualX, y, brickWidth, brickHeight);
        
        // Add brick texture
        ctx.fillStyle = '#CD853F';
        for (let i = 0; i < 20; i++) {
          const px = actualX + Math.random() * brickWidth;
          const py = y + Math.random() * brickHeight;
          ctx.fillRect(px, py, 2, 2);
        }
        
        // Add mortar lines
        ctx.fillStyle = '#696969';
        ctx.fillRect(actualX, y, brickWidth, mortarThickness);
        ctx.fillRect(actualX, y, mortarThickness, brickHeight);
      }
    }
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);
  
  return texture;
}

// Create torch
function createTorch() {
  const group = new THREE.Group();
  
  // Torch pole
  const poleGeometry = new THREE.CylinderGeometry(0.05, 0.05, 2, 8);
  const poleMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
  const pole = new THREE.Mesh(poleGeometry, poleMaterial);
  pole.position.y = 1;
  group.add(pole);
  
  // Torch head
  const headGeometry = new THREE.SphereGeometry(0.15, 8, 6);
  const headMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
  const head = new THREE.Mesh(headGeometry, headMaterial);
  head.position.y = 2;
  group.add(head);
  
  // Flame
  const flameGeometry = new THREE.SphereGeometry(0.1, 6, 4);
  const flameMaterial = new THREE.MeshBasicMaterial({ 
    color: 0xff6600,
    transparent: true,
    opacity: 0.8
  });
  const flame = new THREE.Mesh(flameGeometry, flameMaterial);
  flame.position.y = 2.2;
  group.add(flame);
  
  // Torch light
  const torchLight = new THREE.PointLight(0xff6600, 2, 8);
  torchLight.position.set(0, 2.2, 0);
  torchLight.castShadow = true;
  torchLight.shadow.mapSize.width = 512;
  torchLight.shadow.mapSize.height = 512;
  group.add(torchLight);
  
  return group;
}

// Create mystical particle system
function createMysticalParticles() {
  const particleCount = 200;
  const particles = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  
  for (let i = 0; i < particleCount * 3; i += 3) {
    positions[i] = (Math.random() - 0.5) * MAZE_SIZE * CELL_SIZE;
    positions[i + 1] = Math.random() * 2 + 1;
    positions[i + 2] = (Math.random() - 0.5) * MAZE_SIZE * CELL_SIZE;
  }
  
  particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  
  const particleMaterial = new THREE.PointsMaterial({
    color: 0x88ccff,
    size: 0.02,
    transparent: true,
    opacity: 0.6
  });
  
  return new THREE.Points(particles, particleMaterial);
}

// Build the maze
function buildMaze() {
  const maze = generateMaze(MAZE_SIZE);
  console.log('Generated maze:', maze);
  const wallMaterial = createStoneMaterial();
  
  const mazeGroup = new THREE.Group();
  
  // Create walls
  let wallCount = 0;
  for (let y = 0; y < MAZE_SIZE; y++) {
    for (let x = 0; x < MAZE_SIZE; x++) {
      if (maze[y][x] === 1) {
        const wallGeometry = new THREE.BoxGeometry(CELL_SIZE, WALL_HEIGHT, CELL_SIZE);
        const wall = new THREE.Mesh(wallGeometry, wallMaterial);
        wall.position.set(
          (x - MAZE_SIZE / 2) * CELL_SIZE,
          WALL_HEIGHT / 2,
          (y - MAZE_SIZE / 2) * CELL_SIZE
        );
        wall.castShadow = true;
        wall.receiveShadow = true;
        mazeGroup.add(wall);
        wallCount++;
      }
    }
  }
  console.log(`Created ${wallCount} walls`);
  
  // Create brick floor
  const floorGeometry = new THREE.PlaneGeometry(MAZE_SIZE * CELL_SIZE, MAZE_SIZE * CELL_SIZE);
  const floorMaterial = new THREE.MeshLambertMaterial({ 
    color: 0x8B4513, // Brick brown color
    map: createBrickTexture()
  });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.receiveShadow = true;
  mazeGroup.add(floor);
  
  // Add torches at strategic locations
  const torchPositions = [
    { x: 2, z: 2 },
    { x: -2, z: 2 },
    { x: 2, z: -2 },
    { x: -2, z: -2 },
    { x: 6, z: 6 },
    { x: -6, z: 6 },
    { x: 6, z: -6 },
    { x: -6, z: -6 }
  ];
  
  torchPositions.forEach(pos => {
    const torch = createTorch();
    torch.position.set(pos.x * CELL_SIZE, 0, pos.z * CELL_SIZE);
    mazeGroup.add(torch);
  });
  
  return mazeGroup;
}

// Collision detection
function checkCollision(newX, newZ) {
  const cellX = Math.floor((newX + MAZE_SIZE * CELL_SIZE / 2) / CELL_SIZE);
  const cellZ = Math.floor((newZ + MAZE_SIZE * CELL_SIZE / 2) / CELL_SIZE);
  
  if (cellX < 0 || cellX >= MAZE_SIZE || cellZ < 0 || cellZ >= MAZE_SIZE) {
    return true;
  }
  
  const maze = generateMaze(MAZE_SIZE);
  return maze[cellZ][cellX] === 1;
}

// Event listeners
document.addEventListener('keydown', (event) => {
  keys[event.code] = true;
});

document.addEventListener('keyup', (event) => {
  keys[event.code] = false;
});

document.addEventListener('click', () => {
  if (!isPointerLocked) {
    canvas.requestPointerLock();
  }
});

document.addEventListener('pointerlockchange', () => {
  isPointerLocked = document.pointerLockElement === canvas;
});

document.addEventListener('mousemove', (event) => {
  if (isPointerLocked) {
    player.rotation -= event.movementX * 0.002;
    camera.rotation.y = player.rotation;
  }
});

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Create skybox
function createSkybox() {
  const skyGeometry = new THREE.SphereGeometry(100, 32, 32);
  const skyMaterial = new THREE.MeshBasicMaterial({
    color: 0x87CEEB,
    side: THREE.BackSide
  });
  
  // Add cloud texture to sky
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  
  // Base sky color
  const gradient = ctx.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, '#87CEEB'); // Light blue at top
  gradient.addColorStop(1, '#E0F6FF'); // Lighter blue at bottom
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1024, 512);
  
  // Add clouds
  for (let i = 0; i < 20; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 256;
    const size = Math.random() * 100 + 50;
    const alpha = Math.random() * 0.3 + 0.2;
    
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  
  const skyTexture = new THREE.CanvasTexture(canvas);
  skyMaterial.map = skyTexture;
  
  const sky = new THREE.Mesh(skyGeometry, skyMaterial);
  return sky;
}

// Initialize the game
const maze = buildMaze();
scene.add(maze);

// Add skybox
const sky = createSkybox();
scene.add(sky);

// Add mystical particles
const particles = createMysticalParticles();
scene.add(particles);

// Add ambient light - make it much brighter
const ambientLight = new THREE.AmbientLight(0x404040, 1.2);
scene.add(ambientLight);

// Add directional light (sunlight) - make it brighter
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.8);
directionalLight.position.set(10, 20, 5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 50;
directionalLight.shadow.camera.left = -20;
directionalLight.shadow.camera.right = 20;
directionalLight.shadow.camera.top = 20;
directionalLight.shadow.camera.bottom = -20;
scene.add(directionalLight);

// Add a bright point light at the player position for testing
const playerLight = new THREE.PointLight(0xffffff, 3, 15);
playerLight.position.set(0, 2, 0);
scene.add(playerLight);

// Position player at start - ensure we're in an open area
player.position.set(0, 0, 0);
camera.position.copy(player.position);
camera.position.y = 1.6;

// Test objects removed - maze is working!

// Add wireframe helper for debugging
// const wireframeHelper = new THREE.WireframeHelper(maze, 0x00ff00);
// scene.add(wireframeHelper);

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  // Handle movement
  const moveSpeed = player.speed;
  let newX = player.position.x;
  let newZ = player.position.z;
  
  if (keys['KeyW'] || keys['ArrowUp']) {
    newX += Math.sin(player.rotation) * moveSpeed;
    newZ += Math.cos(player.rotation) * moveSpeed;
  }
  if (keys['KeyS'] || keys['ArrowDown']) {
    newX -= Math.sin(player.rotation) * moveSpeed;
    newZ -= Math.cos(player.rotation) * moveSpeed;
  }
  if (keys['KeyA'] || keys['ArrowLeft']) {
    newX += Math.sin(player.rotation - Math.PI / 2) * moveSpeed;
    newZ += Math.cos(player.rotation - Math.PI / 2) * moveSpeed;
  }
  if (keys['KeyD'] || keys['ArrowRight']) {
    newX += Math.sin(player.rotation + Math.PI / 2) * moveSpeed;
    newZ += Math.cos(player.rotation + Math.PI / 2) * moveSpeed;
  }
  
  // Check collision and update position
  if (!checkCollision(newX, player.position.z)) {
    player.position.x = newX;
  }
  if (!checkCollision(player.position.x, newZ)) {
    player.position.z = newZ;
  }
  
  // Update camera position
  camera.position.x = player.position.x;
  camera.position.z = player.position.z;
  
  // Animate particles
  particles.rotation.y += 0.001;
  
  // Animate torch flames
  maze.children.forEach(child => {
    if (child.children && child.children.length > 0) {
      child.children.forEach(torchChild => {
        if (torchChild.material && torchChild.material.color.getHex() === 0xff6600) {
          torchChild.scale.y = 1 + Math.sin(Date.now() * 0.01) * 0.2;
        }
      });
    }
  });
  
  renderer.render(scene, camera);
}

// UI Elements
const loadingElement = document.getElementById('loading');
const crosshairElement = document.getElementById('crosshair');

// Show crosshair when pointer is locked
document.addEventListener('pointerlockchange', () => {
  isPointerLocked = document.pointerLockElement === canvas;
  if (isPointerLocked) {
    crosshairElement.style.display = 'block';
    loadingElement.style.display = 'none';
  } else {
    crosshairElement.style.display = 'none';
  }
});

// Start the game
animate();

// Add instructions
const instructions = document.createElement('div');
instructions.innerHTML = `
  <div style="position: absolute; top: 20px; left: 20px; color: white; font-family: Arial; z-index: 100; background: rgba(0,0,0,0.7); padding: 20px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.2);">
    <h2 style="margin: 0 0 10px 0; color: #88ccff;">🔮 Mystical Maze</h2>
    <p style="margin: 5px 0; color: #cccccc;">Click to start • WASD/Arrow Keys to move • Mouse to look around</p>
    <p style="margin: 5px 0; color: #aaaaaa; font-size: 14px;">Find your way through the ancient stone maze...</p>
    <p style="margin: 5px 0; color: #ffaa00; font-size: 12px;">✨ Follow the torchlight to guide your path ✨</p>
  </div>
`;
document.body.appendChild(instructions);

// Hide loading screen after a short delay
setTimeout(() => {
  loadingElement.style.display = 'none';
}, 2000);