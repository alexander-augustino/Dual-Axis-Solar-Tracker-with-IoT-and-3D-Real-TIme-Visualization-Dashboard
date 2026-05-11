// --- Konfigurasi Dasar Three.js ---
let scene, camera, renderer, sun, dome, controls;
let isRealTimeMode = false; 
const container = document.getElementById('canvas-container');

// --- Konfigurasi WebSocket ---
const gateway = `ws://192.168.XX.XX/ws`; 
let socket;

function initWebSocket() {
    console.log('Mencoba menghubungkan ke WebSocket...');
    socket = new WebSocket(gateway);

    socket.onopen = () => {
        console.log('Terhubung ke ESP32');
        if(document.getElementById('valStatus')) {
            document.getElementById('valStatus').innerText = "Online";
            document.getElementById('valStatus').className = "status-online";
        }
    };

    socket.onclose = () => {
        console.log('Koneksi terputus, mencoba menyambung kembali...');
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
            
            if(document.getElementById('valLux')) document.getElementById('valLux').innerText = data.lux.toFixed(0);
            if(document.getElementById('valVolt')) document.getElementById('valVolt').innerText = data.volt.toFixed(2);

            if (!isRealTimeMode) {
                updateSunVisual(data.az, data.el);
            }
        }
    };
}

function init3D() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // --- FITUR: OrbitControls (Optimasi Trackpad) ---
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;       // Efek halus saat berhenti geser
    controls.dampingFactor = 0.08;       // Kelenturan gerakan
    controls.rotateSpeed = 1.2;          // Lebih responsif untuk area sentuh kecil
    controls.zoomSpeed = 1.5;            // Zoom lebih cepat untuk dua jari
    controls.screenSpacePanning = true;  // Memudahkan geser kamera

    // Pencahayaan
    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    scene.add(ambientLight);
    const light = new THREE.PointLight(0xffffff, 1);
    light.position.set(10, 10, 10);
    scene.add(light);

    // Membuat Dome
    const domeGeo = new THREE.SphereGeometry(5, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshBasicMaterial({ 
        color: 0x00f2fe, 
        wireframe: true, 
        transparent: true, 
        opacity: 0.15 
    });
    dome = new THREE.Mesh(domeGeo, domeMat);
    scene.add(dome);

    // Membuat Matahari
    const sunGeo = new THREE.SphereGeometry(0.4, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    sun = new THREE.Mesh(sunGeo, sunMat);
    scene.add(sun);

    camera.position.set(8, 6, 8);
    controls.update();

    animate();
}

function animate() {
    requestAnimationFrame(animate);
    
    const now = new Date();
    if(document.getElementById('localTime')) {
        document.getElementById('localTime').innerText = now.toLocaleTimeString();
    }

    if (isRealTimeMode) {
        updateSunByTime(now);
    }

    controls.update(); // Dibutuhkan oleh enableDamping
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
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const totalMinutes = (hours * 60) + minutes;
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

// --- INTERAKSI KLIK & TOGGLE ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

container.addEventListener('dblclick', () => {
    isRealTimeMode = !isRealTimeMode;
    const display = document.getElementById('modeDisplay');
    if(display) {
        display.innerText = isRealTimeMode ? "REAL-TIME (CLOCK BASED)" : "MANUAL / INTERACTIVE";
        display.style.color = isRealTimeMode ? "#ffdd00" : "#00f2fe";
    }
});

container.addEventListener('click', (event) => {
    if (isRealTimeMode) return;

    const rect = container.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(dome);

    if (intersects.length > 0) {
        const point = intersects[0].point;
        const r = 5;
        let elevation = Math.asin(point.y / r) * (180 / Math.PI);
        let azimuth = Math.atan2(point.x, point.z) * (180 / Math.PI);
        if (azimuth < 0) azimuth += 180; 

        document.getElementById('valAzimuth').innerText = azimuth.toFixed(2);
        document.getElementById('valElevation').innerText = elevation.toFixed(2);
        sun.position.copy(point);

        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                az: parseFloat(azimuth.toFixed(2)),
                el: parseFloat(elevation.toFixed(2))
            }));
        }
    }
});

window.onload = () => {
    init3D();
    initWebSocket();
};

window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
});
