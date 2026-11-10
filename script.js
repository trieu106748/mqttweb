/**
 * Ứng dụng hiển thị Nhiệt độ & Độ ẩm kết nối MQTT Broker (EMQX)
 * Topic: esp8266/dht11
 * JSON format: {"temperature":"78.00", "humidity":"78.00"}
 */

// Biến quản lý MQTT Client
let client = null;

// Các phần tử DOM
const statusIndicator = document.getElementById("statusIndicator");
const statusText = document.getElementById("statusText");
const toggleConfigBtn = document.getElementById("toggleConfigBtn");
const configPanel = document.getElementById("configPanel");

const cfgHostInput = document.getElementById("cfgHost");
const cfgPortInput = document.getElementById("cfgPort");
const cfgPathInput = document.getElementById("cfgPath");
const cfgTopicInput = document.getElementById("cfgTopic");
const cfgUserInput = document.getElementById("cfgUser");
const cfgPassInput = document.getElementById("cfgPass");

const btnConnect = document.getElementById("btnConnect");
const btnDisconnect = document.getElementById("btnDisconnect");
const btnPublishTest = document.getElementById("btnPublishTest");
const btnClearLog = document.getElementById("btnClearLog");

const tempValue = document.getElementById("tempValue");
const tempBadge = document.getElementById("tempBadge");
const tempProgress = document.getElementById("tempProgress");

const humValue = document.getElementById("humValue");
const humBadge = document.getElementById("humBadge");
const humProgress = document.getElementById("humProgress");

const logContent = document.getElementById("logContent");
const lastUpdated = document.getElementById("lastUpdated");
const lblTopic = document.getElementById("lblTopic");

// Toggle hiển thị bảng cấu hình
toggleConfigBtn.addEventListener("click", () => {
  configPanel.classList.toggle("open");
});

// Nút Xóa log
btnClearLog.addEventListener("click", () => {
  logContent.innerHTML = "";
  addLog("Đã xóa toàn bộ nhật ký.", "info");
});

// Hàm ghi log có thời gian
function addLog(msg, type = "info") {
  const timeStr = new Date().toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const div = document.createElement("div");
  div.className = `log-item ${type}`;
  div.innerHTML = `<span class="time">[${timeStr}]</span> ${msg}`;
  logContent.appendChild(div);
  logContent.scrollTop = logContent.scrollHeight;
}

// Cập nhật trạng thái giao diện kết nối
function setConnectionState(state, text) {
  statusIndicator.className = "status-indicator " + state;
  statusText.textContent = text;
}

// Kết nối tới MQTT Broker
function connectMqtt() {
  const host = cfgHostInput.value.trim();
  const port = parseInt(cfgPortInput.value.trim(), 10);
  const path = cfgPathInput.value.trim();
  const topic = cfgTopicInput.value.trim();
  const username = cfgUserInput.value.trim();
  const password = cfgPassInput.value.trim();

  lblTopic.textContent = topic;

  // Ngắt client cũ nếu đang chạy
  if (client) {
    try {
      client.end(true);
    } catch (e) {
      console.warn("Lỗi khi đóng client cũ:", e);
    }
  }

  // Trên trình duyệt web, kết nối MQTT sử dụng WebSockets qua WSS hoặc WS
  // EMQX Cloud mặc định dùng cổng WSS: 8084 (hoặc 8083 cho WS)
  const protocol = port === 8083 ? "ws" : "wss";
  const connectUrl = `${protocol}://${host}:${port}${path.startsWith("/") ? path : "/" + path}`;
  const clientId = "web_client_" + Math.random().toString(16).substring(2, 10);

  setConnectionState("connecting", "Đang kết nối...");
  addLog(`Bắt đầu kết nối đến: <strong>${connectUrl}</strong> (ClientID: ${clientId})`, "info");

  const options = {
    clientId: clientId,
    username: username,
    password: password,
    clean: true,
    connectTimeout: 10000,
    reconnectPeriod: 5000,
  };

  try {
    client = mqtt.connect(connectUrl, options);

    client.on("connect", () => {
      setConnectionState("connected", "Đã kết nối");
      addLog(`Kết nối thành công tới EMQX Broker!`, "success");

      // Đăng ký nhận tin từ topic
      client.subscribe(topic, { qos: 0 }, (err) => {
        if (err) {
          addLog(`Lỗi khi đăng ký topic "${topic}": ${err.message}`, "error");
        } else {
          addLog(`Đã subscribe thành công topic: <strong>${topic}</strong>. Đang đợi dữ liệu...`, "success");
        }
      });
    });

    client.on("message", (recvTopic, payload) => {
      const messageString = payload.toString();
      addLog(`[Topic: ${recvTopic}] Nhận: <code>${messageString}</code>`, "data");

      if (recvTopic === topic) {
        processSensorData(messageString);
      }
    });

    client.on("reconnect", () => {
      setConnectionState("connecting", "Đang thử kết nối lại...");
      addLog("Mất kết nối tạm thời, đang tự động kết nối lại...", "warn");
    });

    client.on("close", () => {
      setConnectionState("", "Đã ngắt kết nối");
      addLog("Kết nối đã đóng.", "info");
    });

    client.on("error", (err) => {
      setConnectionState("", "Lỗi kết nối");
      addLog(`Lỗi MQTT: ${err.message || err}`, "error");
    });
  } catch (error) {
    setConnectionState("", "Lỗi");
    addLog(`Không thể tạo kết nối MQTT: ${error.message}`, "error");
  }
}

