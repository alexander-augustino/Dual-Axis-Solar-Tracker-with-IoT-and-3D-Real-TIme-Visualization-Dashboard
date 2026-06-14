let scene, camera, renderer, sun, dome, controls;
// Variabel status kontrol: 'ldr' (default), 'manual' (klik kubah), atau 'clock' (double click)
let currentControlMode = 'ldr'; 
const container = document.getElementById('canvas-container');

const gateway = `ws://192.168.102.82/ws`; 
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
        const nowTime = new Date().toLocaleTimeString();

        if (data.type === "telemetry") {
            // Parsing data secara eksplisit ke tipe Number agar aman dari crash fungsi .toFixed()
            const azVal = Number(data.az) || 0;
            const elVal = Number(data.el) || 0;
            const luxVal = Number(data.lux) || 0;
            const voltVal = Number(data.volt) || 0;

            // Selalu update teks indikator angka angka di dashboard panel
            document.getElementById('valAzimuth').innerText = azVal.toFixed(2);
            document.getElementById('valElevation').innerText = elVal.toFixed(2);
            
            // LOGIKA UTAMA: Visualisasi kubah hanya mengikuti LDR ESP32 jika mode sedang di posisi 'ldr'
            if (currentControlMode === 'ldr') {
                updateSunVisual(azVal, elVal);
            }

            // INPUT DATA MASUK KE LOG TABEL OTOMATIS
            updateAutoLog(nowTime, luxVal.toFixed(0), voltVal.toFixed(2), `${azVal.toFixed(0)}/${elVal.toFixed(0)}`);
        }
    };
}

// Fungsi Update Tabel Log Otomatis (Data Masuk Berkala)
function updateAutoLog(time, lux, volt, pos) {
    const body = document.getElementById('autoLogBody');
    if(!body) return;
    const row = body.insertRow(0);
    row.innerHTML = `<td>${time}</td><td>${lux}</td><td>${volt}</td><td>${pos}</td>`;
    if(body.rows.length > 15) body.deleteRow(15);
}

// Fungsi Update Tabel Log Manual (Saat Diklik)
function updateManualLog(time, target) {
    const body = document.getElementById('manualLogBody');
    if(!body) return;
    const row = body.insertRow(0);
    row.style.color = "#ffdd00";
    row.innerHTML = `<td>${time}</td><td>${target}</td><td>Executed</td>`;
    if(body.rows.length > 10) body.deleteRow(10);
}

// Membuat Teks Label Sumbu Komputer (Hologram Teks)
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
    camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.up.set(0, 0, 1); // Mengunci koordinat Z sebagai sumbu vertikal atas (Zenith)
    camera.position.set(10, -10, 10);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.zoomSpeed = 0.5;

    const axesHelper = new THREE.AxesHelper(6); 
    scene.add(axesHelper);

    // Penunjuk Arah Sumbu Grafis Kartesius
    scene.add(makeTextSprite("X (East)", 6.8, 0, 0, "#ff4d4d"));
    scene.add(makeTextSprite("Y (North)", 0, 6.8, 0, "#4dff4d")); 
    scene.add(makeTextSprite("Z (Zenith)", 0, 0, 6.5, "#4d4dff")); 

    // Label Mata Angin Kompas Bumi
    const rL = 5.8;
    scene.add(makeTextSprite("TIMUR (E)", rL, 0, 0.1, "#ffdd00", 60));
    scene.add(makeTextSprite("BARAT (W)", -rL, 0, 0.1, "#ffffff", 60));
    scene.add(makeTextSprite("UTARA (N)", 0, rL, 0.1, "#00f2fe", 60));
    scene.add(makeTextSprite("SELATAN (S)", 0, -rL, 0.1, "#00f2fe", 60));
    
    const gridHelper = new THREE.GridHelper(12, 12, 0x444444, 0x222222);
    gridHelper.rotation.x = Math.PI / 2; 
    scene.add(gridHelper);

    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    scene.add(ambientLight);
    
    // Pembuatan Kubah Hologram Parameter Setengah Bola (Radius = 5)
    const domeGeo = new THREE.SphereGeometry(5, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe, wireframe: true, transparent: true, opacity: 0.12 });
    dome = new THREE.Mesh(domeGeo, domeMat);
    dome.rotation.x = Math.PI / 2; 
    scene.add(dome);

    // Pembuatan Bola Kuning Objek Matahari
    const sunGeo = new THREE.SphereGeometry(0.4, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    sun = new THREE.Mesh(sunGeo, sunMat);
    scene.add(sun);

    animate();
}

