import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Look } from "@/lib/synapse/look";
import type { Block } from "@/lib/synapse/model";
import { materialById, paintMaterial } from "@/lib/synapse/materials";

type Mode = "walk" | "soccer" | "disaster";

export function PlayWorld({
  blocks,
  look,
  mode,
  onExit,
}: {
  blocks: Block[];
  look: Look;
  mode: Mode;
  onExit: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#102033");
    scene.add(new THREE.HemisphereLight("#fff4e0", "#1c3a28", 1.2));
    const sun = new THREE.DirectionalLight("#ffffff", 1.4);
    sun.position.set(12, 20, 8);
    scene.add(sun);

    const groundColor = mode === "soccer" ? "#1f7a3a" : mode === "disaster" ? "#5c5346" : "#1a3050";
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 50),
      new THREE.MeshStandardMaterial({ color: groundColor, roughness: 0.9 }),
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const cache = new Map<string, THREE.MeshStandardMaterial>();
    for (const block of blocks) {
      const spec = materialById(block.material);
      let material = cache.get(block.material ?? block.color);
      if (!material) {
        const map = spec ? new THREE.CanvasTexture(paintMaterial(spec, 32)) : undefined;
        if (map) map.colorSpace = THREE.SRGBColorSpace;
        material = new THREE.MeshStandardMaterial({
          color: spec ? "#ffffff" : block.color,
          map,
          roughness: 0.7,
        });
        cache.set(block.material ?? block.color, material);
      }
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(block.x, block.y + 0.5, block.z);
      scene.add(mesh);
    }

    const avatar = makeAvatar(look);
    avatar.position.set(0, 0, 8);
    scene.add(avatar);

    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 24, 16),
      new THREE.MeshStandardMaterial({ color: "#f4f4f4", roughness: 0.45 }),
    );
    ball.position.set(0, 0.35, 0);
    if (mode === "soccer") scene.add(ball);

    const debris: THREE.Mesh[] = [];
    if (mode === "disaster") {
      for (let i = 0; i < 12; i += 1) {
        const rock = new THREE.Mesh(
          new THREE.SphereGeometry(0.35 + (i % 3) * 0.15, 12, 10),
          new THREE.MeshStandardMaterial({ color: i % 2 ? "#6b6258" : "#8d4b2a", roughness: 0.9 }),
        );
        rock.position.set((i - 6) * 2, 12 + (i % 4), -4 + (i % 5));
        scene.add(rock);
        debris.push(rock);
      }
    }

    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
    const keys = new Set<string>();
    const onKey = (event: KeyboardEvent) => {
      if (event.type === "keydown") keys.add(event.key.toLowerCase());
      else keys.delete(event.key.toLowerCase());
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);

    const vel = new THREE.Vector3();
    let kick = 0;
    const onPointer = () => {
      kick = 0.28;
    };
    renderer.domElement.addEventListener("pointerdown", onPointer);

    let frame = 0;
    const clock = new THREE.Clock();
    const resize = () => {
      const width = host.clientWidth || 1;
      const height = host.clientHeight || 1;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const tick = () => {
      frame = window.requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.05);
      const dir = new THREE.Vector3(
        (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0),
        0,
        (keys.has("s") || keys.has("arrowdown") ? 1 : 0) - (keys.has("w") || keys.has("arrowup") ? 1 : 0),
      );
      if (dir.lengthSq() > 0) {
        dir.normalize();
        avatar.position.addScaledVector(dir, 7 * dt);
        avatar.rotation.y = Math.atan2(dir.x, dir.z);
      }
      avatar.position.x = THREE.MathUtils.clamp(avatar.position.x, -24, 24);
      avatar.position.z = THREE.MathUtils.clamp(avatar.position.z, -16, 16);
      if (mode === "soccer") {
        if (kick > 0) {
          const away = ball.position.clone().sub(avatar.position);
          away.y = 0;
          if (away.length() < 1.4) {
            away.normalize();
            vel.add(away.multiplyScalar(kick * 18));
          }
          kick = 0;
        }
        vel.y -= 12 * dt;
        ball.position.addScaledVector(vel, dt);
        if (ball.position.y < 0.35) {
          ball.position.y = 0.35;
          vel.y = Math.abs(vel.y) * 0.35;
        }
        vel.multiplyScalar(0.985);
        ball.position.x = THREE.MathUtils.clamp(ball.position.x, -18, 18);
        ball.position.z = THREE.MathUtils.clamp(ball.position.z, -11, 11);
      }
      if (mode === "disaster") {
        for (const rock of debris) {
          rock.position.y -= (3 + (rock.position.x % 2)) * dt;
          if (rock.position.y < 0.4) rock.position.y = 14;
          const dx = rock.position.x - avatar.position.x;
          const dz = rock.position.z - avatar.position.z;
          if (rock.position.y < 1.2 && dx * dx + dz * dz < 0.8) {
            avatar.position.z = 12;
          }
        }
      }
      camera.position.set(avatar.position.x, avatar.position.y + 4.2, avatar.position.z + 7.5);
      camera.lookAt(avatar.position.x, 1.2, avatar.position.z);
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      renderer.domElement.removeEventListener("pointerdown", onPointer);
      geometry.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [blocks, look, mode]);

  return (
    <div className="relative h-full min-h-[70dvh] bg-ink">
      <div ref={hostRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute top-3 left-3 right-3 flex items-start justify-between gap-3">
        <p className="rounded-xl bg-navy/80 px-3 py-2 text-xs text-frost">
          WASD to move. Click to kick. Dodge falling debris in Storm Run.
        </p>
        <button
          type="button"
          className="pointer-events-auto h-10 rounded-xl bg-ice px-3 text-sm font-semibold text-ink"
          onClick={onExit}
        >
          Leave
        </button>
      </div>
    </div>
  );
}