// Ngắt kết nối thủ công
function disconnectMqtt() {
  if (client) {
    client.end();
    setConnectionState("", "Đã ngắt kết nối");
    addLog("Đã chủ động ngắt kết nối MQTT.", "info");
  }
}

// Xử lý dữ liệu nhận được từ JSON
function processSensorData(jsonString) {
  try {
    const data = JSON.parse(jsonString);

    // Kiểm tra định dạng: {"temperature":"78.00", "humidity":"78.00"}
    const temp = parseFloat(data.temperature);
    const hum = parseFloat(data.humidity);

    // Cập nhật thời gian
    const now = new Date();
    lastUpdated.textContent = `Cập nhật lần cuối: ${now.toLocaleTimeString("vi-VN")}`;

    // Cập nhật Nhiệt độ
    if (!isNaN(temp)) {
      tempValue.textContent = temp.toFixed(1);

      // Tính phần trăm thang đo nhiệt độ (từ 0°C đến 50°C, nếu cao hơn thì max 100%)
      const tempPercent = Math.min(Math.max((temp / 50) * 100, 0), 100);
      tempProgress.style.width = `${tempPercent}%`;

      // Phân loại nhiệt độ
      if (temp < 20) {
        tempBadge.textContent = "Khá lạnh";
        tempBadge.className = "status-badge cool";
      } else if (temp <= 27) {
        tempBadge.textContent = "Lý tưởng / Dễ chịu";
        tempBadge.className = "status-badge good";
      } else if (temp <= 35) {
        tempBadge.textContent = "Hơi ấm / Bình thường";
        tempBadge.className = "status-badge warm";
      } else {
        tempBadge.textContent = "Nhiệt độ cao";
        tempBadge.className = "status-badge hot";
      }
    }

    // Cập nhật Độ ẩm
    if (!isNaN(hum)) {
      humValue.textContent = hum.toFixed(1);

      // Thang đo độ ẩm 0% - 100%
      const humPercent = Math.min(Math.max(hum, 0), 100);
      humProgress.style.width = `${humPercent}%`;

      // Phân loại độ ẩm
      if (hum < 40) {
        humBadge.textContent = "Không khí khô";
        humBadge.className = "status-badge dry";
      } else if (hum <= 70) {
        humBadge.textContent = "Độ ẩm lý tưởng";
        humBadge.className = "status-badge good";
      } else {
        humBadge.textContent = "Độ ẩm cao / Nồm";
        humBadge.className = "status-badge humid";
      }
    }
  } catch (err) {
    addLog(`Lỗi giải mã chuỗi JSON: ${err.message}`, "error");
  }
}

// Gửi dữ liệu test lên broker
function publishTestData() {
  if (!client || !client.connected) {
    addLog("Chưa kết nối tới broker. Không thể gửi dữ liệu test!", "warn");
    return;
  }

  const topic = cfgTopicInput.value.trim();
  // Tạo giá trị nhiệt độ ngẫu nhiên từ 25.00 đến 35.00, độ ẩm từ 50.00 đến 85.00
  const randomTemp = (Math.random() * 10 + 25).toFixed(2);
  const randomHum = (Math.random() * 35 + 50).toFixed(2);
  const testPayload = JSON.stringify({
    temperature: randomTemp,
    humidity: randomHum
  });

  client.publish(topic, testPayload, { qos: 0 }, (err) => {
    if (err) {
      addLog(`Lỗi khi publish dữ liệu: ${err.message}`, "error");
    } else {
      addLog(`Đã gửi dữ liệu mẫu thành công lên topic "${topic}": <code>${testPayload}</code>`, "success");
    }
  });
}

// Bắt sự kiện các nút kết nối / ngắt kết nối
btnConnect.addEventListener("click", connectMqtt);
btnDisconnect.addEventListener("click", disconnectMqtt);
btnPublishTest.addEventListener("click", publishTestData);

// Tự động kết nối khi tải xong trang web
window.addEventListener("DOMContentLoaded", () => {
  connectMqtt();
});
