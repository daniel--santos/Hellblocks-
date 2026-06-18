// Engine Three.js: renderer, cena, câmera isométrica (estilo Diablo II), luzes, loop.
import * as THREE from 'three';

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a0e);
    this.scene.fog = new THREE.Fog(0x0a0a0e, 30, 70);

    // Câmera isométrica fixa em ângulo (Diablo-like): olha de cima num ângulo ~50°.
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 300);
    this.camOffset = new THREE.Vector3(0, 26, 20); // altura e distância
    this.camTarget = new THREE.Vector3();

    // Luzes
    this.ambient = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(this.ambient);

    this.sun = new THREE.DirectionalLight(0xfff0d8, 1.0);
    this.sun.position.set(20, 40, 15);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const s = 40;
    this.sun.shadow.camera.left = -s;
    this.sun.shadow.camera.right = s;
    this.sun.shadow.camera.top = s;
    this.sun.shadow.camera.bottom = -s;
    this.sun.shadow.camera.far = 120;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xaaccff, 0x332211, 0.4);
    this.scene.add(this.hemi);

    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  setPalette(palette) {
    const fog = new THREE.Color(palette.fog);
    this.scene.background = fog;
    this.scene.fog.color = fog;
    this.scene.fog.near = 28;
    this.scene.fog.far = 68;
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // posiciona a câmera seguindo um alvo no chão
  follow(targetPos) {
    this.camTarget.lerp(targetPos, 0.15);
    this.camera.position.copy(this.camTarget).add(this.camOffset);
    this.camera.lookAt(this.camTarget);
    this.sun.position.copy(this.camTarget).add(new THREE.Vector3(20, 40, 15));
    this.sun.target.position.copy(this.camTarget);
  }

  // converte coords de tela (clientX/Y) para ponto no plano do chão (y=0)
  screenToGround(clientX, clientY) {
    const ndc = new THREE.Vector2(
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const out = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(this.groundPlane, out);
    return out;
  }

  // raycast contra uma lista de objetos (para hover/click em monstros, itens)
  pickObjects(clientX, clientY, objects) {
    const ndc = new THREE.Vector2(
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    return this.raycaster.intersectObjects(objects, true);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
