const http = require("http");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const { Client } = require("pg");

const PORT = Number(process.env.SMOKE_PORT || 3101);
const DB1_URL = String(process.env.SMOKE_DB1_URL || process.env.DB1_URL || "postgresql://safepark:safepark@localhost:5433/safepark_ops");
const INSTALL_KEY = String(process.env.SMOKE_INSTALL_KEY || "sprint5-install-key");
const BOOT_TIMEOUT_MS = 20_000;
const DB_TIMEOUT_MS = 60_000;
const REPO_ROOT = path.resolve(__dirname, "..");

function fail(message, details) {
  console.error(`Smoke failed: ${message}`);
  if (details) {
    console.error(details);
  }
  process.exit(1);
}

function runCommand(command, args, workdir) {
  const result = spawnSync(command, args, {
    cwd: workdir,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    fail(`command failed: ${command} ${args.join(" ")}`, `${result.stdout || ""}\n${result.stderr || ""}`);
  }
}

function ensureDb1Container() {
  const startExisting = spawnSync("docker", ["start", "safepark-db1"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  if (startExisting.status === 0) {
    return;
  }

  runCommand("docker", ["compose", "up", "-d", "db1"], REPO_ROOT);
}

function request(method, pathName, body, token, extraHeaders) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: "localhost",
        port: PORT,
        path: pathName,
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
            resolve({
              statusCode: res.statusCode,
              body: raw ? JSON.parse(raw) : {},
            });
          } catch (_) {
            reject(new Error(`Invalid JSON from ${method} ${pathName}: ${raw}`));
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

async function waitForHealth(deadlineMs) {
  while (Date.now() < deadlineMs) {
    try {
      const response = await request("GET", "/health");
      if (response.statusCode === 200 && response.body.status === "ok") {
        return;
      }
    } catch (_) {
      // server may not be up yet.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  fail(`backend did not become healthy within ${BOOT_TIMEOUT_MS} ms`);
}

async function waitForDatabase(deadlineMs) {
  while (Date.now() < deadlineMs) {
    const client = new Client({ connectionString: DB1_URL });
    try {
      await client.connect();
      await client.query("SELECT 1");
      await client.end();
      return;
    } catch (_) {
      try {
        await client.end();
      } catch (_) {
        // Ignore connection close errors while retrying.
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  fail(`db1 did not become ready within ${DB_TIMEOUT_MS} ms`, `DB1_URL=${DB1_URL}`);
}

async function resetDatabase() {
  const client = new Client({ connectionString: DB1_URL });
  try {
    await client.connect();
    await client.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
  } finally {
    await client.end();
  }
}

function startBackend() {
  return spawn(process.execPath, ["server.js"], {
    cwd: __dirname,
    env: {
      ...process.env,
      PORT: String(PORT),
      DB1_URL,
      INSTALL_KEY,
    },
    stdio: "inherit",
  });
}

function stopBackend(serverProcess) {
  return new Promise((resolve) => {
    if (!serverProcess || serverProcess.killed) {
      resolve();
      return;
    }

    serverProcess.once("exit", resolve);
    serverProcess.kill("SIGTERM");

    setTimeout(() => {
      if (!serverProcess.killed) {
        serverProcess.kill("SIGKILL");
      }
    }, 1000);
  });
}

async function runSmoke() {
  ensureDb1Container();
  await waitForDatabase(Date.now() + DB_TIMEOUT_MS);
  await resetDatabase();

  let server = null;
  try {
    server = startBackend();
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
      tenant: { code: "sprint5-demo", name: "Sprint 5 Demo Tenant" },
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

    const platformLogin = await request("POST", "/auth/login", {
      tenantCode: "sprint5-demo",
      email: "admin@safepark.local",
      password: "Admin123!",
    });
    if (platformLogin.statusCode !== 200 || !platformLogin.body.accessToken) {
      fail("platform admin login failed", platformLogin);
    }

    const platformToken = platformLogin.body.accessToken;

    const meResponse = await request("GET", "/auth/me", null, platformToken);
    if (
      meResponse.statusCode !== 200 ||
      !Array.isArray(meResponse.body.user.roles) ||
      !meResponse.body.user.roles.includes("platform_admin")
    ) {
      fail("GET /auth/me failed", meResponse);
    }

    const tenantCreateResponse = await request(
      "POST",
      "/tenants",
      {
        tenant: { code: "west-hub", name: "West Hub Tenant" },
        branch: {
          code: "west-01",
          name: "West Main",
          profile: { timezone: "Europe/Istanbul", capacity: 3000 },
        },
        extraBranches: [
          {
            code: "west-02",
            name: "West Annex",
            profile: { timezone: "Europe/Istanbul", capacity: 1800 },
          },
        ],
        adminUser: {
          fullName: "West Manager",
          email: "admin@safepark.local",
          password: "WestPass123!",
          roles: ["branch_manager"],
        },
      },
      platformToken
    );

    if (
      tenantCreateResponse.statusCode !== 201 ||
      !tenantCreateResponse.body.tenant ||
      !Array.isArray(tenantCreateResponse.body.branches) ||
      tenantCreateResponse.body.branches.length !== 2
    ) {
      fail("POST /tenants failed", tenantCreateResponse);
    }

    const westMain = tenantCreateResponse.body.branches.find((item) => item.code === "west-01");
    const westAnnex = tenantCreateResponse.body.branches.find((item) => item.code === "west-02");
    if (!westMain || !westAnnex) {
      fail("tenant creation did not return expected branches", tenantCreateResponse);
    }

    const branchManagerLogin = await request("POST", "/auth/login", {
      tenantCode: "west-hub",
      email: "admin@safepark.local",
      password: "WestPass123!",
    });
    if (branchManagerLogin.statusCode !== 200 || !branchManagerLogin.body.accessToken) {
      fail("branch manager login failed", branchManagerLogin);
    }

    const branchManagerToken = branchManagerLogin.body.accessToken;

    const ownBranchGet = await request("GET", `/parks/${westMain.id}/profile`, null, branchManagerToken);
    if (ownBranchGet.statusCode !== 200) {
      fail("branch_manager could not read own branch", ownBranchGet);
    }

    const otherBranchPut = await request(
      "PUT",
      `/parks/${westAnnex.id}/profile`,
      { name: "Blocked Update" },
      branchManagerToken
    );
    if (otherBranchPut.statusCode !== 403 || otherBranchPut.body.code !== "branch_scope_forbidden") {
      fail("branch_manager should not update other branch", otherBranchPut);
    }

    const ownBranchPut = await request(
      "PUT",
      `/parks/${westMain.id}/profile`,
      {
        name: "West Main Updated",
        profile: { capacity: 3200 },
      },
      branchManagerToken
    );
    if (ownBranchPut.statusCode !== 200 || ownBranchPut.body.branch.profile.capacity !== 3200) {
      fail("branch_manager should update own branch", ownBranchPut);
    }

    await stopBackend(server);
    server = startBackend();
    await waitForHealth(Date.now() + BOOT_TIMEOUT_MS);

    const statusAfterRestart = await request("GET", "/setup/status");
    if (statusAfterRestart.statusCode !== 200 || statusAfterRestart.body.installed !== true) {
      fail("setup status did not persist after restart", statusAfterRestart);
    }

    const loginAfterRestart = await request("POST", "/auth/login", {
      tenantCode: "sprint5-demo",
      email: "admin@safepark.local",
      password: "Admin123!",
    });
    if (loginAfterRestart.statusCode !== 200 || !loginAfterRestart.body.accessToken) {
      fail("login did not persist after restart", loginAfterRestart);
    }

    const secondInstall = await request("POST", "/install", {
      tenant: { code: "should-fail", name: "Should Fail" },
      branch: { code: "fail-01", name: "Should Fail Branch" },
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

    console.log("Smoke passed: PostgreSQL persistence flow is healthy across restart");
  } catch (error) {
    fail(error.message);
  } finally {
    await stopBackend(server);
  }
}

runSmoke();
