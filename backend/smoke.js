const http = require("http");
const { spawn } = require("child_process");

const PORT = Number(process.env.SMOKE_PORT || 3101);
const BOOT_TIMEOUT_MS = 12_000;
const INSTALL_KEY = "sprint4-install-key";

function fail(message, details) {
  console.error(`Smoke failed: ${message}`);
  if (details) {
    console.error(details);
  }
  process.exit(1);
}

function request(method, path, body, token, extraHeaders) {
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
          ...(extraHeaders || {}),
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
      INSTALL_KEY,
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

    const preInstallStatus = await request("GET", "/setup/status");
    if (preInstallStatus.statusCode !== 200 || preInstallStatus.body.installed !== false) {
      fail("pre-install setup status is invalid", preInstallStatus);
    }

    const deprecatedBootstrap = await request("POST", "/setup/bootstrap", {
      tenant: { code: "deprecated-demo", name: "Deprecated Demo" },
      branch: { code: "deprecated-01", name: "Deprecated Branch" },
      adminUser: {
        fullName: "Deprecated Admin",
        email: "deprecated@safepark.local",
        password: "Deprecated123!",
      },
    });
    if (deprecatedBootstrap.statusCode !== 410 || deprecatedBootstrap.body.code !== "bootstrap_deprecated") {
      fail("deprecated bootstrap endpoint response is invalid", deprecatedBootstrap);
    }

    const installPayload = {
      tenant: { code: "sprint4-demo", name: "Sprint 4 Demo Tenant" },
      branch: {
        code: "izmir-01",
        name: "Izmir Aqua Park",
        profile: { timezone: "Europe/Istanbul", capacity: 5500 },
      },
      adminUser: {
        fullName: "Platform Admin",
        email: "admin@safepark.local",
        password: "Admin123!",
      },
    };

    const installWithWrongKey = await request("POST", "/install", installPayload, null, {
      "x-install-key": "wrong-install-key",
    });
    if (installWithWrongKey.statusCode !== 403 || installWithWrongKey.body.code !== "invalid_install_key") {
      fail("install request with invalid x-install-key must fail", installWithWrongKey);
    }

    const installResponse = await request("POST", "/install", installPayload, null, {
      "x-install-key": INSTALL_KEY,
    });

    if (installResponse.statusCode !== 201 || installResponse.body.installed !== true) {
      fail("install endpoint failed", installResponse);
    }

    const postInstallStatus = await request("GET", "/setup/status");
    if (postInstallStatus.statusCode !== 200 || postInstallStatus.body.installed !== true) {
      fail("post-install setup status is invalid", postInstallStatus);
    }

    const secondInstall = await request("POST", "/install", {
      tenant: { code: "sprint4-demo-2", name: "Should Fail Tenant" },
      branch: {
        code: "izmir-02",
        name: "Should Fail Branch",
      },
      adminUser: {
        fullName: "Should Fail",
        email: "fail@safepark.local",
        password: "FailPass123!",
      },
    }, null, {
      "x-install-key": INSTALL_KEY,
    });

    if (secondInstall.statusCode !== 409 || secondInstall.body.code !== "already_installed") {
      fail("second install must fail with already_installed", secondInstall);
    }

    console.log("Smoke passed: install flow status and idempotency rules are enforced");
  } catch (error) {
    fail(error.message);
  } finally {
    await shutdown();
  }
}

runSmoke();
