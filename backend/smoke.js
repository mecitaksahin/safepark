const http = require("http");
const { spawn } = require("child_process");

const PORT = Number(process.env.SMOKE_PORT || 3101);
const BOOT_TIMEOUT_MS = 12_000;

function fail(message, details) {
  console.error(`Smoke failed: ${message}`);
  if (details) {
    console.error(details);
  }
  process.exit(1);
}

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: "localhost",
        port: PORT,
        path,
        method,
        headers: {
          "Content-Type": "application/json",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          try {
            const parsed = raw ? JSON.parse(raw) : {};
            resolve({ statusCode: res.statusCode, body: parsed });
          } catch (_) {
            reject(new Error(`Invalid JSON from ${method} ${path}: ${raw}`));
          }
        });
      }
    );

    req.on("error", reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function waitForHealth(deadline) {
  while (Date.now() < deadline) {
    try {
      const response = await request("GET", "/health");
      if (response.statusCode === 200 && response.body.status === "ok") {
        return;
      }
    } catch (_) {
      // Backend may not be up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  fail(`backend did not become healthy within ${BOOT_TIMEOUT_MS} ms`);
}

async function runSmoke() {
  const server = spawn(process.execPath, ["server.js"], {
    cwd: __dirname,
    env: {
      ...process.env,
      PORT: String(PORT),
    },
    stdio: "inherit",
  });

  const shutdown = () =>
    new Promise((resolve) => {
      if (server.killed) {
        resolve();
        return;
      }

      server.once("exit", resolve);
      server.kill("SIGTERM");
      setTimeout(() => {
        if (!server.killed) {
          server.kill("SIGKILL");
        }
      }, 1000);
    });

  try {
    await waitForHealth(Date.now() + BOOT_TIMEOUT_MS);

    const bootstrapResponse = await request("POST", "/setup/bootstrap", {
      tenant: { code: "sprint3-demo", name: "Sprint 3 Demo Tenant" },
      branch: {
        code: "izmir-01",
        name: "Izmir Aqua Park",
        profile: { timezone: "Europe/Istanbul", capacity: 5500 },
      },
      adminUser: {
        fullName: "Sprint Admin",
        email: "admin@safepark.local",
        password: "Admin123!",
      },
    });
    if (bootstrapResponse.statusCode !== 201 || !bootstrapResponse.body.setupCompleted) {
      fail("bootstrap endpoint failed", bootstrapResponse);
    }

    const loginResponse = await request("POST", "/auth/login", {
      email: "admin@safepark.local",
      password: "Admin123!",
    });
    if (loginResponse.statusCode !== 200 || !loginResponse.body.accessToken) {
      fail("login endpoint failed", loginResponse);
    }
    const accessToken = loginResponse.body.accessToken;
    const branchId = bootstrapResponse.body.branch.id;

    const meResponse = await request("GET", "/auth/me", null, accessToken);
    if (
      meResponse.statusCode !== 200 ||
      meResponse.body.user.email !== "admin@safepark.local" ||
      !Array.isArray(meResponse.body.user.roles) ||
      !meResponse.body.user.roles.includes("super_admin")
    ) {
      fail("/auth/me endpoint failed", meResponse);
    }

    const profileGetResponse = await request("GET", `/parks/${branchId}/profile`, null, accessToken);
    if (
      profileGetResponse.statusCode !== 200 ||
      profileGetResponse.body.branch.code !== "izmir-01" ||
      profileGetResponse.body.branch.profile.timezone !== "Europe/Istanbul"
    ) {
      fail("GET /parks/:branchId/profile endpoint failed", profileGetResponse);
    }

    const profileUpdateResponse = await request(
      "PUT",
      `/parks/${branchId}/profile`,
      {
        name: "Izmir Aqua Park North",
        profile: {
          timezone: "Europe/Istanbul",
          capacity: 6000,
          contactEmail: "north@safepark.local",
        },
      },
      accessToken
    );
    if (
      profileUpdateResponse.statusCode !== 200 ||
      profileUpdateResponse.body.branch.name !== "Izmir Aqua Park North" ||
      profileUpdateResponse.body.branch.profile.capacity !== 6000
    ) {
      fail("PUT /parks/:branchId/profile endpoint failed", profileUpdateResponse);
    }

    console.log("Smoke passed: tenant bootstrap, auth and park profile endpoints are healthy");
  } catch (error) {
    fail(error.message);
  } finally {
    await shutdown();
  }
}

runSmoke();
