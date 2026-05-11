// --- Konfigurasi Dasar Three.js ---
let scene, camera, renderer, sun, dome;
const container = document.getElementById('canvas-container');

// --- Konfigurasi WebSocket ---
// Ganti dengan IP Address ESP32 yang muncul di Serial Monitor
const gateway = `ws://192.168.XX.XX/ws`; 
let socket;

function initWebSocket() {
    console.log('Mencoba menghubungkan ke WebSocket...');
    socket = new WebSocket(gateway);

    socket.onopen = () => {
        console.log('Terhubung ke ESP32');
        document.getElementById('valStatus').innerText = "Online";
        document.getElementById('valStatus').className = "status-online";
    };

    socket.onclose = () => {
        console.log('Koneksi terputus, mencoba menyambung kembali...');
        document.getElementById('valStatus').innerText = "Offline";
        document.getElementById('valStatus').className = "status-offline";
        setTimeout(initWebSocket, 2000); // Reconnect otomatis setiap 2 detik
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === "telemetry") {
            // 1. Update Tampilan Angka di Dashboard
            document.getElementById('valAzimuth').innerText = data.az.toFixed(2);
            document.getElementById('valElevation').innerText = data.el.toFixed(2);
            
            // Cek jika elemen lux dan volt ada di halaman (untuk dashboard.html)
            if(document.getElementById('valLux')) document.getElementById('valLux').innerText = data.lux.toFixed(0);
            if(document.getElementById('valVolt')) document.getElementById('valVolt').innerText = data.volt.toFixed(2);

            // 2. Update Posisi Matahari 3D Berdasarkan Feedback Alat (Jika tidak sedang manual)
            // Ini memastikan visualisasi sesuai dengan posisi asli servo
            updateSunPosition(data.az, data.el);
        }
    };
}

function init3D() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // Pencahayaan
    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    scene.add(ambientLight);
    const light = new THREE.PointLight(0xffffff, 1);
    light.position.set(10, 10, 10);
    scene.add(light);

    // Membuat Dome (Setengah Bola Transparan)
    const domeGeo = new THREE.SphereGeometry(5, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshBasicMaterial({ 
        color: 0x00f2fe, 
        wireframe: true, 
        transparent: true, 
        opacity: 0.15 
    });
    dome = new THREE.Mesh(domeGeo, domeMat);
    scene.add(dome);

    // Membuat Matahari (Bola Kecil Kuning)
    const sunGeo = new THREE.SphereGeometry(0.4, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    sun = new THREE.Mesh(sunGeo, sunMat);
    scene.add(sun);

    // Posisi Kamera
    camera.position.set(8, 6, 8);
    camera.lookAt(0, 0, 0);

    animate();
}

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

// Fungsi untuk menggerakkan bola matahari di 3D berdasarkan sudut
function updateSunPosition(az, el) {
    const r = 5; // radius dome
    const phi = (90 - el) * (Math.PI / 180);
    const theta = (az + 180) * (Math.PI / 180);

    sun.position.x = r * Math.sin(phi) * Math.sin(theta);
    sun.position.y = r * Math.cos(phi);
    sun.position.z = r * Math.sin(phi) * Math.cos(theta);
}

// --- LOGIKA RAYCASTING (Klik Interaktif) ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

container.addEventListener('click', (event) => {
    const rect = container.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(dome);

    if (intersects.length > 0) {
        const point = intersects[0].point;
        
        // Konversi koordinat titik klik ke sudut Azimuth & Elevation
        const r = 5;
        let elevation = Math.asin(point.y / r) * (180 / Math.PI);
        let azimuth = Math.atan2(point.x, point.z) * (180 / Math.PI);

        // Batasi nilai azimuth agar sesuai rentang servo (misal 0-180)
        if (azimuth < 0) azimuth += 180; 

        // 1. Update UI secara instan
        document.getElementById('valAzimuth').innerText = azimuth.toFixed(2);
        document.getElementById('valElevation').innerText = elevation.toFixed(2);
        sun.position.copy(point);

        // 2. Kirim ke ESP32 melalui WebSocket
        if (socket && socket.readyState === WebSocket.OPEN) {
            const msg = JSON.stringify({
                az: parseFloat(azimuth.toFixed(2)),
                el: parseFloat(elevation.toFixed(2))
            });
            socket.send(msg);
            console.log("Sent to ESP32:", msg);
        }
    }
});

// Jalankan fungsi saat halaman dimuat
window.onload = () => {
    init3D();
    initWebSocket();
};

// Handle window resize agar canvas tetap proporsional
window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
});