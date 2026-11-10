# Dự Án Giám Sát Nhiệt Độ & Độ Ẩm (DHT11 & EMQX MQTT)

Ứng dụng Web sử dụng HTML, CSS, JavaScript (thư viện `MQTT.js`) để kết nối tới **EMQX Broker**, đăng ký topic `esp8266/dht11` và hiển thị trực quan thông số Nhiệt độ (°C) và Độ ẩm (%).

---

## 📌 1. Thông Tin Cấu Hình & Lưu Ý Quan Trọng Về Cổng Kết Nối

| Thông số | Giá trị |
| :--- | :--- |
| **Broker Server** | `s1a21d21.ala.asia-southeast1.emqxsl.com` |
| **MQTT Username** | `hanvantrieu` |
| **MQTT Password** | `Hanvantrieu` |
| **MQTT Topic** | `esp8266/dht11` |
| **Định dạng dữ liệu JSON** | `{"temperature":"78.00", "humidity":"78.00"}` |

### ⚠️ Lưu ý kỹ thuật giữa Web và ESP8266:
- **Trên ESP8266 (C++/Arduino)**: Sử dụng cổng **8883** (giao thức TCP MQTTS / SSL bảo mật).
- **Trên Trình duyệt Web (JavaScript)**: Trình duyệt không thể mở kết nối TCP thô mà bắt buộc phải sử dụng **MQTT over WebSockets** (WSS). Trên hệ thống EMQX Cloud, cổng WebSocket SSL mặc định là **8084** với đường dẫn path là `/mqtt` (URL: `wss://s1a21d21.ala.asia-southeast1.emqxsl.com:8084/mqtt`).
- Trong giao diện web đã tích hợp sẵn mục **Cấu hình** cho phép bạn thay đổi Port (8084 hoặc 8083) và Host nếu cần.

---

## 🚀 2. Cách Khởi Chạy Trang Web

Bạn có thể chạy trang web này theo một trong các cách sau:

### Cách 1: Mở trực tiếp
- Nhấp đúp chuột vào file `index.html` để mở trực tiếp trong trình duyệt Chrome, Edge, Firefox, v.v.

### Cách 2: Chạy qua Live Server hoặc Web Server cục bộ (Khuyên dùng)
Nếu máy bạn có Python, NodeJS hoặc tiện ích Live Server trong VS Code:
- **Dùng Python**:
  ```bash
  python -m http.server 3000
  ```
  Sau đó mở trình duyệt truy cập: `http://localhost:3000`
- **Dùng Node.js**:
  ```bash
  npx serve .
  ```

---

## 🛠️ 3. Mã Nguồn Mẫu Cho ESP8266 (Arduino IDE)

Dành cho vi điều khiển ESP8266 đọc cảm biến DHT11 và gửi dữ liệu lên EMQX:

```cpp
#include <ESP8266WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <DHT.h>

// Cấu hình WiFi
const char* ssid = "TEN_WIFI_CUA_BAN";
const char* password = "MAT_KHAU_WIFI";

// Cấu hình EMQX Broker
const char* mqtt_server = "s1a21d21.ala.asia-southeast1.emqxsl.com";
const int mqtt_port = 8883; // Port MQTTS (SSL) cho ESP8266
const char* mqtt_user = "hanvantrieu";
const char* mqtt_pass = "Hanvantrieu";
const char* mqtt_topic = "esp8266/dht11";

#define DHTPIN D4     // Chân kết nối DHT11
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

WiFiClientSecure espClient;
PubSubClient client(espClient);

unsigned long lastMsg = 0;

void setup_wifi() {
  delay(10);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }
}

void reconnect() {
  while (!client.connected()) {
    String clientId = "ESP8266Client-" + String(random(0xffff), HEX);
    if (client.connect(clientId.c_str(), mqtt_user, mqtt_pass)) {
      // Đã kết nối thành công
    } else {
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  dht.begin();
  setup_wifi();

  // Bỏ qua xác thực chứng chỉ SSL nếu không nạp CA Root Cert
  espClient.setInsecure();
  client.setServer(mqtt_server, mqtt_port);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  // Gửi dữ liệu mỗi 5 giây
  unsigned long now = millis();
  if (now - lastMsg > 5000) {
    lastMsg = now;

    float h = dht.readHumidity();
    float t = dht.readTemperature();

    if (!isnan(h) && !isnan(t)) {
      // Đóng gói chuỗi JSON: {"temperature":"xx.xx", "humidity":"yy.yy"}
      char payload[64];
      snprintf(payload, sizeof(payload), "{\"temperature\":\"%.2f\", \"humidity\":\"%.2f\"}", t, h);
      
      client.publish(mqtt_topic, payload);
      Serial.print("Published: ");
      Serial.println(payload);
    }
  }
}
```

---

## ✨ 4. Tính Năng Giao Diện Web
1. **Hiển thị trực quan**: Thẻ đo Nhiệt độ và Độ ẩm lớn, dễ đọc, kèm thanh phần trăm màu sắc biến thiên và nhãn đánh giá trạng thái (Mát mẻ, Nóng, Khô, Ẩm ướt...).
2. **Đèn tín hiệu kết nối**: Hiển thị rõ trạng thái `Đang kết nối` (vàng), `Đã kết nối` (xanh), `Mất kết nối` (đỏ).
3. **Nhật ký tin nhắn (Live Logs)**: Hiển thị toàn bộ gói tin JSON nhận được theo thời gian thực kèm dấu mốc thời gian (timestamp).
4. **Bảng cấu hình linh hoạt**: Nhấn nút **Cấu hình** trên góc phải để đổi port, broker host, topic hoặc gửi thử dữ liệu mẫu (Test) khi chưa có cảm biến thật.

