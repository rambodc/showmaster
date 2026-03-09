// src/ai-3d-model/Ai3DModel.js
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { addDoc, collection, deleteDoc, deleteField, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, getMetadata, list, ref as storageRef, uploadBytesResumable } from 'firebase/storage';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowUp, FiArrowRight, FiArrowDown, FiArrowLeft, FiMaximize2, FiMousePointer, FiMap, FiNavigation, FiMove, FiRotateCw, FiMoreHorizontal, FiCornerUpLeft, FiCornerUpRight } from 'react-icons/fi';
import styles from './Ai3DModel.module.css';
import { db, storage } from '../../../firebase';
import { UserContext } from '../../../App';



const buildDefaultForm = () => ({
  label: '',
  width: 2,
  height: 1,
  depth: 2,
  posX: 0,
  posZ: 0,
  rotationY: 0,
  textureUrl: '',
  color: '#d1d5db',
  detailModelPath: '',
  loadOnStart: false,
  frozen: false,
});

const buildDefaultScene = () => ({
  floorWidth: 30,
  floorDepth: 30,
  floorColor: '#f8fafc',
  floorTextureUrl: '',
  ambientIntensity: 1.1,
  keyIntensity: 1.2,
  keyX: 6,
  keyY: 10,
  keyZ: 6,
  unit: 'm',
});

