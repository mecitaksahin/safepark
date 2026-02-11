const statusEl = document.getElementById("status");
const checkBtn = document.getElementById("checkBtn");

async function checkHealth() {
  statusEl.textContent = "Checking...";

  try {
    const response = await fetch("http://localhost:3001/health");
    if (!response.ok) {
      statusEl.textContent = `Backend error: ${response.status}`;
      return;
    }

    const data = await response.json();
    statusEl.textContent = `Backend status: ${data.status}`;
  } catch (error) {
    statusEl.textContent = "Backend unreachable";
  }
}

checkBtn.addEventListener("click", checkHealth);

