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

// Fungsi untuk membuat label teks (Sprite) yang LEBIH BESAR & BOLD
function makeTextSprite(message, x, y, z, color = "white", fontSize = 50) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    // Meningkatkan resolusi canvas agar tulisan tidak pecah saat di-zoom
    canvas.width = 512; 
    canvas.height = 256;
    
    context.font = "Bold " + fontSize + "px Poppins, Arial";
    context.fillStyle = color;
    context.textAlign = "center";
    context.textBaseline = "middle";
    
    // Menambahkan shadow tipis agar teks lebih terbaca di latar gelap
    context.shadowColor = "black";
    context.shadowBlur = 5;
    
    context.fillText(message, 256, 128);
    
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    
    sprite.position.set(x, y, z);
    // Skala disesuaikan agar teks terlihat proporsional namun jelas
    sprite.scale.set(2.5, 1.25, 1); 
    return sprite;
}

function init3D() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // KONFIGURASI ZOOM & NAVIGASI HALUS
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 1.0;
    controls.zoomSpeed = 0.5; // DIKURANGI SENSITIVITASNYA (Default biasanya 1.0)

    // --- NAVIGASI SUMBU & LABEL BOLD ---
    const axesHelper = new THREE.AxesHelper(6); 
    scene.add(axesHelper);

    // Label Sumbu XYZ (Lebih Besar & Jelas)
    scene.add(makeTextSprite("X (East)", 6.8, 0, 0, "#ff4d4d", 55));
    scene.add(makeTextSprite("Y (Zenith)", 0, 6.5, 0, "#4dff4d", 55));
    scene.add(makeTextSprite("Z (South)", 0, 0, 6.8, "#4d4dff", 55));

    // Label 8 Arah Mata Angin
    const rLabel = 5.8;
    const dLabel = rLabel * 0.707;
    
    scene.add(makeTextSprite("UTARA (N)", 0, 0.2, -rLabel, "#00f2fe", 60));
    scene.add(makeTextSprite("SELATAN (S)", 0, 0.2, rLabel, "#00f2fe", 60));
    scene.add(makeTextSprite("TIMUR (E)", rLabel, 0.2, 0, "#ffdd00", 60));
    scene.add(makeTextSprite("BARAT (W)", -rLabel, 0.2, 0, "#ffffff", 60));
    
    // Diagonal (Ukuran sedang)
    scene.add(makeTextSprite("TL", dLabel, 0.2, -dLabel, "#cccccc", 45));
    scene.add(makeTextSprite("BL", -dLabel, 0.2, -dLabel, "#cccccc", 45));
    scene.add(makeTextSprite("TG", dLabel, 0.2, dLabel, "#cccccc", 45));
    scene.add(makeTextSprite("BD", -dLabel, 0.2, dLabel, "#cccccc", 45));

    const gridHelper = new THREE.GridHelper(12, 12, 0x444444, 0x222222);
    scene.add(gridHelper);

    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    scene.add(ambientLight);
    
    const domeGeo = new THREE.SphereGeometry(5, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe, wireframe: true, transparent: true, opacity: 0.12 });
    dome = new THREE.Mesh(domeGeo, domeMat);
    scene.add(dome);

    const sunGeo = new THREE.SphereGeometry(0.4, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    sun = new THREE.Mesh(sunGeo, sunMat);
    scene.add(sun);

    camera.position.set(10, 10, 10);
    controls.update();
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

function updateSunVisual(az, el) {
    const r = 5;
    const phi = (90 - el) * (Math.PI / 180);
    const theta = (az + 180) * (Math.PI / 180);
    sun.position.x = r * Math.sin(phi) * Math.sin(theta);
    sun.position.y = r * Math.cos(phi);
    sun.position.z = r * Math.sin(phi) * Math.cos(theta);
}

function updateSunByTime(date) {
    const totalMinutes = (date.getHours() * 60) + date.getMinutes();
    let dayProgress = (totalMinutes - 360) / 720; 
    if (dayProgress >= 0 && dayProgress <= 1) {
        let el = Math.sin(dayProgress * Math.PI) * 90;
        let az = 90 + (dayProgress * 180);
        updateSunVisual(az, el);
        document.getElementById('valAzimuth').innerText = az.toFixed(2);
        document.getElementById('valElevation').innerText = el.toFixed(2);
    } else {
        updateSunVisual(0, -10); 
    }
}

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

container.addEventListener('click', (event) => {
    if (isRealTimeMode) return;
    const rect = container.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(dome);
    if (intersects.length > 0) {
        const point = intersects[0].point;
        sun.position.copy(point);
        let elevation = Math.asin(point.y / 5) * (180 / Math.PI);
        let azimuth = Math.atan2(point.x, point.z) * (180 / Math.PI);
        if (azimuth < 0) azimuth += 180; 
        document.getElementById('valAzimuth').innerText = azimuth.toFixed(2);
        document.getElementById('valElevation').innerText = elevation.toFixed(2);
    }
});

window.onload = () => { init3D(); initWebSocket(); };
window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
});