function makeAvatar(look: Look) {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: look.skin, roughness: 0.55 });
  const shirt = new THREE.MeshStandardMaterial({ color: look.shirt, roughness: 0.6 });
  const pants = new THREE.MeshStandardMaterial({ color: look.pants, roughness: 0.7 });
  const shoes = new THREE.MeshStandardMaterial({ color: look.shoes, roughness: 0.45 });
  const hair = new THREE.MeshStandardMaterial({ color: look.hair, roughness: 0.7 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.46, 4, 16), shirt);
  torso.position.y = 1.05;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 18), skin);
  head.position.y = 1.62;
  group.add(head);
  const hairMesh = new THREE.Mesh(
    new THREE.SphereGeometry(look.hairStyle === "long" ? 0.32 : 0.26, 20, 14, 0, Math.PI * 2, 0, Math.PI / 1.6),
    hair,
  );
  hairMesh.position.y = look.hairStyle === "spiky" ? 1.82 : 1.72;
  hairMesh.scale.set(1, look.hairStyle === "spiky" ? 1.25 : 0.7, 1);
  group.add(hairMesh);
  const armGeo = new THREE.CapsuleGeometry(0.08, 0.36, 3, 10);
  const left = new THREE.Mesh(armGeo, skin);
  left.position.set(-0.4, 1.05, 0);
  const right = new THREE.Mesh(armGeo, skin);
  right.position.set(0.4, 1.05, 0);
  group.add(left, right);
  const legGeo = new THREE.CapsuleGeometry(0.1, 0.38, 3, 10);
  const legL = new THREE.Mesh(legGeo, pants);
  legL.position.set(-0.14, 0.46, 0);
  const legR = new THREE.Mesh(legGeo, pants);
  legR.position.set(0.14, 0.46, 0);
  group.add(legL, legR);
  const shoeGeo = new THREE.SphereGeometry(0.1, 12, 8);
  const shoeL = new THREE.Mesh(shoeGeo, shoes);
  shoeL.scale.set(1.2, 0.6, 1.6);
  shoeL.position.set(-0.14, 0.12, 0.04);
  const shoeR = shoeL.clone();
  shoeR.position.x = 0.14;
  group.add(shoeL, shoeR);
  return group;
}
