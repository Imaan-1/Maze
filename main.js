// 1. Import the Three.js library
import * as THREE from 'three';

// ------------------------------------------------------------------
// The THREE CORE ESSENTIALS you will always need.
// A scene, a camera, and a renderer.
// ------------------------------------------------------------------

// SCENE: This is like a container that holds all your objects, cameras, and lights.
const scene = new THREE.Scene();

// CAMERA: This is what the user will see. It's like your eyes in the 3D world.
// The first argument is the Field of View (how wide the camera's view is).
// The second is the Aspect Ratio (usually the browser window's width / height).
// The last two are the near and far clipping plane (what's too close or too far to be rendered).
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
// We need to move the camera back from the center so we can see the cube.
camera.position.z = 5;

// RENDERER: This does the magic of taking the scene and camera info and drawing it
// onto the canvas element in our HTML.
const canvas = document.querySelector('canvas.webgl');
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
});
// Set the size of the renderer to match our window.
renderer.setSize(window.innerWidth, window.innerHeight);

// ------------------------------------------------------------------
// Let's create our first object: a simple cube!
// ------------------------------------------------------------------

// A 3D object is called a "Mesh". A mesh needs two things:
// 1. Geometry: The shape or skeleton of the object.
// 2. Material: The "skin" or color of the object.

// GEOMETRY: Let's make a simple box. 1x1x1 units.
const geometry = new THREE.BoxGeometry(1, 1, 1);

// MATERIAL: Let's make it a basic red color.
const material = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // 0xff0000 is hex for red

// MESH: Let's combine the geometry and material into our final cube object.
const cube = new THREE.Mesh(geometry, material);

// Now, let's add our shiny new cube to the scene!
scene.add(cube);

// ------------------------------------------------------------------
// The Animation Loop
// ------------------------------------------------------------------

// To make things move, we need a loop that re-draws the scene on every screen refresh (typically 60 times per second).
function animate() {
  // Tell the browser you wish to perform an animation and requests that the browser
  // call a specified function to update an animation before the next repaint.
  requestAnimationFrame(animate);

  // Let's make our cube rotate!
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;

  // This is the most important part: render the scene from the camera's perspective.
  renderer.render(scene, camera);
}

// Kick off the animation loop!
animate();