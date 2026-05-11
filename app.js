// --- Konfigurasi Dasar Three.js ---
let scene, camera, renderer, sun, dome, controls;
let isRealTimeMode = false; 
const container = document.getElementById('canvas-container');

// --- Konfigurasi WebSocket ---
const gateway = `ws://192.168.XX.XX/ws`; 
let socket;

function initWebSocket() {
    socket = new WebSocket(gateway);
    socket.onopen = () => {
        if(document.getElementById('valStatus')) {
            document.getElementById('valStatus').innerText = "Online";
            document.getElementById('valStatus').className = "status-online";
        }
    };
    socket.onclose = () => {
        if(document.getElementById('valStatus')) {
            document.getElementById('valStatus').innerText = "Offline";
            document.getElementById('valStatus').className = "status-offline";
        }
        setTimeout(initWebSocket, 2000);
    };
    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "telemetry") {
            document.getElementById('valAzimuth').innerText = data.az.toFixed(2);
            document.getElementById('valElevation').innerText = data.el.toFixed(2);
            if (!isRealTimeMode) updateSunVisual(data.az, data.el);
        }
    };
}

// Fungsi membuat label (Sprite) - BOLD & TAJAM
function makeTextSprite(message, x, y, z, color = "white", fontSize = 55) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 512; 
    canvas.height = 256;
    
    context.font = "Bold " + fontSize + "px Poppins, Arial";
    context.fillStyle = color;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.shadowColor = "black";
    context.shadowBlur = 5;
    context.fillText(message, 256, 128);
    
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    
    sprite.position.set(x, y, z);
    sprite.scale.set(2.5, 1.25, 1); 
    return sprite;
}

function init3D() {
    scene = new THREE.Scene();
    
    // Set kamera agar Z adalah arah ATAS
    camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.up.set(0, 0, 1); 
    camera.position.set(10, -10, 10);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // Navigasi Smooth
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.zoomSpeed = 0.5; // Zoom tidak bikin pusing

    // --- NAVIGASI SUMBU (X=Merah, Y=Hijau, Z=Biru) ---
    const axesHelper = new THREE.AxesHelper(6); 
    scene.add(axesHelper);

    // Label LOGIKA TEKNIK: XY = Lantai, Z = Tinggi
    scene.add(makeTextSprite("X (East)", 6.8, 0, 0, "#ff4d4d"));
    scene.add(makeTextSprite("Y (North)", 0, 6.8, 0, "#4dff4d"));
    scene.add(makeTextSprite("Z (Zenith)", 0, 0, 6.5, "#4d4dff"));

    // Label 8 Arah Mata Angin di Bidang XY (Lantai)
    const rL = 5.8;
    const dL = rL * 0.707;
    scene.add(makeTextSprite("TIMUR (E)", rL, 0, 0.1, "#ffdd00", 60));
    scene.add(makeTextSprite("BARAT (W)", -rL, 0, 0.1, "#ffffff", 60));
    scene.add(makeTextSprite("UTARA (N)", 0, rL, 0.1, "#00f2fe", 60));
    scene.add(makeTextSprite("SELATAN (S)", 0, -rL, 0.1, "#00f2fe", 60));
    
    // Diagonal
    scene.add(makeTextSprite("TL", dL, dL, 0.1, "#cccccc", 45));
    scene.add(makeTextSprite("BL", -dL, dL, 0.1, "#cccccc", 45));
    scene.add(makeTextSprite("TG", dL, -dL, 0.1, "#cccccc", 45));
    scene.add(makeTextSprite("BD", -dL, -dL, 0.1, "#cccccc", 45));

    // Grid di lantai (XY)
    const gridHelper = new THREE.GridHelper(12, 12, 0x444444, 0x222222);
    gridHelper.rotation.x = Math.PI / 2; // Rebahkan grid ke bidang XY
    scene.add(gridHelper);

    // Dome & Sun
    const domeGeo = new THREE.SphereGeometry(5, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe, wireframe: true, transparent: true, opacity: 0.1 });
    dome = new THREE.Mesh(domeGeo, domeMat);
    dome.rotation.x = Math.PI / 2; // Putar dome agar mencuat ke arah sumbu Z
    scene.add(dome);

    const sunGeo = new THREE.SphereGeometry(0.4, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    sun = new THREE.Mesh(sunGeo, sunMat);
    scene.add(sun);

    animate();
}

function animate() {
    requestAnimationFrame(animate);
    const now = new Date();
    if(document.getElementById('localTime')) document.getElementById('localTime').innerText = now.toLocaleTimeString();
    if (isRealTimeMode) updateSunByTime(now);
    controls.update();
    renderer.render(scene, camera);
}

// REVISI RUMUS: Sekarang Z adalah Elevation (Tinggi)
function updateSunVisual(az, el) {
    const r = 5;
    const radAz = (az) * (Math.PI / 180);
    const radEl = (el) * (Math.PI / 180);

    // Rumus Kartesius Standar (Z-up)
    sun.position.x = r * Math.cos(radEl) * Math.sin(radAz);
    sun.position.y = r * Math.cos(radEl) * Math.cos(radAz);
    sun.position.z = r * Math.sin(radEl);
}

function updateSunByTime(date) {
    const totalMinutes = (date.getHours() * 60) + date.getMinutes();
    let dayProgress = (totalMinutes - 360) / 720; 
    if (dayProgress >= 0 && dayProgress <= 1) {
        let el = Math.sin(dayProgress * Math.PI) * 90;
        let az = 90 + (dayProgress * 180);
        updateSunVisual(az, el);
    } else {
        updateSunVisual(0, -10); 
    }
}

// Interaksi klik pada dome (XY-Plane logic)
container.addEventListener('click', (event) => {
    if (isRealTimeMode) return;
    const rect = container.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(dome);
    if (intersects.length > 0) {
        const p = intersects[0].point;
        sun.position.copy(p);
        let el = Math.asin(p.z / 5) * (180 / Math.PI);
        let az = Math.atan2(p.x, p.y) * (180 / Math.PI);
        document.getElementById('valAzimuth').innerText = az.toFixed(2);
        document.getElementById('valElevation').innerText = el.toFixed(2);
    }
});

// Sisanya (DblClick, Resize, Load) tetap sama
container.addEventListener('dblclick', () => {
    isRealTimeMode = !isRealTimeMode;
    const display = document.getElementById('modeDisplay');
    if(display) {
        display.innerText = isRealTimeMode ? "REAL-TIME (CLOCK BASED)" : "MANUAL / INTERACTIVE";
        display.style.color = isRealTimeMode ? "#ffdd00" : "#00f2fe";
    }
});
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
window.onload = () => { init3D(); initWebSocket(); };
window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
});
