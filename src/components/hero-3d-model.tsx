import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Sparkles, Move3d } from "lucide-react";

export function Hero3DModel() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !mountRef.current) return;

    const container = mountRef.current;
    let animationFrameId: number;

    // Dimensions
    const width = container.clientWidth || 420;
    const height = container.clientHeight || 420;

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 5.2;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);

    // Group to hold all rotating elements
    const mainGroup = new THREE.Group();
    scene.add(mainGroup);

    // 1. Procedural 8K High-Detail Globe Texture Generation via Offscreen Canvas
    const createEarthTexture = () => {
      const texCanvas = document.createElement("canvas");
      texCanvas.width = 2048;
      texCanvas.height = 1024;
      const ctx = texCanvas.getContext("2d")!;

      // Deep Ocean gradient
      const oceanGrad = ctx.createLinearGradient(0, 0, 0, texCanvas.height);
      oceanGrad.addColorStop(0, "#081026");
      oceanGrad.addColorStop(0.5, "#0F1E3D");
      oceanGrad.addColorStop(1, "#081026");
      ctx.fillStyle = oceanGrad;
      ctx.fillRect(0, 0, texCanvas.width, texCanvas.height);

      // Continent Landmasses with vibrant topography highlights
      ctx.fillStyle = "#22C55E";
      ctx.shadowColor = "#4ADE80";
      ctx.shadowBlur = 12;

      // Realistic pseudo-continental clusters (Eurasia, Americas, Africa, Australia, India)
      const landPatches = [
        { x: 1250, y: 380, rx: 220, ry: 140 }, // Asia
        { x: 1320, y: 460, rx: 110, ry: 90 },  // India & South Asia
        { x: 1050, y: 380, rx: 150, ry: 130 }, // Europe
        { x: 1080, y: 550, rx: 160, ry: 190 }, // Africa
        { x: 450, y: 360, rx: 210, ry: 160 },  // North America
        { x: 600, y: 650, rx: 140, ry: 210 },  // South America
        { x: 1580, y: 700, rx: 130, ry: 110 }, // Australia
        { x: 1000, y: 920, rx: 800, ry: 70 },  // Antarctica
        { x: 1000, y: 80, rx: 600, ry: 50 },   // Arctic
      ];

      landPatches.forEach((p) => {
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2);
        ctx.fill();

        // Sub-islands / coastal noise
        for (let i = 0; i < 8; i++) {
          ctx.beginPath();
          const ox = p.x + (Math.random() - 0.5) * p.rx * 1.5;
          const oy = p.y + (Math.random() - 0.5) * p.rx * 1.5;
          ctx.arc(ox, oy, Math.random() * 28 + 8, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // City lights / Golden knowledge nodes
      ctx.shadowBlur = 8;
      ctx.shadowColor = "#FBBF24";
      ctx.fillStyle = "#FDE68A";
      for (let i = 0; i < 180; i++) {
        const lx = Math.random() * texCanvas.width;
        const ly = Math.random() * (texCanvas.height * 0.7) + texCanvas.height * 0.15;
        ctx.beginPath();
        ctx.arc(lx, ly, Math.random() * 2.5 + 1, 0, Math.PI * 2);
        ctx.fill();
      }

      // Latitude and Longitude subtle glowing coordinate grid
      ctx.strokeStyle = "rgba(147, 197, 253, 0.12)";
      ctx.lineWidth = 1;
      for (let lat = 0; lat < texCanvas.height; lat += 64) {
        ctx.beginPath();
        ctx.moveTo(0, lat);
        ctx.lineTo(texCanvas.width, lat);
        ctx.stroke();
      }
      for (let lon = 0; lon < texCanvas.width; lon += 64) {
        ctx.beginPath();
        ctx.moveTo(lon, 0);
        ctx.lineTo(lon, texCanvas.height);
        ctx.stroke();
      }

      const texture = new THREE.CanvasTexture(texCanvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      return texture;
    };

    // 2. Primary 8K Earth Core Sphere
    const earthTexture = createEarthTexture();
    const globeGeo = new THREE.SphereGeometry(1.6, 64, 64);
    const globeMat = new THREE.MeshStandardMaterial({
      map: earthTexture,
      roughness: 0.35,
      metalness: 0.25,
      bumpScale: 0.05,
    });
    const globeMesh = new THREE.Mesh(globeGeo, globeMat);
    mainGroup.add(globeMesh);

    // 3. Glowing Atmospheric Shell (Clouds & Aura)
    const createCloudTexture = () => {
      const cCanvas = document.createElement("canvas");
      cCanvas.width = 1024;
      cCanvas.height = 512;
      const cctx = cCanvas.getContext("2d")!;
      cctx.fillStyle = "rgba(0,0,0,0)";
      cctx.fillRect(0, 0, 1024, 512);

      cctx.fillStyle = "rgba(255, 255, 255, 0.65)";
      cctx.shadowColor = "rgba(255,255,255,0.8)";
      cctx.shadowBlur = 15;

      for (let i = 0; i < 45; i++) {
        cctx.beginPath();
        const cx = Math.random() * 1024;
        const cy = Math.random() * 512;
        cctx.ellipse(cx, cy, Math.random() * 90 + 30, Math.random() * 30 + 10, Math.random() * Math.PI, 0, Math.PI * 2);
        cctx.fill();
      }

      const ct = new THREE.CanvasTexture(cCanvas);
      ct.wrapS = THREE.RepeatWrapping;
      return ct;
    };

    const cloudMat = new THREE.MeshStandardMaterial({
      map: createCloudTexture(),
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const cloudMesh = new THREE.Mesh(new THREE.SphereGeometry(1.64, 48, 48), cloudMat);
    mainGroup.add(cloudMesh);

    // 4. Futuristic Orbiting Armillary Ring 1 (Gold)
    const ringGeo1 = new THREE.TorusGeometry(2.15, 0.02, 16, 120);
    const ringMat1 = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.9,
      roughness: 0.15,
      emissive: 0xd97706,
      emissiveIntensity: 0.5,
    });
    const ringMesh1 = new THREE.Mesh(ringGeo1, ringMat1);
    ringMesh1.rotation.x = Math.PI / 3;
    ringMesh1.rotation.y = Math.PI / 6;
    mainGroup.add(ringMesh1);

    // 5. Orbiting Armillary Ring 2 (Cyan/Purple Neon)
    const ringGeo2 = new THREE.TorusGeometry(2.35, 0.015, 16, 120);
    const ringMat2 = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      metalness: 0.85,
      roughness: 0.2,
      emissive: 0x0284c7,
      emissiveIntensity: 0.6,
    });
    const ringMesh2 = new THREE.Mesh(ringGeo2, ringMat2);
    ringMesh2.rotation.x = -Math.PI / 4;
    ringMesh2.rotation.z = Math.PI / 5;
    mainGroup.add(ringMesh2);

    // 6. Orbiting Satellites / Knowledge Nodes
    const satelliteGroup = new THREE.Group();
    mainGroup.add(satelliteGroup);

    const satGeo = new THREE.SphereGeometry(0.09, 24, 24);
    const satMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x38bdf8,
      emissiveIntensity: 1.5,
      roughness: 0.1,
    });

    const sat1 = new THREE.Mesh(satGeo, satMat);
    const sat2 = new THREE.Mesh(satGeo, new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.4,
    }));
    satelliteGroup.add(sat1);
    satelliteGroup.add(sat2);

    // 7. Ambient Stardust Sparkles Field
    const particleCount = 280;
    const posArray = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      posArray[i] = (Math.random() - 0.5) * 9;
      posArray[i + 1] = (Math.random() - 0.5) * 9;
      posArray[i + 2] = (Math.random() - 0.5) * 9;
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute("position", new THREE.BufferAttribute(posArray, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.035,
      color: 0xa78bfa,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    // 8. Lighting System (Sunlight + Rim Neon + Ambient)
    const ambientLight = new THREE.AmbientLight(0x334155, 1.8);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 2.5);
    sunLight.position.set(5, 3, 5);
    scene.add(sunLight);

    const rimLight = new THREE.PointLight(0x6366f1, 3.5, 12);
    rimLight.position.set(-4, -2, -3);
    scene.add(rimLight);

    const goldLight = new THREE.PointLight(0xf59e0b, 2.2, 10);
    goldLight.position.set(0, 4, 2);
    scene.add(goldLight);

    // State for interactive manipulation
    let mouseX = 0;
    let mouseY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;

    let isDragging = false;
    let prevPointerX = 0;
    let prevPointerY = 0;
    let dragVelocityX = 0;
    let dragVelocityY = 0;

    let scrollRotation = 0;

    // Mouse tilt tracking
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      targetMouseX = x * 0.5;
      targetMouseY = y * 0.35;
    };

    // Scroll tracking
    const handleScroll = () => {
      scrollRotation = window.scrollY * 0.0035;
    };

    // Pointer drag rotation (Touch + Mouse)
    const handlePointerDown = (e: PointerEvent) => {
      isDragging = true;
      setIsInteracting(true);
      prevPointerX = e.clientX;
      prevPointerY = e.clientY;
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevPointerX;
      const deltaY = e.clientY - prevPointerY;
      prevPointerX = e.clientX;
      prevPointerY = e.clientY;

      dragVelocityX += deltaX * 0.005;
      dragVelocityY += deltaY * 0.005;
    };

    const handlePointerUp = () => {
      isDragging = false;
      setTimeout(() => setIsInteracting(false), 800);
    };

    // Window resize
    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);
    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    // Animation Loop
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Smooth inertia and friction
      dragVelocityX *= 0.94;
      dragVelocityY *= 0.94;

      // Smooth mouse follow
      mouseX += (targetMouseX - mouseX) * 0.05;
      mouseY += (targetMouseY - mouseY) * 0.05;

      // Base continuous rotation + drag + scroll
      globeMesh.rotation.y += 0.004 + dragVelocityX;
      globeMesh.rotation.x += dragVelocityY;
      cloudMesh.rotation.y += 0.0055 + dragVelocityX;

      // Scroll reactive rotation
      mainGroup.rotation.y = scrollRotation + mouseX * 0.8;
      mainGroup.rotation.x = Math.sin(scrollRotation * 0.5) * 0.15 + mouseY * 0.6;

      // Floating breathing hover effect
      mainGroup.position.y = Math.sin(elapsedTime * 1.6) * 0.12;

      // Animate Armillary Rings
      ringMesh1.rotation.z += 0.006;
      ringMesh2.rotation.z -= 0.008;

      // Satellites orbital positions
      const satAngle1 = elapsedTime * 1.3;
      sat1.position.set(
        Math.cos(satAngle1) * 2.15,
        Math.sin(satAngle1 * 0.8) * 0.7,
        Math.sin(satAngle1) * 2.15
      );

      const satAngle2 = -elapsedTime * 0.9 + 2;
      sat2.position.set(
        Math.sin(satAngle2) * 2.35,
        Math.cos(satAngle2 * 1.1) * 0.8,
        Math.cos(satAngle2) * 2.35
      );

      // Particle subtle drifting
      particleSystem.rotation.y = elapsedTime * 0.02;
      particleSystem.rotation.x = Math.sin(elapsedTime * 0.015) * 0.1;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);

      // Clean up resources
      globeGeo.dispose();
      globeMat.dispose();
      cloudMesh.geometry.dispose();
      cloudMat.dispose();
      ringGeo1.dispose();
      ringMat1.dispose();
      ringGeo2.dispose();
      ringMat2.dispose();
      satGeo.dispose();
      satMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      earthTexture.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [mounted]);

  return (
    <div className="relative flex items-center justify-center select-none">
      {/* Outer ambient glow backlight */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-primary/30 via-sky-500/20 to-purple-600/30 blur-3xl scale-95 pointer-events-none animate-pulse" />

      {/* Floating Status / Interactive badges */}
      <div className="absolute -top-4 -left-6 z-20 hidden sm:flex items-center gap-2 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md px-3.5 py-1.5 rounded-full shadow-lg border border-slate-200/80 text-xs font-semibold text-slate-800">
        <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
        <span>8K Realistic 3D Core</span>
      </div>

      <div className="absolute -bottom-4 right-0 z-20 flex items-center gap-1.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-3 py-1 rounded-full shadow-md border border-slate-200/80 text-[11px] text-slate-600">
        <Move3d className="w-3 h-3 text-primary animate-spin" />
        <span>{isInteracting ? "Interactive 3D Active" : "Scroll & Drag to Rotate"}</span>
      </div>

      {/* Three.js Canvas Container */}
      <div
        ref={mountRef}
        className="w-[320px] h-[320px] sm:w-[420px] sm:h-[420px] lg:w-[460px] lg:h-[460px] cursor-grab active:cursor-grabbing relative z-10 flex items-center justify-center transition-transform hover:scale-[1.02]"
        title="Interactive 3D Model: Drag or Scroll to rotate"
      />
    </div>
  );
}
