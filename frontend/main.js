const statusEl = document.getElementById("status");
const lastCheckedEl = document.getElementById("lastChecked");
const checkBtn = document.getElementById("checkBtn");

function setStatus(message, state) {
  statusEl.textContent = message;
  statusEl.classList.remove("status-ok", "status-fail");

  if (state === "ok") {
    statusEl.classList.add("status-ok");
    return;
  }

  if (state === "fail") {
    statusEl.classList.add("status-fail");
  }
}

async function checkHealth() {
  setStatus("Checking...", "neutral");

  try {
    const response = await fetch("http://localhost:3001/health");
    if (!response.ok) {
      setStatus(`Backend error: ${response.status}`, "fail");
      return;
    }

    const data = await response.json();
    if (data.status === "ok") {
      setStatus(`Backend status: ${data.status}`, "ok");
      return;
    }

    setStatus(`Backend status: ${data.status ?? "unknown"}`, "fail");
  } catch (error) {
    setStatus("Backend unreachable", "fail");
  } finally {
    lastCheckedEl.textContent = `Last checked: ${new Date().toLocaleTimeString()}`;
  }
}

checkBtn.addEventListener("click", checkHealth);