const toNumber = (value, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const formatNumber = (value) => {
  if (!Number.isFinite(value)) return '0';
  return Number(value).toFixed(2);
};

const buildAssetLoadErrorMessage = (error, assetRef = 'asset') => {
  const raw = String(error?.message || error || '').toLowerCase();
  if (raw.includes('cors') || raw.includes('access-control-allow-origin')) {
    return `Unable to load ${assetRef}. Storage CORS is blocking this domain.`;
  }
  return `Unable to load ${assetRef}.`;
};

const buildSummary = (obj) => ({
  id: obj.id,
  label: obj.label || '',
  type: obj.type || 'box',
  size: [
    toNumber(obj.dimensions?.x, 1),
    toNumber(obj.dimensions?.y, 1),
    toNumber(obj.dimensions?.z, 1),
  ],
  pos: [
    toNumber(obj.position?.x, 0),
    toNumber(obj.position?.y, 0),
    toNumber(obj.position?.z, 0),
  ],
  rotY: toNumber(obj.rotation?.y, 0),
  color: obj.color || '',
  textureUrl: obj.textureUrl || '',
});

export default function Ai3DModel() {
  const { showId } = useParams();
  const navigate = useNavigate();
  const appUser = useContext(UserContext);
  const canvasRef = useRef(null);
  const lastSizeRef = useRef({ width: 0, height: 0 });
  const meshMapRef = useRef(new Map());
  const sceneRef = useRef(null);
  const objectsRef = useRef([]);
  const groupRef = useRef(null);
  const groundRef = useRef(null);
  const gridRef = useRef(null);
  const ambientRef = useRef(null);
  const keyLightRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const transformRef = useRef(null);
  const transformHelperRef = useRef(null);
  const selectionBoxRef = useRef(null);
  const textureLoaderRef = useRef(new THREE.TextureLoader());
  const gltfLoaderRef = useRef(new GLTFLoader());
  const summaryTimerRef = useRef(null);
  const viewModeRef = useRef('select');
  const transformModeRef = useRef('translate');
  const unitLabelRef = useRef('m');
  const detailCacheRef = useRef(new Map());
  const detailOrderRef = useRef([]);
  const detailLoadingRef = useRef(new Set());
  const walkInputRef = useRef({ x: 0, z: 0 });
  const walkVelocityRef = useRef(new THREE.Vector3());
  const walkSpeedRef = useRef(5);
  const walkSpeedMultiplierRef = useRef(3);
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const isApplyingHistoryRef = useRef(false);
  const flyRef = useRef({
    active: false,
    start: 0,
    duration: 1200,
    fromPos: new THREE.Vector3(),
    toPos: new THREE.Vector3(),
    fromTarget: new THREE.Vector3(),
    toTarget: new THREE.Vector3(),
    autoSpinAfter: false,
  });
  const heightTweenRef = useRef({
    active: false,
    start: 0,
    duration: 450,
    fromY: 0,
    toY: 0,
  });

  const [objects, setObjects] = useState([]);
  const [form, setForm] = useState(buildDefaultForm);
  const [selectedId, setSelectedId] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState('create');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [autoSpin, setAutoSpin] = useState(false);
  const [viewMode, setViewMode] = useState('select');
  const [sceneForm, setSceneForm] = useState(buildDefaultScene);
  const [transformMode, setTransformMode] = useState('translate');
  const [scalePreview, setScalePreview] = useState('');
  const [walkSpeed, setWalkSpeed] = useState(5);
  const [assetPanelOpen, setAssetPanelOpen] = useState(false);
  const [assetKind, setAssetKind] = useState('model');
  const [assetTarget, setAssetTarget] = useState('object-model');
  const [assetSearch, setAssetSearch] = useState('');
  const [assetName, setAssetName] = useState('');
  const [assetFile, setAssetFile] = useState(null);
  const [assetItems, setAssetItems] = useState([]);
  const [assetLoading, setAssetLoading] = useState(false);
  const [assetReturnMode, setAssetReturnMode] = useState('create');
  const [menuOpen, setMenuOpen] = useState(false);
  const [historyTick, setHistoryTick] = useState(0);
  const undoDisabled = !undoStackRef.current.length || historyTick < 0;
  const redoDisabled = !redoStackRef.current.length || historyTick < 0;
  const [walkHeightLevel, setWalkHeightLevel] = useState(2);
  const [flyHeightLevel, setFlyHeightLevel] = useState(2);
  const unitLabel = sceneForm.unit === 'ft' ? 'ft' : 'm';

  const objectsCollection = useMemo(
    () => (showId ? collection(db, 'shows', showId, 'modules', 'ai3d', 'objects') : null),
    [showId]
  );
  const sceneDocRef = useMemo(
    () => (showId ? doc(db, 'shows', showId, 'modules', 'ai3d') : null),
    [showId]
  );
  const sceneSettingsRef = useMemo(
    () => (showId ? doc(db, 'shows', showId, 'modules', 'ai3d', 'scene', 'settings') : null),
    [showId]
  );

  const selectedObject = useMemo(
    () => objects.find((obj) => obj.id === selectedId) || null,
    [objects, selectedId]
  );

  const selectedLabel = useMemo(() => {
    if (!selectedObject) return '';
    const raw = selectedObject.label || selectedObject.type || 'Object';
    return raw.length > 15 ? `${raw.slice(0, 15)}…` : raw;
  }, [selectedObject]);

  const pushHistory = useCallback((entry) => {
    if (isApplyingHistoryRef.current) return;
    undoStackRef.current.push(entry);
    redoStackRef.current = [];
    setHistoryTick((prev) => prev + 1);
  }, []);

  const applySnapshot = useCallback(async (objectId, data) => {
    if (!showId || !objectId || !data) return;
    await setDoc(doc(db, 'shows', showId, 'modules', 'ai3d', 'objects', objectId), {
      ...data,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }, [showId]);

  const handleUndo = useCallback(async () => {
    const stack = undoStackRef.current;
    if (!stack.length) return;
    const entry = stack.pop();
    redoStackRef.current.push(entry);
    setHistoryTick((prev) => prev + 1);
    isApplyingHistoryRef.current = true;
    try {
      if (entry.type === 'update') {
        await applySnapshot(entry.objectId, entry.before);
      } else if (entry.type === 'create') {
        await deleteDoc(doc(db, 'shows', showId, 'modules', 'ai3d', 'objects', entry.objectId));
      } else if (entry.type === 'delete') {
        await setDoc(doc(db, 'shows', showId, 'modules', 'ai3d', 'objects', entry.objectId), entry.before);
      }
    } finally {
      isApplyingHistoryRef.current = false;
    }
  }, [applySnapshot]);

  const handleRedo = useCallback(async () => {
    const stack = redoStackRef.current;
    if (!stack.length) return;
    const entry = stack.pop();
    undoStackRef.current.push(entry);
    setHistoryTick((prev) => prev + 1);
    isApplyingHistoryRef.current = true;
    try {
      if (entry.type === 'update') {
        await applySnapshot(entry.objectId, entry.after);
      } else if (entry.type === 'create') {
        await setDoc(doc(db, 'shows', showId, 'modules', 'ai3d', 'objects', entry.objectId), entry.after);
      } else if (entry.type === 'delete') {
        await deleteDoc(doc(db, 'shows', showId, 'modules', 'ai3d', 'objects', entry.objectId));
      }
    } finally {
      isApplyingHistoryRef.current = false;
    }
  }, [applySnapshot]);

  const selectedScaleLabel = useMemo(() => {
    if (!selectedObject) return '';
    if (transformMode === 'scale' && scalePreview) return scalePreview;
    const mesh = meshMapRef.current.get(selectedObject.id);
    const base = selectedObject.dimensions || {};
    const sx = mesh?.scale?.x ?? 1;
    const sy = mesh?.scale?.y ?? 1;
    const sz = mesh?.scale?.z ?? 1;
    const width = toNumber(base.x, 1) * sx;
    const height = toNumber(base.y, 1) * sy;
    const depth = toNumber(base.z, 1) * sz;
    return `${formatNumber(width)}${unitLabel} × ${formatNumber(height)}${unitLabel} × ${formatNumber(depth)}${unitLabel}`;
  }, [selectedObject, unitLabel, objects, scalePreview, transformMode]);

  useEffect(() => {
    unitLabelRef.current = unitLabel;
  }, [unitLabel]);

  useEffect(() => {
    if (typeof gltfLoaderRef.current.setCrossOrigin === 'function') {
      gltfLoaderRef.current.setCrossOrigin('anonymous');
    }
  }, []);

  useEffect(() => {
    if (panelOpen || assetPanelOpen) {
      setMenuOpen(false);
    }
  }, [assetPanelOpen, panelOpen]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
      }
      if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleRedo, handleUndo]);

  useEffect(() => {
    if (!objectsCollection) return undefined;
    const unsub = onSnapshot(
      objectsCollection,
      (snap) => {
        const next = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        objectsRef.current = next;
        setObjects(next);
      },
      (err) => {
        setError(err?.message || 'Unable to load scene objects.');
      }
    );
    return () => unsub();
  }, [objectsCollection]);

  useEffect(() => {
    if (!sceneSettingsRef) return undefined;
    const unsub = onSnapshot(
      sceneSettingsRef,
      (snap) => {
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
          unit: data.unit || prev.unit,
        }));
      },
      () => {}
    );
    return () => unsub();
  }, [sceneSettingsRef]);

  useEffect(() => {
    if (!appUser?.id || !sceneDocRef) return;
    if (summaryTimerRef.current) clearTimeout(summaryTimerRef.current);
    summaryTimerRef.current = setTimeout(() => {
      const summary = objects.map((obj) => buildSummary(obj));
      setDoc(
        sceneDocRef,
        {
          summary,
          summaryUpdatedAt: serverTimestamp(),
          summaryUpdatedBy: appUser.id,
        },
        { merge: true }
      ).catch(() => {});
    }, 400);
  }, [appUser?.id, objects, sceneDocRef]);

  useEffect(() => {
    if (!selectedObject) return;
    setForm({
      label: selectedObject.label || '',
      width: toNumber(selectedObject.dimensions?.x, 1),
      height: toNumber(selectedObject.dimensions?.y, 1),
      depth: toNumber(selectedObject.dimensions?.z, 1),
      posX: toNumber(selectedObject.position?.x, 0),
      posZ: toNumber(selectedObject.position?.z, 0),
      rotationY: toNumber(selectedObject.rotation?.y, 0),
      textureUrl: selectedObject.textureUrl || '',
      color: selectedObject.color || '#d1d5db',
      detailModelPath: selectedObject.detailModelPath || '',
      loadOnStart: Boolean(selectedObject.loadOnStart),
      frozen: Boolean(selectedObject.frozen),
    });
  }, [selectedObject]);

  useEffect(() => {
    if (!canvasRef.current || !showId) return undefined;

    const container = canvasRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#e2e8f0');
    scene.fog = null;

    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
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
    grid.position.y = 0;
    grid.visible = false;
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
    controls.minDistance = 3;
    controls.maxDistance = 60;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minPolarAngle = 0.05;
    controls.target.set(0, 0.5, 0);
    controls.update();
    controls.userData = { autoSpin: false, spinSpeed: 0.003 };
    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.setMode('translate');
    transformControls.showX = true;
    transformControls.showY = false;
    transformControls.showZ = true;
    transformControls.setSize(1.9);
    transformControls.setSpace('world');
    const transformHelper = typeof transformControls.getHelper === 'function'
      ? transformControls.getHelper()
      : transformControls;
    scene.add(transformHelper);

    transformControls.addEventListener('dragging-changed', (event) => {
      controls.enabled = !event.value;
    });

    transformControls.addEventListener('objectChange', () => {
      if (transformModeRef.current !== 'scale') return;
      const mesh = transformControls.object;
      if (!mesh) return;
      const base = mesh.userData.baseDimensions || { x: 1, y: 1, z: 1 };
      const width = Math.max(0.1, base.x * mesh.scale.x);
      const height = Math.max(0.1, base.y * mesh.scale.y);
      const depth = Math.max(0.1, base.z * mesh.scale.z);
      const unit = unitLabelRef.current;
      setScalePreview(`${formatNumber(width)}${unit} × ${formatNumber(height)}${unit} × ${formatNumber(depth)}${unit}`);
    });

    transformControls.addEventListener('mouseUp', async () => {
      const mesh = transformControls.object;
      const objectId = mesh?.userData?.objectId;
      if (!mesh || !objectId) return;
      try {
        const before = objectsRef.current.find((obj) => obj.id === objectId);
        const payload = {
          position: {
            x: mesh.position.x,
            y: mesh.position.y,
            z: mesh.position.z,
          },
          rotation: {
            x: 0,
            y: mesh.rotation.y,
            z: 0,
          },
          updatedAt: serverTimestamp(),
        };

        if (transformModeRef.current === 'scale') {
          const base = mesh.userData.baseDimensions || { x: 1, y: 1, z: 1 };
          const width = Math.max(0.1, base.x * mesh.scale.x);
          const height = Math.max(0.1, base.y * mesh.scale.y);
          const depth = Math.max(0.1, base.z * mesh.scale.z);
          payload.dimensions = { x: width, y: height, z: depth };
          payload.position = {
            x: mesh.position.x,
            y: height / 2,
            z: mesh.position.z,
          };
          mesh.scale.set(1, 1, 1);
          mesh.geometry.dispose();
          mesh.geometry = new THREE.BoxGeometry(width, height, depth);
          mesh.userData.dimensions = `${width}_${height}_${depth}`;
          mesh.userData.baseDimensions = { x: width, y: height, z: depth };
          mesh.position.y = height / 2;
          setScalePreview('');
        }

        if (before) {
          const after = { ...before, ...payload };
          pushHistory({ type: 'update', objectId, before, after });
        }
        await updateDoc(doc(db, 'shows', showId, 'modules', 'ai3d', 'objects', objectId), payload);
      } catch (err) {
        setError(err?.message || 'Unable to update position.');
      }
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const resolveSelectableMesh = (node) => {
      let current = node;
      while (current) {
        if (current.userData?.objectId) {
          if (current.userData.selectable === false) return null;
          return current;
        }
        if (current === objectGroup) break;
        current = current.parent;
      }
      return null;
    };

    const handlePointerDown = (event) => {
      if (viewModeRef.current !== 'select') return;
      if (transformControls.axis) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      pointer.set(x, y);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(objectGroup.children, true);
      const selectableMeshes = [];
      const seen = new Set();
      hits.forEach((hit) => {
        const mesh = resolveSelectableMesh(hit.object);
        const id = mesh?.userData?.objectId;
        if (!mesh || !id || seen.has(id)) return;
        seen.add(id);
        selectableMeshes.push(mesh);
      });

      const mesh = selectableMeshes[0];
      if (!mesh) {
        setSelectedId('');
        transformControls.detach();
        controls.userData.autoSpin = false;
        setAutoSpin(false);
        return;
      }
      const objectId = mesh.userData.objectId;
      if (!objectId) return;
      setSelectedId(objectId);
      transformControls.attach(mesh);
      flyRef.current.active = true;
      flyRef.current.start = performance.now();
      flyRef.current.duration = 450;
      flyRef.current.fromPos.copy(camera.position);
      flyRef.current.toPos.copy(camera.position);
      flyRef.current.fromTarget.copy(controls.target);
      flyRef.current.toTarget.copy(mesh.position);
      flyRef.current.autoSpinAfter = false;
    };

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      if (width === lastSizeRef.current.width && height === lastSizeRef.current.height) return;
      lastSizeRef.current = { width, height };
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    resize();

    let animationFrame = 0;
    let lastTime = performance.now();
    const animate = () => {
      const now = performance.now();
      const delta = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      if (flyRef.current.active) {
        const elapsed = Math.min(1, (now - flyRef.current.start) / flyRef.current.duration);
        const eased = elapsed * (2 - elapsed);
        const nextPos = flyRef.current.fromPos.clone().lerp(flyRef.current.toPos, eased);
        const nextTarget = flyRef.current.fromTarget.clone().lerp(flyRef.current.toTarget, eased);
        camera.position.copy(nextPos);
        controls.target.copy(nextTarget);
        if (elapsed >= 1) {
          flyRef.current.active = false;
          if (flyRef.current.autoSpinAfter) {
            controls.userData.autoSpin = true;
            controls.userData.spinSpeed = 0.003;
            setAutoSpin(true);
          }
          controls.update();
        }
      }
      if (heightTweenRef.current.active) {
        const elapsed = Math.min(1, (now - heightTweenRef.current.start) / heightTweenRef.current.duration);
        const eased = elapsed * (2 - elapsed);
        const nextY = heightTweenRef.current.fromY + (heightTweenRef.current.toY - heightTweenRef.current.fromY) * eased;
        const delta = nextY - camera.position.y;
        camera.position.y = nextY;
        controls.target.y = Math.max(0, controls.target.y + delta);
        if (elapsed >= 1) {
          heightTweenRef.current.active = false;
        }
      }
      if (viewModeRef.current === 'walk' || viewModeRef.current === 'fly') {
        const input = walkInputRef.current;
        const desired = new THREE.Vector3();
        if (input.x !== 0 || input.z !== 0) {
          const forward = new THREE.Vector3()
            .subVectors(controls.target, camera.position)
            .setY(0);
          if (forward.lengthSq() < 0.0001) forward.set(0, 0, -1);
          forward.normalize();
          const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
          desired
            .addScaledVector(right, input.x)
            .addScaledVector(forward, input.z)
            .normalize()
            .multiplyScalar(walkSpeedRef.current * walkSpeedMultiplierRef.current);
        }
        walkVelocityRef.current.lerp(desired, 0.15);
        if (walkVelocityRef.current.lengthSq() > 0.0001) {
          const step = walkVelocityRef.current.clone().multiplyScalar(delta);
          camera.position.add(step);
          controls.target.add(step);
        }
      }
      controls.update();
      if (selectionBoxRef.current) selectionBoxRef.current.update();
      meshMapRef.current.forEach((mesh) => {
        const target = mesh.userData.targetOpacity;
        if (typeof target !== 'number') return;
        const current = mesh.material.opacity ?? 1;
        const next = current + (target - current) * 0.12;
        mesh.material.opacity = Math.max(0, Math.min(1, next));
        mesh.visible = mesh.userData.forceVisible ? true : mesh.material.opacity > 0.02;
      });
      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(animate);
    };
    animate();

    let resizeObserver;
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);
    } else {
      window.addEventListener('resize', resize);
    }

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);

    sceneRef.current = scene;
    groupRef.current = objectGroup;
    groundRef.current = ground;
    gridRef.current = grid;
    ambientRef.current = ambient;
    keyLightRef.current = keyLight;
    rendererRef.current = renderer;
    cameraRef.current = camera;
    controlsRef.current = controls;
    transformRef.current = transformControls;
    transformHelperRef.current = transformHelper;

    return () => {
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      window.cancelAnimationFrame(animationFrame);
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('resize', resize);
      controls.dispose();
      transformControls.dispose();
      if (transformHelperRef.current?.parent) {
        transformHelperRef.current.parent.remove(transformHelperRef.current);
      }
      renderer.dispose();
      container.removeChild(renderer.domElement);
      meshMapRef.current.forEach((mesh) => {
        mesh.geometry.dispose();
        if (mesh.material.map) mesh.material.map.dispose();
        mesh.material.dispose();
      });
      meshMapRef.current.clear();
      sceneRef.current = null;
      groupRef.current = null;
      groundRef.current = null;
      gridRef.current = null;
      ambientRef.current = null;
      keyLightRef.current = null;
      rendererRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      transformHelperRef.current = null;
    };
  }, [showId]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const meshMap = meshMapRef.current;
    const incomingIds = new Set(objects.map((obj) => obj.id));

    meshMap.forEach((mesh, id) => {
      if (incomingIds.has(id)) return;
      group.remove(mesh);
      mesh.geometry.dispose();
      if (mesh.material.map) mesh.material.map.dispose();
      mesh.material.dispose();
      meshMap.delete(id);
    });

    const loader = textureLoaderRef.current;
    loader.crossOrigin = 'anonymous';

    objects.forEach((obj) => {
      const dimensions = obj.dimensions || {};
      const width = Math.max(0.1, toNumber(dimensions.x, 1));
      const height = Math.max(0.1, toNumber(dimensions.y, 1));
      const depth = Math.max(0.1, toNumber(dimensions.z, 1));
      const position = obj.position || {};
      const rotation = obj.rotation || {};
      const color = obj.color || '#d1d5db';
      const textureUrl = obj.textureUrl || '';
      const dimsKey = `${width}_${height}_${depth}`;

      let mesh = meshMap.get(obj.id);
      if (!mesh) {
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshStandardMaterial({ color });
        mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        meshMap.set(obj.id, mesh);
        group.add(mesh);
        mesh.userData.objectId = obj.id;
      } else if (mesh.userData.dimensions !== dimsKey) {
        mesh.geometry.dispose();
        mesh.geometry = new THREE.BoxGeometry(width, height, depth);
      }

      mesh.userData.dimensions = dimsKey;
      mesh.userData.baseDimensions = { x: width, y: height, z: depth };
      mesh.userData.height = height;
      mesh.userData.selectable = !obj.frozen;
      mesh.material.transparent = true;
      mesh.position.set(
        toNumber(position.x, 0),
        toNumber(position.y, height / 2),
        toNumber(position.z, 0)
      );
      mesh.rotation.set(
        toNumber(rotation.x, 0),
        toNumber(rotation.y, 0),
        toNumber(rotation.z, 0)
      );

      if (mesh.material.color) {
        mesh.material.color.set(color);
      }

      if (mesh.material.emissive) {
        mesh.material.emissive.set(obj.id === selectedId ? '#0ea5e9' : '#000000');
        mesh.material.emissiveIntensity = obj.id === selectedId ? 0.35 : 0;
      }

      if (textureUrl && mesh.userData.textureUrl !== textureUrl) {
        const previous = mesh.material.map;
        loader.load(
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
            setError(buildAssetLoadErrorMessage(err, 'texture asset'));
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
    });
  }, [objects, selectedId, selectedObject]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const selected = objects.find((obj) => obj.id === selectedId);
    const hasSelected = Boolean(selected);
    const hasDetail = Boolean(selected?.detailModelPath);

    const cache = detailCacheRef.current;
    const order = detailOrderRef.current;
    const MAX_DETAIL = 10;

    const applyDetailTransform = (entry, proxy) => {
      if (!proxy.geometry) return;
      if (!proxy.geometry.boundingBox) {
        proxy.geometry.computeBoundingBox();
      }
      const proxyBox = proxy.geometry.boundingBox.clone();
      const proxySize = proxyBox.getSize(new THREE.Vector3()).multiply(proxy.scale);
      const proxyCenterLocal = proxyBox.getCenter(new THREE.Vector3());
      const detailSize = entry.originalSize.clone();
      const detailCenter = entry.originalCenter.clone();
      const safeSize = (value) => (Number.isFinite(value) && value > 0.001 ? value : 0.001);
      detailSize.set(
        safeSize(detailSize.x),
        safeSize(detailSize.y),
        safeSize(detailSize.z)
      );

      let scaleX = 1;
      let scaleY = 1;
      let scaleZ = 1;
      scaleX = proxySize.x / detailSize.x;
      scaleY = proxySize.y / detailSize.y;
      scaleZ = proxySize.z / detailSize.z;

      entry.group.scale.set(scaleX, scaleY, scaleZ);
      entry.group.position.set(
        proxyCenterLocal.x - detailCenter.x * scaleX,
        proxyCenterLocal.y - detailCenter.y * scaleY,
        proxyCenterLocal.z - detailCenter.z * scaleZ
      );
      entry.group.rotation.set(0, 0, 0);
    };

    const showProxy = (id, visible) => {
      const mesh = meshMapRef.current.get(id);
      if (!mesh) return;
      mesh.userData.targetOpacity = visible ? 1 : 0;
      mesh.userData.forceVisible = !visible;
      if (mesh.material) {
        mesh.material.transparent = true;
        mesh.material.depthWrite = visible;
        if (!visible) {
          mesh.material.opacity = 0;
        }
      }
    };

    const incomingIds = new Set(objects.map((obj) => obj.id));
    cache.forEach((entry, id) => {
      if (incomingIds.has(id)) return;
      if (entry.group.parent) entry.group.parent.remove(entry.group);
      entry.group.traverse((child) => {
        if (child.isMesh) {
          child.geometry.dispose();
          if (child.material?.map) child.material.map.dispose();
          if (child.material?.dispose) child.material.dispose();
        }
      });
      cache.delete(id);
      const idx = order.indexOf(id);
      if (idx >= 0) order.splice(idx, 1);
    });

    const loadDetail = (obj) => {
      if (!obj?.detailModelPath) return;
      if (detailLoadingRef.current.has(obj.id)) return;
      const loader = gltfLoaderRef.current;
      detailLoadingRef.current.add(obj.id);
      getDownloadURL(storageRef(storage, obj.detailModelPath))
        .then((url) => new Promise((resolve, reject) => {
          loader.load(url, resolve, undefined, reject);
        }))
        .then((gltf) => {
          const detailGroup = gltf.scene || gltf.scenes?.[0];
          if (!detailGroup) return;
          detailGroup.updateWorldMatrix(true, true);
          detailGroup.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          const proxy = meshMapRef.current.get(obj.id);
          if (!proxy) return;
          const detailBox = new THREE.Box3().setFromObject(detailGroup);
          const detailSize = detailBox.getSize(new THREE.Vector3());
          const detailCenter = detailBox.getCenter(new THREE.Vector3());

          const entry = {
            group: detailGroup,
            lastUsed: Date.now(),
            originalSize: detailSize,
            originalCenter: detailCenter,
          };
          cache.set(obj.id, entry);
          proxy.add(detailGroup);
          applyDetailTransform(entry, proxy);
          const existingIndex = order.indexOf(obj.id);
          if (existingIndex >= 0) order.splice(existingIndex, 1);
          order.unshift(obj.id);
          showProxy(obj.id, false);

          while (order.length > MAX_DETAIL) {
            const evictId = order.pop();
            const entryToEvict = cache.get(evictId);
            if (entryToEvict) {
              if (entryToEvict.group.parent) entryToEvict.group.parent.remove(entryToEvict.group);
              entryToEvict.group.traverse((child) => {
                if (child.isMesh) {
                  child.geometry.dispose();
                  if (child.material?.map) child.material.map.dispose();
                  if (child.material?.dispose) child.material.dispose();
                }
              });
              cache.delete(evictId);
            }
            showProxy(evictId, true);
          }
        })
        .catch((err) => {
          setError(buildAssetLoadErrorMessage(err, '3D model asset'));
        })
        .finally(() => {
          detailLoadingRef.current.delete(obj.id);
        });
    };

    objects.forEach((obj) => {
      const cached = cache.get(obj.id);
      const proxy = meshMapRef.current.get(obj.id);
      if (cached && proxy) {
        applyDetailTransform(cached, proxy);
        if (cached.group.parent !== proxy) {
          proxy.add(cached.group);
        }
        cached.group.visible = true;
        showProxy(obj.id, false);
      } else {
        showProxy(obj.id, true);
        if (obj.loadOnStart && obj.detailModelPath) {
          loadDetail(obj);
        }
      }
    });

    if (!hasSelected || !hasDetail) return;

    const cached = cache.get(selected.id);
    if (cached) {
      const existingIndex = order.indexOf(selected.id);
      if (existingIndex >= 0) order.splice(existingIndex, 1);
      order.unshift(selected.id);
      cached.lastUsed = Date.now();
      return;
    }

    loadDetail(selected);
  }, [objects, selectedId]);

  useEffect(() => {
    const transformControls = transformRef.current;
    const group = groupRef.current;
    if (!group) return;

    if (selectionBoxRef.current) {
      group.remove(selectionBoxRef.current);
      selectionBoxRef.current.geometry.dispose();
      selectionBoxRef.current.material.dispose();
      selectionBoxRef.current = null;
    }

    if (!selectedId) {
      if (transformControls) transformControls.detach();
      return;
    }

    const mesh = meshMapRef.current.get(selectedId);
    if (!mesh) return;
    if (transformControls) transformControls.attach(mesh);

    const boxHelper = new THREE.BoxHelper(mesh, 0x38bdf8);
    if (boxHelper.material) {
      boxHelper.material.transparent = true;
      boxHelper.material.opacity = 0.35;
    }
    selectionBoxRef.current = boxHelper;
    group.add(boxHelper);
  }, [objects, selectedId]);

  useEffect(() => {
    const transformControls = transformRef.current;
    if (!transformControls) return;
    transformModeRef.current = transformMode;
    if (transformMode === 'rotate') {
      transformControls.setMode('rotate');
      transformControls.showX = false;
      transformControls.showY = true;
      transformControls.showZ = false;
    } else if (transformMode === 'scale') {
      transformControls.setMode('scale');
      transformControls.showX = true;
      transformControls.showY = true;
      transformControls.showZ = true;
    } else {
      transformControls.setMode('translate');
      transformControls.showX = true;
      transformControls.showY = false;
      transformControls.showZ = true;
    }
  }, [transformMode]);

  useEffect(() => {
    const ground = groundRef.current;
    const grid = gridRef.current;
    const ambient = ambientRef.current;
    const key = keyLightRef.current;
    if (!ground || !grid || !ambient || !key) return;

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
          setError(buildAssetLoadErrorMessage(err, 'floor texture'));
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

    if (controlsRef.current && cameraRef.current) {
      const maxSize = Math.max(width, depth, 1);
      controlsRef.current.maxDistance = Math.max(30, maxSize * 4);
      cameraRef.current.far = Math.max(200, maxSize * 10);
      cameraRef.current.updateProjectionMatrix();
    }
  }, [sceneForm]);

  const onChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const autoSaveField = useCallback(async (field, value) => {
    if (!showId || !selectedId || panelMode !== 'edit') return;
    if (!appUser?.id) return;
    setError('');

    const nextForm = { ...form, [field]: value };
    const width = Math.max(0.1, toNumber(nextForm.width, 1));
    const height = Math.max(0.1, toNumber(nextForm.height, 1));
    const depth = Math.max(0.1, toNumber(nextForm.depth, 1));
    const posX = toNumber(nextForm.posX, 0);
    const posZ = toNumber(nextForm.posZ, 0);
    const rotationY = toNumber(nextForm.rotationY, 0);
    const label = (nextForm.label || '').trim() || 'Box';
    const textureUrl = (nextForm.textureUrl || '').trim();
    const color = nextForm.color || '#d1d5db';

    const payload = {
      label,
      dimensions: { x: width, y: height, z: depth },
      position: { x: posX, y: height / 2, z: posZ },
      rotation: { x: 0, y: rotationY, z: 0 },
      textureUrl,
      color,
      frozen: Boolean(nextForm.frozen),
      updatedAt: serverTimestamp(),
    };

    if (field === 'loadOnStart') {
      payload.loadOnStart = Boolean(value);
    }

    try {
      if (selectedObject) {
        const before = { ...selectedObject };
        const after = { ...selectedObject, ...payload };
        pushHistory({ type: 'update', objectId: selectedObject.id, before, after });
      }
      await updateDoc(doc(db, 'shows', showId, 'modules', 'ai3d', 'objects', selectedId), payload);
    } catch (err) {
      setError(err?.message || 'Unable to save changes.');
    }
  }, [appUser?.id, form, panelMode, pushHistory, selectedId, selectedObject, showId]);

  const onAssetFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setAssetFile(file);
  };

  const onSceneChange = (field) => (event) => {
    setSceneForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const autoSaveSceneField = useCallback(async (field, value) => {
    if (!appUser?.id || !sceneSettingsRef) return;
    setError('');
    const next = { ...sceneForm, [field]: value };
    try {
      await setDoc(sceneSettingsRef, {
        floorWidth: toNumber(next.floorWidth, 30),
        floorDepth: toNumber(next.floorDepth, 30),
        floorColor: next.floorColor || '#f8fafc',
        floorTextureUrl: next.floorTextureUrl || '',
        ambientIntensity: toNumber(next.ambientIntensity, 1.1),
        keyIntensity: toNumber(next.keyIntensity, 1.2),
        keyX: toNumber(next.keyX, 6),
        keyY: toNumber(next.keyY, 10),
        keyZ: toNumber(next.keyZ, 6),
        unit: next.unit || 'm',
        updatedAt: serverTimestamp(),
        updatedBy: appUser.id,
      }, { merge: true });
    } catch (err) {
      setError(err?.message || 'Unable to save scene settings.');
    }
  }, [appUser?.id, sceneForm, sceneSettingsRef]);

  const fetchAssets = useCallback(async (kind = assetKind, search = assetSearch) => {
    if (!showId) return;
    setAssetLoading(true);
    setError('');
    try {
      const rootRef = storageRef(storage, 'shows/' + showId + '/ai3d-assets');
      const result = await list(rootRef, { maxResults: 200 });
      const items = await Promise.all(result.items.map(async (itemRef) => {
        try {
          const [meta, url] = await Promise.all([
            getMetadata(itemRef),
            getDownloadURL(itemRef),
          ]);
          const displayName = meta.customMetadata?.displayName || itemRef.name;
          const metaKind = meta.customMetadata?.kind || '';
          const extension = itemRef.name.split('.').pop()?.toLowerCase() || '';
          const inferredKind = metaKind || (extension === 'glb' || extension === 'gltf' ? 'model' : 'texture');
          return {
            path: itemRef.fullPath,
            name: itemRef.name,
            displayName,
            kind: inferredKind,
            url,
          };
        } catch {
          return null;
        }
      }));
      const query = (search || '').trim().toLowerCase();
      const filtered = items
        .filter(Boolean)
        .filter((item) => item.kind === kind)
        .filter((item) => !query || item.displayName.toLowerCase().includes(query))
        .slice(0, 10);
      setAssetItems(filtered);
    } catch (err) {
      setError(err?.message || 'Unable to load assets.');
    } finally {
      setAssetLoading(false);
    }
  }, [assetKind, assetSearch, showId]);

  useEffect(() => {
    if (!assetPanelOpen) return;
    fetchAssets();
  }, [assetPanelOpen, assetKind, assetSearch, fetchAssets]);

  const handleAssetUpload = useCallback(async (event) => {
    event.preventDefault();
    if (!showId) {
      setError('Show context is missing.');
      return;
    }
    if (!assetFile) {
      setError('Choose a file to upload.');
      return;
    }
    const displayName = assetName.trim();
    if (!displayName) {
      setError('Enter a name for this asset.');
      return;
    }
    setError('');
    setAssetLoading(true);
    try {
      const extension = assetFile.name.split('.').pop() || '';
      const safeName = displayName.replace(/[^a-zA-Z0-9._-]+/g, '_');
      const fileName = extension ? `${safeName}.${extension}` : safeName;
      const path = 'shows/' + showId + '/ai3d-assets/' + fileName;
      const uploadTask = uploadBytesResumable(storageRef(storage, path), assetFile, {
        contentType: assetFile.type || (assetKind === 'model' ? 'model/gltf-binary' : 'image/png'),
        customMetadata: {
          displayName,
          kind: assetKind,
        },
      });
      await new Promise((resolve, reject) => {
        uploadTask.on('state_changed', null, reject, resolve);
      });
      setAssetFile(null);
      setAssetName('');
      await fetchAssets(assetKind, assetSearch);
    } catch (err) {
      setError(err?.message || 'Unable to upload asset.');
    } finally {
      setAssetLoading(false);
    }
  }, [assetFile, assetKind, assetName, assetSearch, fetchAssets, showId]);

  const applyAssetToForm = useCallback(async (asset) => {
    if (!showId) return;
    if (!asset) return;
    if (asset.kind === 'texture') {
      if (assetTarget === 'scene-floor') {
        setSceneForm((prev) => ({ ...prev, floorTextureUrl: asset.url }));
        await autoSaveSceneField('floorTextureUrl', asset.url);
      } else {
        if (selectedObject) {
          const before = { ...selectedObject };
          const after = { ...selectedObject, textureUrl: asset.url };
          pushHistory({ type: 'update', objectId: selectedObject.id, before, after });
        }
        setForm((prev) => ({ ...prev, textureUrl: asset.url }));
        if (selectedId && panelMode === 'edit') {
          await autoSaveField('textureUrl', asset.url);
        }
      }
    } else {
      if (!selectedId || panelMode !== 'edit') {
        setError('Model selected for form. Save the object to see it in scene.');
      }
      if (selectedObject) {
        const before = { ...selectedObject };
        const after = { ...selectedObject, detailModelPath: asset.path };
        pushHistory({ type: 'update', objectId: selectedObject.id, before, after });
      }
      setForm((prev) => ({ ...prev, detailModelPath: asset.path }));
      if (selectedId && panelMode === 'edit') {
        try {
          await updateDoc(doc(db, 'shows', showId, 'modules', 'ai3d', 'objects', selectedId), {
            detailModelPath: asset.path,
            updatedAt: serverTimestamp(),
          });
          const cached = detailCacheRef.current.get(selectedId);
          if (cached) {
            if (cached.group.parent) cached.group.parent.remove(cached.group);
            cached.group.traverse((child) => {
              if (child.isMesh) {
                child.geometry.dispose();
                if (child.material?.map) child.material.map.dispose();
                if (child.material?.dispose) child.material.dispose();
              }
            });
            detailCacheRef.current.delete(selectedId);
          }
        } catch (err) {
          setError(err?.message || 'Unable to save model.');
        }
      }
    }
    setAssetPanelOpen(false);
    setPanelMode(assetReturnMode);
    setPanelOpen(true);
  }, [assetReturnMode, autoSaveField, autoSaveSceneField, panelMode, pushHistory, selectedId, selectedObject, showId]);

  const clearAssetSelection = useCallback(async () => {
    if (!showId) return;
    if (assetTarget === 'scene-floor') {
      setSceneForm((prev) => ({ ...prev, floorTextureUrl: '' }));
      await autoSaveSceneField('floorTextureUrl', '');
    } else if (assetKind === 'texture') {
      if (selectedObject) {
        const before = { ...selectedObject };
        const after = { ...selectedObject, textureUrl: '' };
        pushHistory({ type: 'update', objectId: selectedObject.id, before, after });
      }
      setForm((prev) => ({ ...prev, textureUrl: '' }));
      if (selectedId && panelMode === 'edit') {
        await autoSaveField('textureUrl', '');
      }
    } else {
      if (selectedObject) {
        const before = { ...selectedObject };
        const after = { ...selectedObject, detailModelPath: '' };
        pushHistory({ type: 'update', objectId: selectedObject.id, before, after });
      }
      setForm((prev) => ({ ...prev, detailModelPath: '' }));
      if (selectedId && panelMode === 'edit') {
        await updateDoc(doc(db, 'shows', showId, 'modules', 'ai3d', 'objects', selectedId), {
          detailModelPath: '',
          updatedAt: serverTimestamp(),
        });
      }
      const cached = detailCacheRef.current.get(selectedId);
      if (cached) {
        if (cached.group.parent) cached.group.parent.remove(cached.group);
        cached.group.traverse((child) => {
          if (child.isMesh) {
            child.geometry.dispose();
            if (child.material?.map) child.material.map.dispose();
            if (child.material?.dispose) child.material.dispose();
          }
        });
        detailCacheRef.current.delete(selectedId);
      }
    }
    setAssetPanelOpen(false);
    setPanelMode(assetReturnMode);
    setPanelOpen(true);
  }, [assetKind, assetReturnMode, assetTarget, autoSaveField, autoSaveSceneField, panelMode, pushHistory, selectedId, selectedObject, showId]);

  const saveScene = useCallback(async (event) => {
    event.preventDefault();
    if (!appUser?.id || !sceneSettingsRef) {
      setError('You must be signed in to edit the scene.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await setDoc(sceneSettingsRef, {
        floorWidth: toNumber(sceneForm.floorWidth, 30),
        floorDepth: toNumber(sceneForm.floorDepth, 30),
        floorColor: sceneForm.floorColor || '#f8fafc',
        floorTextureUrl: sceneForm.floorTextureUrl || '',
        ambientIntensity: toNumber(sceneForm.ambientIntensity, 1.1),
        keyIntensity: toNumber(sceneForm.keyIntensity, 1.2),
        keyX: toNumber(sceneForm.keyX, 6),
        keyY: toNumber(sceneForm.keyY, 10),
        keyZ: toNumber(sceneForm.keyZ, 6),
        unit: sceneForm.unit || 'm',
        updatedAt: serverTimestamp(),
        updatedBy: appUser.id,
      }, { merge: true });
    } catch (err) {
      setError(err?.message || 'Unable to save scene settings.');
    } finally {
      setSaving(false);
    }
  }, [appUser?.id, sceneForm, sceneSettingsRef]);

  const saveObject = useCallback(async (event) => {
    event.preventDefault();
    if (!appUser?.id || !objectsCollection || !showId) {
      setError('You must be signed in to add objects.');
      return;
    }
    setSaving(true);
    setError('');

    const width = Math.max(0.1, toNumber(form.width, 1));
    const height = Math.max(0.1, toNumber(form.height, 1));
    const depth = Math.max(0.1, toNumber(form.depth, 1));
    const posX = toNumber(form.posX, 0);
    const posZ = toNumber(form.posZ, 0);
    const rotationY = toNumber(form.rotationY, 0);

    const basePayload = {
      label: form.label.trim() || 'Box',
      dimensions: { x: width, y: height, z: depth },
      position: { x: posX, y: height / 2, z: posZ },
      rotation: { x: 0, y: rotationY, z: 0 },
      textureUrl: form.textureUrl.trim(),
      color: form.color || '#d1d5db',
      loadOnStart: Boolean(form.loadOnStart),
      detailModelPath: form.detailModelPath || '',
      frozen: Boolean(form.frozen),
    };

    try {
      let docId = selectedId;
      if (selectedId) {
        if (selectedObject) {
          const before = { ...selectedObject };
          const after = { ...selectedObject, ...basePayload };
          pushHistory({ type: 'update', objectId: selectedId, before, after });
        }
        await updateDoc(doc(db, 'shows', showId, 'modules', 'ai3d', 'objects', selectedId), {
          ...basePayload,
          detailFit: deleteField(),
          updatedAt: serverTimestamp(),
        });
      } else {
        const docRef = await addDoc(objectsCollection, {
          ...basePayload,
          type: 'box',
          createdAt: serverTimestamp(),
          createdBy: appUser.id,
        });
        docId = docRef.id;
        pushHistory({
          type: 'create',
          objectId: docId,
          after: {
            ...basePayload,
            type: 'box',
            createdAt: serverTimestamp(),
            createdBy: appUser.id,
          },
        });
      }

      if (!selectedId) {
        setForm(buildDefaultForm());
      }
    } catch (err) {
      setError(err?.message || 'Unable to save object.');
    } finally {
      setSaving(false);
    }
  }, [appUser?.id, form, objectsCollection, pushHistory, selectedId, selectedObject, showId]);

  const addDemoBox = useCallback(async () => {
    if (!appUser?.id || !objectsCollection) {
      setError('You must be signed in to add objects.');
      return;
    }
    setSaving(true);
    setError('');

    try {
      await addDoc(objectsCollection, {
        label: 'Demo crate',
        type: 'box',
        dimensions: { x: 2, y: 1, z: 2 },
        position: { x: 2, y: 0.5, z: -1 },
        rotation: { x: 0, y: 0.4, z: 0 },
        textureUrl: '',
        color: '#d1d5db',
        frozen: false,
        createdAt: serverTimestamp(),
        createdBy: appUser.id,
      });
    } catch (err) {
      setError(err?.message || 'Unable to add demo object.');
    } finally {
      setSaving(false);
    }
  }, [appUser?.id, objectsCollection]);

  const removeObject = useCallback(async (objectId) => {
    if (!showId || !objectId) return;
    setError('');
    try {
      const before = objects.find((obj) => obj.id === objectId);
      if (before) {
        pushHistory({ type: 'delete', objectId, before });
      }
      await deleteDoc(doc(db, 'shows', showId, 'modules', 'ai3d', 'objects', objectId));
      if (selectedId === objectId) {
        setSelectedId('');
        setForm(buildDefaultForm());
      }
    } catch (err) {
      setError(err?.message || 'Unable to delete object.');
    }
  }, [objects, pushHistory, selectedId, showId]);

  const clearSelection = useCallback(() => {
    setSelectedId('');
    setForm(buildDefaultForm());
  }, []);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
  }, []);

  const startFly = useCallback((toPos, toTarget, duration = 1200) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    controls.userData.autoSpin = false;
    setAutoSpin(false);
    flyRef.current.active = true;
    flyRef.current.start = performance.now();
    flyRef.current.duration = duration;
    flyRef.current.fromPos.copy(camera.position);
    flyRef.current.toPos.copy(toPos);
    flyRef.current.fromTarget.copy(controls.target);
    flyRef.current.toTarget.copy(toTarget);
    flyRef.current.autoSpinAfter = false;
  }, []);

  const setGroundView = useCallback((height, distance) => {
    const controls = controlsRef.current;
    const group = groupRef.current;
    if (!controls || !group) return;
    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    const target = new THREE.Vector3(center.x, height, center.z);
    const pos = new THREE.Vector3(center.x, height, center.z + distance);
    startFly(pos, target, 1200);
  }, [startFly]);

  const updateWalkInput = useCallback((dx, dz) => {
    walkInputRef.current.x = dx;
    walkInputRef.current.z = dz;
  }, []);

  const adjustWalkSpeed = useCallback((next) => {
    const clamped = Math.max(1, Math.min(10, next));
    walkSpeedRef.current = clamped;
    setWalkSpeed(clamped);
  }, []);

  const setCameraHeight = useCallback((height) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    heightTweenRef.current.active = true;
    heightTweenRef.current.start = performance.now();
    heightTweenRef.current.duration = 450;
    heightTweenRef.current.fromY = camera.position.y;
    heightTweenRef.current.toY = height;
  }, []);

  useEffect(() => {
    viewModeRef.current = viewMode;
    if (viewMode !== 'select') {
      setSelectedId('');
      if (transformRef.current) transformRef.current.detach();
    }
    if (viewMode === 'walk') {
      setCameraHeight(walkHeightLevel);
    }
    if (viewMode === 'fly') {
      setCameraHeight(flyHeightLevel * 10);
    }
    if (viewMode !== 'walk' && viewMode !== 'fly') {
      walkInputRef.current = { x: 0, z: 0 };
    }
  }, [flyHeightLevel, setCameraHeight, viewMode, walkHeightLevel]);

  useEffect(() => {
    if (viewMode === 'walk') {
      setCameraHeight(walkHeightLevel);
    }
  }, [setCameraHeight, viewMode, walkHeightLevel]);

  useEffect(() => {
    if (viewMode === 'fly') {
      setCameraHeight(flyHeightLevel * 10);
    }
  }, [flyHeightLevel, setCameraHeight, viewMode]);

  useEffect(() => {
    if (viewMode !== 'select') return;
    const onKeyDown = (event) => {
      if (event.key === 'r' || event.key === 'R') setTransformMode('rotate');
      if (event.key === 't' || event.key === 'T' || event.key === 'm' || event.key === 'M') {
        setTransformMode('translate');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewMode]);

  useEffect(() => {
    if (viewMode !== 'walk' && viewMode !== 'fly') return;
    const onKeyDown = (event) => {
      if (event.key === 'ArrowUp') walkInputRef.current.z = 1;
      if (event.key === 'ArrowDown') walkInputRef.current.z = -1;
      if (event.key === 'ArrowLeft') walkInputRef.current.x = -1;
      if (event.key === 'ArrowRight') walkInputRef.current.x = 1;
    };
    const onKeyUp = (event) => {
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') walkInputRef.current.z = 0;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') walkInputRef.current.x = 0;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [viewMode]);

  const fitScene = useCallback(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    const width = Math.max(10, toNumber(sceneForm.floorWidth, 30));
    const depth = Math.max(10, toNumber(sceneForm.floorDepth, 30));
    const maxSize = Math.max(width, depth, 1);
    const fitHeightDistance = maxSize / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)));
    const fitWidthDistance = fitHeightDistance / camera.aspect;
    const distance = Math.max(fitHeightDistance, fitWidthDistance) * 1.35;
    const center = new THREE.Vector3(0, 0, 0);
    const direction = new THREE.Vector3(1, 1, 1).normalize();

    const targetPos = center.clone().add(direction.multiplyScalar(distance));
    startFly(targetPos, center, 1400);
  }, [sceneForm.floorDepth, sceneForm.floorWidth, startFly]);

  useEffect(() => {
    fitScene();
  }, [fitScene, sceneForm.floorDepth, sceneForm.floorWidth]);

  const setView = useCallback((view) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const width = Math.max(10, toNumber(sceneForm.floorWidth, 30));
    const depth = Math.max(10, toNumber(sceneForm.floorDepth, 30));
    const maxSize = Math.max(width, depth, 1);
    const distance = maxSize * 1.6;
    const center = new THREE.Vector3(0, 0, 0);
    let direction = new THREE.Vector3(1, 1, 1).normalize();
    if (view === 'top') direction = new THREE.Vector3(0, 1, 0).normalize();
    if (view === 'front') direction = new THREE.Vector3(0, 0.6, 1).normalize();
    if (view === 'left') direction = new THREE.Vector3(-1, 0.6, 0).normalize();
    if (view === 'iso') direction = new THREE.Vector3(1, 1, 1).normalize();
    const targetPos = center.clone().add(direction.multiplyScalar(distance));
    startFly(targetPos, center, 1200);
  }, [sceneForm.floorDepth, sceneForm.floorWidth, startFly]);

  return (
    <div className={styles.scenePage}>
      <div className={styles.sceneShell}>
        <div className={styles.sceneBackBar}>
          <button
            type="button"
            className={styles.sceneBackButton}
            onClick={() => navigate(`/shows/${showId}/workspace`)}
          >
            <FiArrowLeft />
            Back
          </button>
        </div>
        <div className={styles.viewerStage} ref={canvasRef} />

        <div className={styles.navControls}>
          <button type="button" className={styles.navButton} onClick={() => setView('top')}>
            <FiArrowUp />
            Top
          </button>
          <button type="button" className={styles.navButton} onClick={() => setView('front')}>
            <FiArrowRight />
            Front
          </button>
          <button type="button" className={styles.navButton} onClick={fitScene}>
            <FiMaximize2 />
            Fit
          </button>
        </div>

        <div className={styles.modeDock}>
          <div className={styles.modeActions}>
            {viewMode === 'select' ? (
              <>
                <div className={styles.transformToggle}>
                  {transformMode === 'scale' && selectedScaleLabel ? (
                    <div className={styles.scaleBadge}>{selectedScaleLabel}</div>
                  ) : null}
                  <div className={styles.transformRow}>
                    <button
                      type="button"
                      className={`${styles.transformButton} ${transformMode === 'translate' ? styles.transformActive : ''}`.trim()}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => setTransformMode('translate')}
                    >
                      <FiMove />
                      Move
                    </button>
                    <button
                      type="button"
                      className={`${styles.transformButton} ${transformMode === 'rotate' ? styles.transformActive : ''}`.trim()}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => setTransformMode('rotate')}
                    >
                      <FiRotateCw />
                      Rotate
                    </button>
                    <button
                      type="button"
                      className={`${styles.transformButton} ${transformMode === 'scale' ? styles.transformActive : ''}`.trim()}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => setTransformMode('scale')}
                    >
                      <FiMaximize2 />
                      Scale
                    </button>
                  </div>
                </div>
                <div className={styles.editRow}>
                  <button
                    type="button"
                    className={styles.undoButton}
                    onClick={handleUndo}
                    disabled={undoDisabled}
                  >
                    <FiCornerUpLeft />
                    Undo
                  </button>
                  <button
                    type="button"
                    className={styles.undoButton}
                    onClick={handleRedo}
                    disabled={redoDisabled}
                  >
                    <FiCornerUpRight />
                    Redo
                  </button>
                  <button
                    type="button"
                    className={`${styles.modeActionButton} ${selectedId ? styles.modeActionButtonActive : ''}`.trim()}
                    disabled={!selectedId}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => {
                      if (!selectedId) return;
                      setAssetPanelOpen(false);
                      setPanelMode('edit');
                      setPanelOpen(true);
                    }}
                  >
                    Edit{selectedLabel ? `: ${selectedLabel}` : ''}
                  </button>
                </div>
              </>
            ) : viewMode === 'walk' ? (
              <div className={styles.walkPad}>
                <div className={styles.walkSpeed}>
                  <button
                    type="button"
                    className={styles.walkSpeedBtn}
                    onClick={() => adjustWalkSpeed(walkSpeed + 1)}
                    disabled={walkSpeed >= 10}
                  >
                    +
                  </button>
                  <div className={styles.walkSpeedValue}>{walkSpeed}</div>
                  <button
                    type="button"
                    className={styles.walkSpeedBtn}
                    onClick={() => adjustWalkSpeed(walkSpeed - 1)}
                    disabled={walkSpeed <= 1}
                  >
                    -
                  </button>
                  <span className={styles.walkLabel}>Speed</span>
                </div>
                <div className={styles.walkArrows}>
                  <button
                    type="button"
                    className={styles.walkBtn}
                    onPointerDown={() => updateWalkInput(0, 1)}
                    onPointerUp={() => updateWalkInput(0, 0)}
                    onPointerLeave={() => updateWalkInput(0, 0)}
                  >
                    <FiArrowUp />
                  </button>
                  <div className={styles.walkRow}>
                    <button
                      type="button"
                      className={styles.walkBtn}
                      onPointerDown={() => updateWalkInput(-1, 0)}
                      onPointerUp={() => updateWalkInput(0, 0)}
                      onPointerLeave={() => updateWalkInput(0, 0)}
                    >
                      <FiArrowLeft />
                    </button>
                    <button
                      type="button"
                      className={styles.walkBtn}
                      onPointerDown={() => updateWalkInput(1, 0)}
                      onPointerUp={() => updateWalkInput(0, 0)}
                      onPointerLeave={() => updateWalkInput(0, 0)}
                    >
                      <FiArrowRight />
                    </button>
                  </div>
                  <button
                    type="button"
                    className={styles.walkBtn}
                    onPointerDown={() => updateWalkInput(0, -1)}
                    onPointerUp={() => updateWalkInput(0, 0)}
                    onPointerLeave={() => updateWalkInput(0, 0)}
                  >
                    <FiArrowDown />
                  </button>
                </div>
                <div className={styles.walkHeight}>
                  <button
                    type="button"
                    className={styles.walkSpeedBtn}
                    onClick={() => setWalkHeightLevel((prev) => Math.min(5, prev + 1))}
                    disabled={walkHeightLevel >= 5}
                  >
                    +
                  </button>
                  <div className={styles.walkSpeedValue}>{walkHeightLevel}</div>
                  <button
                    type="button"
                    className={styles.walkSpeedBtn}
                    onClick={() => setWalkHeightLevel((prev) => Math.max(1, prev - 1))}
                    disabled={walkHeightLevel <= 1}
                  >
                    -
                  </button>
                  <span className={styles.walkLabel}>Height</span>
                </div>
              </div>
            ) : viewMode === 'fly' ? (
              <div className={styles.walkPad}>
                <div className={styles.walkSpeed}>
                  <button
                    type="button"
                    className={styles.walkSpeedBtn}
                    onClick={() => adjustWalkSpeed(walkSpeed + 1)}
                    disabled={walkSpeed >= 10}
                  >
                    +
                  </button>
                  <div className={styles.walkSpeedValue}>{walkSpeed}</div>
                  <button
                    type="button"
                    className={styles.walkSpeedBtn}
                    onClick={() => adjustWalkSpeed(walkSpeed - 1)}
                    disabled={walkSpeed <= 1}
                  >
                    -
                  </button>
                  <span className={styles.walkLabel}>Speed</span>
                </div>
                <div className={styles.walkArrows}>
                  <button
                    type="button"
                    className={styles.walkBtn}
                    onPointerDown={() => updateWalkInput(0, 1)}
                    onPointerUp={() => updateWalkInput(0, 0)}
                    onPointerLeave={() => updateWalkInput(0, 0)}
                  >
                    <FiArrowUp />
                  </button>
                  <div className={styles.walkRow}>
                    <button
                      type="button"
                      className={styles.walkBtn}
                      onPointerDown={() => updateWalkInput(-1, 0)}
                      onPointerUp={() => updateWalkInput(0, 0)}
                      onPointerLeave={() => updateWalkInput(0, 0)}
                    >
                      <FiArrowLeft />
                    </button>
                    <button
                      type="button"
                      className={styles.walkBtn}
                      onPointerDown={() => updateWalkInput(1, 0)}
                      onPointerUp={() => updateWalkInput(0, 0)}
                      onPointerLeave={() => updateWalkInput(0, 0)}
                    >
                      <FiArrowRight />
                    </button>
                  </div>
                  <button
                    type="button"
                    className={styles.walkBtn}
                    onPointerDown={() => updateWalkInput(0, -1)}
                    onPointerUp={() => updateWalkInput(0, 0)}
                    onPointerLeave={() => updateWalkInput(0, 0)}
                  >
                    <FiArrowDown />
                  </button>
                </div>
                <div className={styles.walkHeight}>
                  <button
                    type="button"
                    className={styles.walkSpeedBtn}
                    onClick={() => setFlyHeightLevel((prev) => Math.min(5, prev + 1))}
                    disabled={flyHeightLevel >= 5}
                  >
                    +
                  </button>
                  <div className={styles.walkSpeedValue}>{flyHeightLevel * 10}</div>
                  <button
                    type="button"
                    className={styles.walkSpeedBtn}
                    onClick={() => setFlyHeightLevel((prev) => Math.max(1, prev - 1))}
                    disabled={flyHeightLevel <= 1}
                  >
                    -
                  </button>
                  <span className={styles.walkLabel}>Height</span>
                </div>
              </div>
            ) : null}
          </div>
          <div className={styles.modeButtons}>
            <button
              type="button"
              className={`${styles.modeButton} ${viewMode === 'select' ? styles.modeButtonActive : ''}`.trim()}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => setViewMode('select')}
            >
              <FiMousePointer />
              Select
            </button>
            <button
              type="button"
              className={`${styles.modeButton} ${viewMode === 'walk' ? styles.modeButtonActive : ''}`.trim()}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => setViewMode('walk')}
            >
              <FiMap />
              Walk
            </button>
            <button
              type="button"
              className={`${styles.modeButton} ${viewMode === 'fly' ? styles.modeButtonActive : ''}`.trim()}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => setViewMode('fly')}
            >
              <FiNavigation />
              Fly
            </button>
          </div>
        </div>

        {menuOpen ? (
          <button
            type="button"
            className={styles.menuScrim}
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          />
        ) : null}

        <div className={styles.menuButton}>
          <button
            type="button"
            className={styles.menuTrigger}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            <FiMoreHorizontal />
          </button>
          {menuOpen ? (
            <div className={styles.menuPanel}>
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  clearSelection();
                  setAssetPanelOpen(false);
                  setMenuOpen(false);
                  setPanelMode('create');
                  setPanelOpen(true);
                }}
              >
                Create
              </button>
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  setAssetPanelOpen(false);
                  setMenuOpen(false);
                  setPanelMode('scene');
                  setPanelOpen(true);
                }}
              >
                Scene
              </button>
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  setAssetPanelOpen(false);
                  setMenuOpen(false);
                  setPanelMode('frozen');
                  setPanelOpen(true);
                }}
              >
                Frozen
              </button>
            </div>
          ) : null}
        </div>

        {panelOpen ? (
          <button type="button" className={styles.panelScrim} onClick={closePanel} aria-label="Close panel" />
        ) : null}

        {assetPanelOpen ? (
          <button
            type="button"
            className={styles.panelScrim}
            onClick={() => setAssetPanelOpen(false)}
            aria-label="Close assets"
          />
        ) : null}

        <div className={`${styles.overlayPanel} ${panelOpen ? styles.panelOpen : ''}`.trim()}>
          {panelMode === 'scene' ? (
            <form className={styles.panelBody} onSubmit={saveScene}>
              <div className={styles.panelHeader}>
                <h3>Scene settings</h3>
                <button type="button" className={styles.panelClose} onClick={closePanel}>
                  Close
                </button>
              </div>

              <div className={styles.inputGrid}>
                <div className={styles.inputRow}>
                  <label htmlFor="scene-unit">Unit</label>
                  <select
                    id="scene-unit"
                    value={sceneForm.unit}
                    onChange={(event) => {
                      onSceneChange('unit')(event);
                      autoSaveSceneField('unit', event.target.value);
                    }}
                  >
                    <option value="m">Meters</option>
                    <option value="ft">Feet</option>
                  </select>
                </div>
                <div className={styles.inputRow}>
                  <label htmlFor="scene-floor-width">Floor width ({unitLabel})</label>
                  <input
                    id="scene-floor-width"
                    type="number"
                    step="1"
                    value={sceneForm.floorWidth}
                    onChange={onSceneChange('floorWidth')}
                    onBlur={(event) => autoSaveSceneField('floorWidth', event.target.value)}
                  />
                </div>
                <div className={styles.inputRow}>
                  <label htmlFor="scene-floor-depth">Floor depth ({unitLabel})</label>
                  <input
                    id="scene-floor-depth"
                    type="number"
                    step="1"
                    value={sceneForm.floorDepth}
                    onChange={onSceneChange('floorDepth')}
                    onBlur={(event) => autoSaveSceneField('floorDepth', event.target.value)}
                  />
                </div>
                <div className={styles.inputRow}>
                  <label htmlFor="scene-floor-color">Floor color</label>
                  <input
                    id="scene-floor-color"
                    type="text"
                    value={sceneForm.floorColor}
                    onChange={onSceneChange('floorColor')}
                    onBlur={(event) => autoSaveSceneField('floorColor', event.target.value)}
                  />
                </div>
                <div className={styles.inputRow}>
                  <label htmlFor="scene-ambient">Ambient intensity</label>
                  <input
                    id="scene-ambient"
                    type="number"
                    step="0.1"
                    value={sceneForm.ambientIntensity}
                    onChange={onSceneChange('ambientIntensity')}
                    onBlur={(event) => autoSaveSceneField('ambientIntensity', event.target.value)}
                  />
                </div>
                <div className={styles.inputRow}>
                  <label htmlFor="scene-key-intensity">Key light intensity</label>
                  <input
                    id="scene-key-intensity"
                    type="number"
                    step="0.1"
                    value={sceneForm.keyIntensity}
                    onChange={onSceneChange('keyIntensity')}
                    onBlur={(event) => autoSaveSceneField('keyIntensity', event.target.value)}
                  />
                </div>
                <div className={styles.inputRow}>
                  <label htmlFor="scene-key-x">Key light X</label>
                  <input
                    id="scene-key-x"
                    type="number"
                    step="0.5"
                    value={sceneForm.keyX}
                    onChange={onSceneChange('keyX')}
                    onBlur={(event) => autoSaveSceneField('keyX', event.target.value)}
                  />
                </div>
                <div className={styles.inputRow}>
                  <label htmlFor="scene-key-y">Key light Y</label>
                  <input
                    id="scene-key-y"
                    type="number"
                    step="0.5"
                    value={sceneForm.keyY}
                    onChange={onSceneChange('keyY')}
                    onBlur={(event) => autoSaveSceneField('keyY', event.target.value)}
                  />
                </div>
                <div className={styles.inputRow}>
                  <label htmlFor="scene-key-z">Key light Z</label>
                  <input
                    id="scene-key-z"
                    type="number"
                    step="0.5"
                    value={sceneForm.keyZ}
                    onChange={onSceneChange('keyZ')}
                    onBlur={(event) => autoSaveSceneField('keyZ', event.target.value)}
                  />
                </div>
                <div className={styles.inputRow}>
                  <label htmlFor="scene-floor-texture">Floor texture URL</label>
                  <input
                    id="scene-floor-texture"
                    type="text"
                    value={sceneForm.floorTextureUrl}
                    onChange={onSceneChange('floorTextureUrl')}
                    onBlur={(event) => autoSaveSceneField('floorTextureUrl', event.target.value)}
                    placeholder="https://..."
                  />
                  <button
                    type="button"
                    className={styles.assetLink}
                    onClick={() => {
                      setAssetKind('texture');
                      setAssetTarget('scene-floor');
                      setAssetReturnMode('scene');
                      setAssetPanelOpen(true);
                      setPanelOpen(false);
                    }}
                  >
                    Browse texture library
                  </button>
                </div>
              </div>
              {error ? <span className={styles.errorText}>{error}</span> : null}
              <div className={styles.formActions}>
                <button type="submit" className={styles.primaryBtn} disabled={saving}>
                  {saving ? 'Saving...' : 'Save scene'}
                </button>
              </div>
            </form>
          ) : panelMode === 'frozen' ? (
            <div className={styles.panelBody}>
              <div className={styles.panelHeader}>
                <h3>Frozen objects</h3>
                <button type="button" className={styles.panelClose} onClick={closePanel}>
                  Close
                </button>
              </div>
              <div className={styles.objectList}>
                {objects.filter((obj) => obj.frozen).length ? (
                  objects.filter((obj) => obj.frozen).map((obj) => (
                    <div key={obj.id} className={styles.objectRow}>
                      <div>
                        <strong>{obj.label || 'Object'}</strong>
                        <span>{obj.id}</span>
                      </div>
                      <div className={styles.objectActions}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedId(obj.id);
                            setPanelMode('edit');
                            setPanelOpen(true);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            pushHistory({
                              type: 'update',
                              objectId: obj.id,
                              before: { ...obj },
                              after: { ...obj, frozen: false },
                            });
                            updateDoc(doc(db, 'shows', showId, 'modules', 'ai3d', 'objects', obj.id), {
                              frozen: false,
                              updatedAt: serverTimestamp(),
                            }).catch(() => {});
                          }}
                        >
                          Unfreeze
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={styles.previewEmpty}>No frozen objects.</div>
                )}
              </div>
            </div>
          ) : (
            <form className={styles.panelBody} onSubmit={saveObject}>
            <div className={styles.panelHeader}>
              <h3>{selectedId ? 'Edit object' : 'Create object'}</h3>
              <button type="button" className={styles.panelClose} onClick={closePanel}>
                Close
              </button>
            </div>

            {panelMode === 'edit' && !selectedId ? (
              <div className={styles.previewEmpty}>Select an object to edit.</div>
            ) : (
              <>
                <div className={styles.inputRow}>
                  <label htmlFor="object-label">Label</label>
                  <input
                    id="object-label"
                    type="text"
                    value={form.label}
                    onChange={onChange('label')}
                    onBlur={(event) => autoSaveField('label', event.target.value)}
                    placeholder="e.g. Trailer 01"
                  />
                </div>
                <div className={styles.inputGrid}>
                  <div className={styles.inputRow}>
                    <label htmlFor="object-width">Width ({unitLabel})</label>
                    <input
                      id="object-width"
                      type="number"
                      step="0.1"
                      value={form.width}
                      onChange={onChange('width')}
                      onBlur={(event) => autoSaveField('width', event.target.value)}
                    />
                  </div>
                  <div className={styles.inputRow}>
                    <label htmlFor="object-height">Height ({unitLabel})</label>
                    <input
                      id="object-height"
                      type="number"
                      step="0.1"
                      value={form.height}
                      onChange={onChange('height')}
                      onBlur={(event) => autoSaveField('height', event.target.value)}
                    />
                  </div>
                  <div className={styles.inputRow}>
                    <label htmlFor="object-depth">Depth ({unitLabel})</label>
                    <input
                      id="object-depth"
                      type="number"
                      step="0.1"
                      value={form.depth}
                      onChange={onChange('depth')}
                      onBlur={(event) => autoSaveField('depth', event.target.value)}
                    />
                  </div>
                  <div className={styles.inputRow}>
                    <label htmlFor="object-rotation">Rotation Y</label>
                    <input
                      id="object-rotation"
                      type="number"
                      step="0.1"
                      value={form.rotationY}
                      onChange={onChange('rotationY')}
                      onBlur={(event) => autoSaveField('rotationY', event.target.value)}
                    />
                  </div>
                  <div className={styles.inputRow}>
                    <label htmlFor="object-pos-x">Position X ({unitLabel})</label>
                    <input
                      id="object-pos-x"
                      type="number"
                      step="0.1"
                      value={form.posX}
                      onChange={onChange('posX')}
                      onBlur={(event) => autoSaveField('posX', event.target.value)}
                    />
                  </div>
                  <div className={styles.inputRow}>
                    <label htmlFor="object-pos-z">Position Z ({unitLabel})</label>
                    <input
                      id="object-pos-z"
                      type="number"
                      step="0.1"
                      value={form.posZ}
                      onChange={onChange('posZ')}
                      onBlur={(event) => autoSaveField('posZ', event.target.value)}
                    />
                  </div>
                </div>
                <div className={styles.inputRow}>
                  <label>Texture</label>
                  <button
                    type="button"
                    className={styles.assetLink}
                    onClick={() => {
                      setAssetKind('texture');
                      setAssetTarget('object-texture');
                      setAssetReturnMode(panelMode);
                      setAssetPanelOpen(true);
                      setPanelOpen(false);
                    }}
                  >
                    Browse texture library
                  </button>
                </div>
                <div className={styles.inputRow}>
                  <label>Detail model (GLB)</label>
                  <button
                    type="button"
                    className={styles.assetLink}
                    onClick={() => {
                      setAssetKind('model');
                      setAssetTarget('object-model');
                      setAssetReturnMode(panelMode);
                      setAssetPanelOpen(true);
                      setPanelOpen(false);
                    }}
                  >
                    Browse model library
                  </button>
                </div>
                <div className={styles.inputRow}>
                  <label htmlFor="object-color">Fallback color</label>
                  <input
                    id="object-color"
                    type="text"
                    value={form.color}
                    onChange={onChange('color')}
                    onBlur={(event) => autoSaveField('color', event.target.value)}
                    placeholder="#d1d5db"
                  />
                </div>
                <label className={styles.checkRow}>
                  <input
                    type="checkbox"
                    checked={form.loadOnStart}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setForm((prev) => ({ ...prev, loadOnStart: checked }));
                      autoSaveField('loadOnStart', checked);
                    }}
                  />
                  <span>Load on start</span>
                </label>
                <label className={styles.checkRow}>
                  <input
                    type="checkbox"
                    checked={form.frozen}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setForm((prev) => ({ ...prev, frozen: checked }));
                      autoSaveField('frozen', checked);
                    }}
                  />
                  <span>Frozen (cannot be selected)</span>
                </label>
                {error ? <span className={styles.errorText}>{error}</span> : null}
                <div className={styles.formActions}>
                  <button type="submit" className={styles.primaryBtn} disabled={saving}>
                    {saving ? 'Saving...' : (selectedId ? 'Update object' : 'Add to scene')}
                  </button>
                  <button type="button" className={styles.secondaryBtn} onClick={addDemoBox} disabled={saving}>
                    Add demo box
                  </button>
                  {selectedId ? (
                    <button
                      type="button"
                      className={styles.dangerBtn}
                      onClick={() => removeObject(selectedId)}
                    >
                      Delete object
                    </button>
                  ) : null}
                </div>
              </>
            )}
          </form>
          )}
        </div>

        <div className={`${styles.overlayPanel} ${assetPanelOpen ? styles.panelOpen : ''}`.trim()}>
          <form className={styles.panelBody} onSubmit={handleAssetUpload}>
            <div className={styles.panelHeader}>
              <h3>Asset library</h3>
              <button type="button" className={styles.panelClose} onClick={() => setAssetPanelOpen(false)}>
                Close
              </button>
            </div>

            <div className={styles.assetTabs}>
              <button
                type="button"
                className={`${styles.assetTab} ${assetKind === 'model' ? styles.assetTabActive : ''}`.trim()}
                onClick={() => setAssetKind('model')}
              >
                Models
              </button>
              <button
                type="button"
                className={`${styles.assetTab} ${assetKind === 'texture' ? styles.assetTabActive : ''}`.trim()}
                onClick={() => setAssetKind('texture')}
              >
                Textures
              </button>
            </div>

            <div className={styles.inputRow}>
              <label htmlFor="asset-search">Search</label>
              <input
                id="asset-search"
                type="text"
                value={assetSearch}
                onChange={(event) => setAssetSearch(event.target.value)}
                placeholder="Search assets"
              />
            </div>

            <div className={styles.assetList}>
              {assetLoading ? (
                <div className={styles.previewEmpty}>Loading...</div>
              ) : assetItems.length ? (
                assetItems.map((asset) => (
                  <button
                    key={asset.path}
                    type="button"
                    className={`${styles.assetItem} ${(() => {
                      if (asset.kind === 'texture') {
                        return assetTarget === 'scene-floor'
                          ? (sceneForm.floorTextureUrl === asset.url ? styles.assetItemActive : '')
                          : (form.textureUrl === asset.url ? styles.assetItemActive : '');
                      }
                      return form.detailModelPath === asset.path ? styles.assetItemActive : '';
                    })()}`.trim()}
                    onClick={() => applyAssetToForm(asset)}
                  >
                    <div className={styles.assetThumb}>
                      {asset.kind === 'texture' ? (
                        <img src={asset.url} alt={asset.displayName} />
                      ) : (
                        <span>GLB</span>
                      )}
                    </div>
                    <div className={styles.assetMeta}>
                      <span className={styles.assetName}>{asset.displayName}</span>
                      <span className={styles.assetPath}>{asset.name}</span>
                    </div>
                  </button>
                ))
              ) : (
                <div className={styles.previewEmpty}>No assets found.</div>
              )}
            </div>

            <div className={styles.assetActions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={clearAssetSelection}
              >
                Clear selection
              </button>
            </div>

            <div className={styles.assetUpload}>
              <h4>Upload new</h4>
              <div className={styles.inputRow}>
                <label htmlFor="asset-name">Name</label>
                <input
                  id="asset-name"
                  type="text"
                  value={assetName}
                  onChange={(event) => setAssetName(event.target.value)}
                  placeholder="e.g. Tree 01"
                />
              </div>
              <div className={styles.inputRow}>
                <label htmlFor="asset-file">File</label>
                <input
                  id="asset-file"
                  type="file"
                  accept={assetKind === 'model' ? '.glb,model/gltf-binary' : 'image/*'}
                  onChange={onAssetFileChange}
                />
              </div>
              <div className={styles.formActions}>
                <button type="submit" className={styles.primaryBtn} disabled={assetLoading}>
                  {assetLoading ? 'Uploading...' : 'Upload asset'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
