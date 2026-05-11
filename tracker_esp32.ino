#include <WiFi.h>      
#include <ESPAsyncWebServer.h>
#include <AsyncTCP.h>  
#include <ArduinoJson.h>
#include <ESP32Servo.h>

// --- KONFIGURASI WIFI ---
const char* ssid = "NAMA_WIFI_ANDA";
const char* password = "PASSWORD_WIFI_ANDA";

// --- KONFIGURASI PIN ---
const int pinServoAzimuth = 13;   // Servo Horizontal
const int pinServoElevation = 12; // Servo Vertikal
const int pinSensorVolt = 34;     // Input Analog Tegangan (Divider)
const int pinSensorLux = 35;      // Input Analog LDR/Lux

// --- OBJEK & VARIABEL ---
AsyncWebServer server(80);
AsyncWebSocket ws("/ws");
Servo servoAz;
Servo servoEl;

// Variabel Data
float currentAz = 90.0;
float currentEl = 45.0;
bool isManualMode = false;

// --- FUNGSI BROADCAST DATA KE WEBSITE ---
void sendTelemetry() {
  StaticJsonDocument<200> doc;
  doc["type"] = "telemetry";
  doc["az"] = currentAz;
  doc["el"] = currentEl;
  doc["lux"] = analogRead(pinSensorLux) * (100000.0 / 4095.0); // Konversi kasar ke Lux
  doc["volt"] = (analogRead(pinSensorVolt) * 3.3 / 4095.0) * 5.0; // Contoh rumus voltage divider
  
  String jsonString;
  serializeJson(doc, jsonString);
  ws.textAll(jsonString);
}

// --- HANDLER WEBSOCKET (PESAN MASUK) ---
void onEvent(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type,
             void *arg, uint8_t *data, size_t len) {
             
  if (type == WS_EVT_DATA) {
    AwsFrameInfo *info = (AwsFrameInfo*)arg;
    if (info->final && info->index == 0 && info->len == len && info->opcode == WS_OPCODE_TEXT) {
      data[len] = 0;
      StaticJsonDocument<200> doc;
      DeserializationError error = deserializeJson(doc, (char*)data);
      
      if (!error) {
        if (doc.containsKey("az") && doc.containsKey("el")) {
          isManualMode = true;
          currentAz = doc["az"];
          currentEl = doc["el"];
          
          // Gerakkan servo fisik
          servoAz.write(currentAz);
          servoEl.write(currentEl);
          
          Serial.printf("Perintah Manual Diterima: Az:%.2f, El:%.2f\n", currentAz, currentEl);
        }
      }
    }
  }
}

void setup() {
  Serial.begin(115200);

  // Inisialisasi Servo
  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  servoAz.setPeriodHertz(50);
  servoEl.setPeriodHertz(50);
  servoAz.attach(pinServoAzimuth, 500, 2400);
  servoEl.attach(pinServoElevation, 500, 2400);

  // Koneksi WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Terhubung!");
  Serial.print("IP Address ESP32: ");
  Serial.println(WiFi.localIP());

  // Inisialisasi WebSocket
  ws.onEvent(onEvent);
  server.addHandler(&ws);
  server.begin();
}

void loop() {
  static unsigned long lastMsg = 0;
  unsigned long now = millis();

  // Kirim data ke Dashboard setiap 500ms
  if (now - lastMsg > 500) {
    sendTelemetry();
    lastMsg = now;
  }

  // Logika Auto-Tracking Sederhana (Hanya jika tidak dalam mode manual)
  if (!isManualMode) {
    // Di sini masukkan logika perbandingan 4 LDR Anda
    // Contoh: currentAz += 0.5; (simulasi pergerakan)
    // servoAz.write(currentAz);
    // servoEl.write(currentEl);
  }

  ws.cleanupClients();
}