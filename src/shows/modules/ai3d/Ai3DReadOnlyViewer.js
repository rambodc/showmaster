import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef } from 'firebase/storage';
import { db, storage } from '../../../firebase';

const toNumber = (value, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const buildAssetLoadError = (err) => {
  const raw = String(err?.message || err || '').toLowerCase();
  if (raw.includes('cors') || raw.includes('access-control-allow-origin')) {
    return 'Some assets could not load due to Storage CORS configuration for this site domain.';
  }
  return 'Some assets could not be loaded in preview mode.';
};

export default function Ai3DReadOnlyViewer({ showId, height = 360 }) {
  const canvasRef = useRef(null);
  const initialViewRef = useRef({
    position: new THREE.Vector3(6, 5, 9),
    target: new THREE.Vector3(0, 0.5, 0),
  });
  const sceneRef = useRef(null);
  const groupRef = useRef(null);
  const groundRef = useRef(null);
  const gridRef = useRef(null);
  const ambientRef = useRef(null);
  const keyLightRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const meshMapRef = useRef(new Map());
  const textureLoaderRef = useRef(new THREE.TextureLoader());
  const gltfLoaderRef = useRef(new GLTFLoader());
  const detailCacheRef = useRef(new Map());
  const detailLoadingRef = useRef(new Set());
  const lastSizeRef = useRef({ width: 0, height: 0 });

  const [objects, setObjects] = useState([]);
  const [sceneForm, setSceneForm] = useState({
    floorWidth: 30,
    floorDepth: 30,
    floorColor: '#f8fafc',
    floorTextureUrl: '',
    ambientIntensity: 1.1,
    keyIntensity: 1.2,
    keyX: 6,
    keyY: 10,
    keyZ: 6,
  });
  const [error, setError] = useState('');

  const objectsCollection = useMemo(
    () => (showId ? collection(db, 'shows', showId, 'modules', 'ai3d', 'objects') : null),
    [showId]
  );
  const sceneSettingsRef = useMemo(
    () => (showId ? doc(db, 'shows', showId, 'modules', 'ai3d', 'scene', 'settings') : null),
    [showId]
  );

  useEffect(() => {
    const loader = textureLoaderRef.current;
    loader.crossOrigin = 'anonymous';
    const gltfLoader = gltfLoaderRef.current;
    if (typeof gltfLoader.setCrossOrigin === 'function') gltfLoader.setCrossOrigin('anonymous');
  }, []);

  useEffect(() => {
    if (!objectsCollection) return undefined;
    const unsub = onSnapshot(
      objectsCollection,
      (snap) => {
        const next = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        setObjects(next);
      },
      (err) => setError(err?.message || 'Unable to load scene objects.')
    );
    return () => unsub();
  }, [objectsCollection]);

  useEffect(() => {
    if (!sceneSettingsRef) return undefined;
    const unsub = onSnapshot(sceneSettingsRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() || {};
      setSceneForm((prev) => ({
        ...prev,
        floorWidth: toNumber(data.floorWidth ?? data.floorSize, prev.floorWidth),
        floorDepth: toNumber(data.floorDepth ?? data.floorSize, prev.floorDepth),
        floorColor: data.floorColor || prev.floorColor,
        floorTextureUrl: data.floorTextureUrl || '',
        ambientIntensity: toNumber(data.ambientIntensity, prev.ambientIntensity),
        keyIntensity: toNumber(data.keyIntensity, prev.keyIntensity),
        keyX: toNumber(data.keyX, prev.keyX),
        keyY: toNumber(data.keyY, prev.keyY),
        keyZ: toNumber(data.keyZ, prev.keyZ),
      }));
    });
    return () => unsub();
  }, [sceneSettingsRef]);

  useEffect(() => {
    if (!canvasRef.current || !showId) return undefined;

    const container = canvasRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#e2e8f0');

    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 300);
    camera.position.set(6, 5, 9);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 1.1);
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(6, 10, 6);
    keyLight.castShadow = true;
    scene.add(ambient, keyLight);

    const grid = new THREE.GridHelper(20, 20, 0x94a3b8, 0xcbd5f5);
    scene.add(grid);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.02, roughness: 0.95 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const objectGroup = new THREE.Group();
    scene.add(objectGroup);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.2;
    controls.maxDistance = 120;
    controls.maxPolarAngle = Math.PI * 0.499;
    controls.minPolarAngle = 0.02;
    controls.target.set(0, 0.5, 0);
    controls.update();
    initialViewRef.current.position.copy(camera.position);
    initialViewRef.current.target.copy(controls.target);

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const heightPx = Math.max(1, Math.floor(rect.height));
      if (width === lastSizeRef.current.width && heightPx === lastSizeRef.current.height) return;
      lastSizeRef.current = { width, height: heightPx };
      renderer.setSize(width, heightPx, false);
      camera.aspect = width / heightPx;
      camera.updateProjectionMatrix();
    };

    resize();

    let frame = 0;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(animate);
    };
    animate();

    let resizeObserver;
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);
    } else {
      window.addEventListener('resize', resize);
    }

    sceneRef.current = scene;
    groupRef.current = objectGroup;
    groundRef.current = ground;
    gridRef.current = grid;
    ambientRef.current = ambient;
    keyLightRef.current = keyLight;
    rendererRef.current = renderer;
    cameraRef.current = camera;
    controlsRef.current = controls;

    return () => {
      window.cancelAnimationFrame(frame);
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('resize', resize);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      meshMapRef.current.forEach((mesh) => {
        mesh.geometry.dispose();
        if (mesh.material?.map) mesh.material.map.dispose();
        if (mesh.material?.dispose) mesh.material.dispose();
      });
      meshMapRef.current.clear();
      detailCacheRef.current.forEach((entry) => {
        if (entry.group.parent) entry.group.parent.remove(entry.group);
        entry.group.traverse((child) => {
          if (!child.isMesh) return;
          child.geometry.dispose();
          if (child.material?.map) child.material.map.dispose();
          if (child.material?.dispose) child.material.dispose();
        });
      });
      detailCacheRef.current.clear();
      detailLoadingRef.current.clear();
      sceneRef.current = null;
      groupRef.current = null;
      groundRef.current = null;
      gridRef.current = null;
      ambientRef.current = null;
      keyLightRef.current = null;
      rendererRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
    };
  }, [showId]);

  const resetView = () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    camera.position.copy(initialViewRef.current.position);
    controls.target.copy(initialViewRef.current.target);
    controls.update();
  };

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const setProxyVisibility = (mesh, visible) => {
      if (!mesh?.material) return;
      mesh.visible = true;
      mesh.material.transparent = true;
      mesh.material.depthWrite = visible;
      mesh.material.opacity = visible ? 1 : 0;
      mesh.material.needsUpdate = true;
    };

    const applyDetailTransform = (detailGroup, mesh) => {
      if (!detailGroup || !mesh?.geometry) return;
      const detailBox = new THREE.Box3().setFromObject(detailGroup);
      const detailSize = detailBox.getSize(new THREE.Vector3());
      const detailCenter = detailBox.getCenter(new THREE.Vector3());
      const base = mesh.userData.baseDimensions || { x: 1, y: 1, z: 1 };
      const safe = (value) => (Number.isFinite(value) && value > 0.001 ? value : 0.001);
      const sx = base.x / safe(detailSize.x);
      const sy = base.y / safe(detailSize.y);
      const sz = base.z / safe(detailSize.z);
      detailGroup.scale.set(sx, sy, sz);
      detailGroup.position.set(-detailCenter.x * sx, -detailCenter.y * sy, -detailCenter.z * sz);
      detailGroup.rotation.set(0, 0, 0);
    };

    const meshMap = meshMapRef.current;
    const incomingIds = new Set(objects.map((obj) => obj.id));

    meshMap.forEach((mesh, id) => {
      if (incomingIds.has(id)) return;
      const detail = detailCacheRef.current.get(id);
      if (detail) {
        if (detail.group.parent) detail.group.parent.remove(detail.group);
        detail.group.traverse((child) => {
          if (!child.isMesh) return;
          child.geometry.dispose();
          if (child.material?.map) child.material.map.dispose();
          if (child.material?.dispose) child.material.dispose();
        });
        detailCacheRef.current.delete(id);
      }
      group.remove(mesh);
      mesh.geometry.dispose();
      if (mesh.material?.map) mesh.material.map.dispose();
      if (mesh.material?.dispose) mesh.material.dispose();
      meshMap.delete(id);
    });

    objects.forEach((obj) => {
      const dimensions = obj.dimensions || {};
      const width = Math.max(0.1, toNumber(dimensions.x, 1));
      const heightPx = Math.max(0.1, toNumber(dimensions.y, 1));
      const depth = Math.max(0.1, toNumber(dimensions.z, 1));
      const position = obj.position || {};
      const rotation = obj.rotation || {};
      const color = obj.color || '#d1d5db';
      const textureUrl = obj.textureUrl || '';
      const dimsKey = `${width}_${heightPx}_${depth}`;

      let mesh = meshMap.get(obj.id);
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(width, heightPx, depth),
          new THREE.MeshStandardMaterial({ color })
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.objectId = obj.id;
        meshMap.set(obj.id, mesh);
        group.add(mesh);
      } else if (mesh.userData.dimensions !== dimsKey) {
        mesh.geometry.dispose();
        mesh.geometry = new THREE.BoxGeometry(width, heightPx, depth);
      }

      mesh.userData.dimensions = dimsKey;
      mesh.userData.baseDimensions = { x: width, y: heightPx, z: depth };
      mesh.position.set(
        toNumber(position.x, 0),
        toNumber(position.y, heightPx / 2),
        toNumber(position.z, 0)
      );
      mesh.rotation.set(
        toNumber(rotation.x, 0),
        toNumber(rotation.y, 0),
        toNumber(rotation.z, 0)
      );

      if (mesh.material?.color) mesh.material.color.set(color);

      if (textureUrl && mesh.userData.textureUrl !== textureUrl) {
        const previous = mesh.material.map;
        textureLoaderRef.current.load(
          textureUrl,
          (texture) => {
            if (mesh.userData.textureUrl !== textureUrl) {
              texture.dispose();
              return;
            }
            mesh.material.map = texture;
            mesh.material.needsUpdate = true;
            if (previous) previous.dispose();
          },
          undefined,
          (err) => {
            setError(buildAssetLoadError(err));
            if (mesh.userData.textureUrl === textureUrl) {
              mesh.material.map = null;
              mesh.material.needsUpdate = true;
            }
          }
        );
      }
      if (!textureUrl && mesh.material.map) {
        mesh.material.map.dispose();
        mesh.material.map = null;
        mesh.material.needsUpdate = true;
      }
      mesh.userData.textureUrl = textureUrl;

      const hasDetail = Boolean(obj.detailModelPath);
      const cached = detailCacheRef.current.get(obj.id);
      if (!hasDetail) {
        if (cached) {
          if (cached.group.parent) cached.group.parent.remove(cached.group);
          cached.group.traverse((child) => {
            if (!child.isMesh) return;
            child.geometry.dispose();
            if (child.material?.map) child.material.map.dispose();
            if (child.material?.dispose) child.material.dispose();
          });
          detailCacheRef.current.delete(obj.id);
        }
        setProxyVisibility(mesh, true);
        return;
      }

      if (cached) {
        applyDetailTransform(cached.group, mesh);
        setProxyVisibility(mesh, false);
        return;
      }
      if (detailLoadingRef.current.has(obj.id)) return;

      detailLoadingRef.current.add(obj.id);
      getDownloadURL(storageRef(storage, obj.detailModelPath))
        .then((url) => new Promise((resolve, reject) => {
          gltfLoaderRef.current.load(url, resolve, undefined, reject);
        }))
        .then((gltf) => {
          const detailGroup = gltf.scene || gltf.scenes?.[0];
          if (!detailGroup) return;
          detailGroup.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          mesh.add(detailGroup);
          applyDetailTransform(detailGroup, mesh);
          detailCacheRef.current.set(obj.id, { group: detailGroup });
          setProxyVisibility(mesh, false);
        })
        .catch((err) => {
          setProxyVisibility(mesh, true);
          setError(buildAssetLoadError(err));
        })
        .finally(() => {
          detailLoadingRef.current.delete(obj.id);
        });
    });
  }, [objects]);

  useEffect(() => {
    const ground = groundRef.current;
    const grid = gridRef.current;
    const ambient = ambientRef.current;
    const key = keyLightRef.current;
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    if (!ground || !grid || !ambient || !key || !controls || !camera) return;

    const width = Math.max(10, toNumber(sceneForm.floorWidth, 30));
    const depth = Math.max(10, toNumber(sceneForm.floorDepth, 30));
    const size = Math.max(width, depth);

    ground.geometry.dispose();
    ground.geometry = new THREE.PlaneGeometry(width, depth);
    ground.material.color.set(sceneForm.floorColor || '#f8fafc');

    if (sceneForm.floorTextureUrl) {
      textureLoaderRef.current.load(
        sceneForm.floorTextureUrl,
        (texture) => {
          texture.wrapS = THREE.ClampToEdgeWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;
          texture.repeat.set(1, 1);
          ground.material.map = texture;
          ground.material.needsUpdate = true;
        },
        undefined,
        (err) => {
          setError(buildAssetLoadError(err));
          ground.material.map = null;
          ground.material.needsUpdate = true;
        }
      );
    } else if (ground.material.map) {
      ground.material.map.dispose();
      ground.material.map = null;
      ground.material.needsUpdate = true;
    }

    grid.geometry.dispose();
    grid.geometry = new THREE.GridHelper(size, Math.round(size / 2)).geometry;

    ambient.intensity = toNumber(sceneForm.ambientIntensity, 1.1);
    key.intensity = toNumber(sceneForm.keyIntensity, 1.2);
    key.position.set(
      toNumber(sceneForm.keyX, 6),
      toNumber(sceneForm.keyY, 10),
      toNumber(sceneForm.keyZ, 6)
    );

    controls.maxDistance = Math.max(40, size * 4);
    camera.far = Math.max(300, size * 10);
    camera.updateProjectionMatrix();
  }, [sceneForm]);

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={resetView}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 2,
            borderRadius: 8,
            border: '1px solid #bae6fd',
            background: 'rgba(240, 249, 255, 0.92)',
            color: '#075985',
            fontWeight: 700,
            fontSize: 12,
            padding: '4px 9px',
            cursor: 'pointer',
          }}
        >
          Reset
        </button>
        <div ref={canvasRef} style={{ width: '100%', height, borderRadius: 14, overflow: 'hidden' }} />
      </div>
      {error ? <p className="info-note" style={{ marginTop: 8 }}>{error}</p> : null}
    </div>
  );
}