function animate() {
    requestAnimationFrame(animate);
    const now = new Date();
    
    if(document.getElementById('localTime')) {
        document.getElementById('localTime').innerText = now.toLocaleTimeString();
    }
    
    // Jika browser sedang dikunci pada mode jam laptop, override posisi matahari dari fungsi waktu
    if (currentControlMode === 'clock') {
        updateSunByTime(now);
    }
    
    controls.update();
    renderer.render(scene, camera);
}

// Mesin Penerjemah Sudut Bumi ke Koordinat Ruang Kartesius 3D
function updateSunVisual(az, el) {
    const r = 5; // Radius kubah
    const radAz = (az) * (Math.PI / 180);
    const radEl = (el) * (Math.PI / 180);
    
    sun.position.x = r * Math.cos(radEl) * Math.sin(radAz);
    sun.position.y = r * Math.cos(radEl) * Math.cos(radAz);
    sun.position.z = r * Math.sin(radEl); 
}

// Fungsi Penghitung Posisi Matahari Berdasarkan Waktu Komputer
function updateSunByTime(date) {
    const totalMinutes = (date.getHours() * 60) + date.getMinutes();
    let dayProgress = (totalMinutes - 360) / 720; // Rentang kalkulasi 12 Jam siang (06:00 - 18:00)
    
    if (dayProgress >= 0 && dayProgress <= 1) {
        let el = Math.sin(dayProgress * Math.PI) * 90;
        let az = 90 + (dayProgress * 180);
        updateSunVisual(az, el);
    } else {
        // PERBAIKAN: Jika malam hari, amankan koordinat bola ke arah Barat Cakrawala (Az: 270, El: 0)
        updateSunVisual(270, 0);
    }
}

// DOUBLE CLICK: Berpindah antara Mode Jaringan LDR (Auto) dan Mode Simulasi Waktu Laptop
container.addEventListener('dblclick', () => {
    const display = document.getElementById('modeDisplay');
    
    if (currentControlMode !== 'clock') {
        currentControlMode = 'clock';
        if(display) {
            display.innerText = "REAL-TIME (CLOCK BASED)";
            display.style.color = "#ffdd00";
        }
        // Beri tahu ESP32 untuk berhenti melacak LDR karena web mengambil alih kendali waktu
        if(socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ mode: "manual" }));
        }
    } else {
        // Kembalikan ke mode default LDR otomatis alat
        currentControlMode = 'ldr';
        if(display) {
            display.innerText = "AUTOMATIC (LDR TRACKING)";
            display.style.color = "#4dff4d";
        }
        if(socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ mode: "auto" }));
        }
    }
});

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// SINGLE CLICK: Menembakkan Laser Virtual untuk Mengaktifkan Mode Manual Interaktif Klik Kubah
container.addEventListener('click', (event) => {
    // Abaikan klik jika user sedang berada di dalam penguncian mode jam laptop
    if (currentControlMode === 'clock') return; 
    
    const rect = container.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(dome);
    
    if (intersects.length > 0) {
        // Amankan status kontrol berpindah ke posisi 'manual' akibat interaksi klik kursor
        currentControlMode = 'manual';
        const display = document.getElementById('modeDisplay');
        if(display) {
            display.innerText = "MANUAL / INTERACTIVE";
            display.style.color = "#00f2fe";
        }

        const p = intersects[0].point;
        sun.position.copy(p); // Pindahkan bola matahari ke lokasi klik di frontend
        
        // Hitung invers balik dari koordinat ruang $(X,Y,Z)$ ke derajat sudut bumi
        let el = Math.asin(p.z / 5) * (180 / Math.PI); 
        let az = Math.atan2(p.x, p.y) * (180 / Math.PI);
        if (az < 0) az += 360; // Mengamankan derajat lingkaran agar selalu positif
        
        // Perbarui teks di panel dashboard
        document.getElementById('valAzimuth').innerText = az.toFixed(2);
        document.getElementById('valElevation').innerText = el.toFixed(2);

        // KIRIM COMMAND SUDUT JEJAK BARU KE CHIP ESP32 VIA WEBSOCKET
        if(socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: "cmd",
                az: parseFloat(az.toFixed(2)),
                el: parseFloat(el.toFixed(2))
            }));
        }
        
        // Catat eksekusi manual ke dalam tabel kuning
        updateManualLog(new Date().toLocaleTimeString(), `${az.toFixed(1)}° / ${el.toFixed(1)}°`);
    }
});

// Menjalankan inisialisasi ganda saat window selesai memuat
window.onload = () => { init3D(); initWebSocket(); };
