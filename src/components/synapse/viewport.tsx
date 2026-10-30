import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Block } from "@/lib/synapse/model";

type ViewportProps = {
  blocks: Block[];
  interactive: boolean;
  tool: "place" | "erase";
  color: string;
  onPlace: (block: Block) => void;
  onErase: (x: number, y: number, z: number) => void;
};

export function Viewport({ blocks, interactive, tool, color, onPlace, onErase }: ViewportProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const blocksRef = useRef(blocks);
  const interactiveRef = useRef(interactive);
  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const placeRef = useRef(onPlace);
  const eraseRef = useRef(onErase);
  const rebuildRef = useRef<() => void>(() => {});

  blocksRef.current = blocks;
  interactiveRef.current = interactive;
  toolRef.current = tool;
  colorRef.current = color;
  placeRef.current = onPlace;
  eraseRef.current = onErase;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.domElement.className = "block h-full w-full";
    renderer.domElement.style.touchAction = "none";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#071226");
    scene.add(new THREE.HemisphereLight("#e8f4ff", "#0b1a36", 1.15));
    const sun = new THREE.DirectionalLight("#ffffff", 1.35);
    sun.position.set(10, 16, 8);
    scene.add(sun);

    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 200);
    camera.position.set(14, 11, 14);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.2, 0);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.minDistance = 5;
    controls.maxDistance = 42;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    controls.autoRotate = !interactiveRef.current && !reduce;
    controls.autoRotateSpeed = 0.7;
    if (!interactiveRef.current) {
      controls.enablePan = false;
      controls.enableZoom = false;
    }

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(36, 36),
      new THREE.MeshStandardMaterial({ color: "#0b1a36", roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    const grid = new THREE.GridHelper(24, 24, "#1e3a5f", "#132848");
    grid.position.y = 0.01;
    scene.add(grid);

    const meshes = new THREE.Group();
    scene.add(meshes);
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const materials = new Map<string, THREE.MeshStandardMaterial>();

    const rebuild = () => {
      meshes.clear();
      for (const block of blocksRef.current) {
        let material = materials.get(block.color);
        if (!material) {
          material = new THREE.MeshStandardMaterial({
            color: block.color,
            roughness: 0.38,
            metalness: 0.06,
          });
          materials.set(block.color, material);
        }
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(block.x, block.y + 0.5, block.z);
        mesh.userData = { x: block.x, y: block.y, z: block.z };
        meshes.add(mesh);
      }
    };
    rebuildRef.current = rebuild;
    rebuild();

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downX = 0;
    let downY = 0;
    let moved = false;

    const pick = (event: PointerEvent | MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hitBlock = raycaster.intersectObjects(meshes.children, false)[0];
      const hitGround = raycaster.intersectObject(ground, false)[0];
      return { hitBlock, hitGround };
    };

    const onPointerDown = (event: PointerEvent) => {
      downX = event.clientX;
      downY = event.clientY;
      moved = false;
    };
    const onPointerMove = (event: PointerEvent) => {
      if (Math.hypot(event.clientX - downX, event.clientY - downY) > 6) moved = true;
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!interactiveRef.current || moved || event.button !== 0) return;
      const picked = pick(event);
      if (!picked) return;
      if (toolRef.current === "erase") {
        const data = picked.hitBlock?.object.userData as { x?: number; y?: number; z?: number } | undefined;
        if (data && typeof data.x === "number") eraseRef.current(data.x, data.y ?? 0, data.z ?? 0);
        return;
      }
      if (picked.hitBlock?.face) {
        const data = picked.hitBlock.object.userData as { x: number; y: number; z: number };
        const normal = picked.hitBlock.face.normal;
        placeRef.current({
          x: data.x + Math.round(normal.x),
          y: data.y + Math.round(normal.y),
          z: data.z + Math.round(normal.z),
          color: colorRef.current,
        });
        return;
      }
      if (picked.hitGround) {
        placeRef.current({
          x: Math.round(picked.hitGround.point.x),
          y: 0,
          z: Math.round(picked.hitGround.point.z),
          color: colorRef.current,
        });
      }
    };
    const onContext = (event: MouseEvent) => {
      if (!interactiveRef.current) return;
      event.preventDefault();
      const picked = pick(event);
      const data = picked?.hitBlock?.object.userData as { x?: number; y?: number; z?: number } | undefined;
      if (data && typeof data.x === "number") eraseRef.current(data.x, data.y ?? 0, data.z ?? 0);
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("contextmenu", onContext);

    const resize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (width === 0 || height === 0) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    let frame = 0;
    const loop = () => {
      frame = window.requestAnimationFrame(loop);
      controls.autoRotate = !interactiveRef.current && !reduce;
      controls.update();
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("contextmenu", onContext);
      controls.dispose();
      geometry.dispose();
      ground.geometry.dispose();
      (ground.material as THREE.Material).dispose();
      for (const material of materials.values()) material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => {
    rebuildRef.current();
  }, [blocks]);

  return <div ref={hostRef} className="h-full w-full touch-none" />;
}
