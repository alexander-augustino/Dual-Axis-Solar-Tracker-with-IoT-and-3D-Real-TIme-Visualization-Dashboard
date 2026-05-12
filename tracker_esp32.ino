#include <WiFi.h>      
#include <ESPAsyncWebServer.h>
#include <AsyncTCP.h>  
#include <ArduinoJson.h>
#include <ESP32Servo.h>

const char* ssid = "NAMA_WIFI_ANDA";
const char* password = "PASSWORD_WIFI_ANDA";

const int pinServoAzimuth = 13;   
const int pinServoElevation = 12; 
const int pinSensorVolt = 34;     
const int pinSensorLux = 35;      

AsyncWebServer server(80);
AsyncWebSocket ws("/ws");
Servo servoAz;
Servo servoEl;

float currentAz = 90.0;
float currentEl = 45.0;
bool isManualMode = false;

void sendTelemetry() {
  StaticJsonDocument<200> doc;
  doc["type"] = "telemetry";
  doc["az"] = currentAz;
  doc["el"] = currentEl;
  doc["lux"] = analogRead(pinSensorLux) * (100000.0 / 4095.0); 
  doc["volt"] = (analogRead(pinSensorVolt) * 3.3 / 4095.0) * 5.0; 
  
  String jsonString;
  serializeJson(doc, jsonString);
  ws.textAll(jsonString);
}

void onEvent(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type,
             void *arg, uint8_t *data, size_t len) {
             
  if (type == WS_EVT_DATA) {
    AwsFrameInfo *info = (AwsFrameInfo*)arg;
    if (info->final && info->index == 0 && info->len == len && info->opcode == WS_OPCODE_TEXT) {
      data[len] = 0;
      StaticJsonDocument<200> doc;
      DeserializationError error = deserializeJson(doc, (char*)data);
      
      if (!error) {
        // Cek jika ada perubahan mode
        if (doc.containsKey("mode")) {
          isManualMode = (doc["mode"] == "manual");
        }

        // Cek perintah koordinat dari klik Dome
        if (doc.containsKey("az") && doc.containsKey("el")) {
          isManualMode = true; 
          currentAz = doc["az"];
          currentEl = doc["el"];
          
          // Konversi Azimuth (-180 ke 180) ke (0 ke 180) untuk servo jika perlu
          // Di sini kita langsung tulis karena mapping 3D kita sudah disesuaikan
          servoAz.write(constrain(currentAz + 90, 0, 180)); // Contoh offset servo
          servoEl.write(constrain(currentEl, 0, 180));
          
          Serial.printf("Klik Diterima -> Gerak ke Az:%.2f, El:%.2f\n", currentAz, currentEl);
        }
      }
    }
  }
}

void setup() {
  Serial.begin(115200);
  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  servoAz.setPeriodHertz(50);
  servoEl.setPeriodHertz(50);
  servoAz.attach(pinServoAzimuth, 500, 2400);
  servoEl.attach(pinServoElevation, 500, 2400);

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\nWiFi Terhubung!");
  Serial.println(WiFi.localIP());

  ws.onEvent(onEvent);
  server.addHandler(&ws);
  server.begin();
}

void loop() {
  static unsigned long lastMsg = 0;
  if (millis() - lastMsg > 500) {
    sendTelemetry();
    lastMsg = millis();
  }

  if (!isManualMode) {
    // Logika LDR Anda di sini
    // servoAz.write(...);
    // servoEl.write(...);
  }
  ws.cleanupClients();
}
