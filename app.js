let scene, camera, renderer, sun, dome, controls;
let isRealTimeMode = false; 
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
            // PERBAIKAN: Parsing data secara eksplisit ke tipe Number agar fungsi .toFixed() tidak membuat crash
            const azVal = Number(data.az) || 0;
            const elVal = Number(data.el) || 0;
            const luxVal = Number(data.lux) || 0;
            const voltVal = Number(data.volt) || 0;

            document.getElementById('valAzimuth').innerText = azVal.toFixed(2);
            document.getElementById('valElevation').innerText = elVal.toFixed(2);
            
            if (!isRealTimeMode) updateSunVisual(azVal, elVal);

            // INPUT KE LOG OTOMATIS (Sekarang aman dan langsung tercatat di tabel dashboard)
            updateAutoLog(nowTime, luxVal.toFixed(0), voltVal.toFixed(2), `${azVal.toFixed(0)}/${elVal.toFixed(0)}`);
        }
    };
}

// Fungsi Update Tabel Log Otomatis
function updateAutoLog(time, lux, volt, pos) {
    const body = document.getElementById('autoLogBody');
    if(!body) return;
    const row = body.insertRow(0);
    row.innerHTML = `<td>${time}</td><td>${lux}</td><td>${volt}</td><td>${pos}</td>`;
    if(body.rows.length > 15) body.deleteRow(15);
}

// Fungsi Update Tabel Log Manual
function updateManualLog(time, target) {
    const body = document.getElementById('manualLogBody');
    if(!body) return;
    const row = body.insertRow(0);
    row.style.color = "#ffdd00";
    row.innerHTML = `<td>${time}</td><td>${target}</td><td>Executed</td>`;
    if(body.rows.length > 10) body.deleteRow(10);
}

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
    camera.up.set(0, 0, 1); 
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

    scene.add(makeTextSprite("X (East)", 6.8, 0, 0, "#ff4d4d"));
    scene.add(makeTextSprite("Y (North)", 0, 6.8, 0, "#4dff4d")); 
    scene.add(makeTextSprite("Z (Zenith)", 0, 0, 6.5, "#4d4dff")); 

    const rL = 5.8;
    const dL = rL * 0.707;
    scene.add(makeTextSprite("TIMUR (E)", rL, 0, 0.1, "#ffdd00", 60));
    scene.add(makeTextSprite("BARAT (W)", -rL, 0, 0.1, "#ffffff", 60));
    scene.add(makeTextSprite("UTARA (N)", 0, rL, 0.1, "#00f2fe", 60));
    scene.add(makeTextSprite("SELATAN (S)", 0, -rL, 0.1, "#00f2fe", 60));
    
    const gridHelper = new THREE.GridHelper(12, 12, 0x444444, 0x222222);
    gridHelper.rotation.x = Math.PI / 2; 
    scene.add(gridHelper);

    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    scene.add(ambientLight);
    
    const domeGeo = new THREE.SphereGeometry(5, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe, wireframe: true, transparent: true, opacity: 0.12 });
    dome = new THREE.Mesh(domeGeo, domeMat);
    dome.rotation.x = Math.PI / 2; 
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

function updateSunVisual(az, el) {
    const r = 5;
    const radAz = (az) * (Math.PI / 180);
    const radEl = (el) * (Math.PI / 180);
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
    }
}

// TOGGLE REALTIME MODE
container.addEventListener('dblclick', () => {
    isRealTimeMode = !isRealTimeMode;
    const display = document.getElementById('modeDisplay');
    if(display) {
        display.innerText = isRealTimeMode ? "REAL-TIME (CLOCK BASED)" : "MANUAL / INTERACTIVE";
        display.style.color = isRealTimeMode ? "#ffdd00" : "#00f2fe";
    }
    // Kirim command mode balik ke ESP32
    if(socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ mode: isRealTimeMode ? "auto" : "manual" }));
    }
});

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// CLICK DOME TO COMMAND ESP32
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
        
        // Update Panel
        document.getElementById('valAzimuth').innerText = az.toFixed(2);
        document.getElementById('valElevation').innerText = el.toFixed(2);

        // KIRIM DATA KE ESP32
        if(socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: "cmd",
                az: parseFloat(az.toFixed(2)),
                el: parseFloat(el.toFixed(2))
            }));
        }
        
        // Log ke Manual Table
        updateManualLog(new Date().toLocaleTimeString(), `${az.toFixed(1)}° / ${el.toFixed(1)}°`);
    }
});

window.onload = () => { init3D(); initWebSocket(); };
