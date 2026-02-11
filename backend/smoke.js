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
        fullName: "Platform Admin",
        email: "admin@safepark.local",
        password: "Admin123!",
      },
    });
    if (bootstrapResponse.statusCode !== 201 || !bootstrapResponse.body.platformInitialized) {
      fail("bootstrap endpoint failed", bootstrapResponse);
    }

    const tenant1Login = await request("POST", "/auth/login", {
      tenantCode: "sprint3-demo",
      email: "admin@safepark.local",
      password: "Admin123!",
    });
    if (tenant1Login.statusCode !== 200 || !tenant1Login.body.accessToken) {
      fail("tenant scoped login for bootstrap tenant failed", tenant1Login);
    }

    const platformToken = tenant1Login.body.accessToken;
    const tenant1BranchId = bootstrapResponse.body.branch.id;

    const meResponse = await request("GET", "/auth/me", null, platformToken);
    if (
      meResponse.statusCode !== 200 ||
      !Array.isArray(meResponse.body.user.roles) ||
      !meResponse.body.user.roles.includes("platform_admin")
    ) {
      fail("/auth/me endpoint failed", meResponse);
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

    const tenant2Login = await request("POST", "/auth/login", {
      tenantCode: "west-hub",
      email: "admin@safepark.local",
      password: "WestPass123!",
    });
    if (tenant2Login.statusCode !== 200 || !tenant2Login.body.accessToken) {
      fail("tenant scoped login for second tenant failed", tenant2Login);
    }

    const wrongTenantPassword = await request("POST", "/auth/login", {
      tenantCode: "west-hub",
      email: "admin@safepark.local",
      password: "Admin123!",
    });
    if (wrongTenantPassword.statusCode !== 401) {
      fail("tenant scoped login should fail with wrong tenant-scoped password", wrongTenantPassword);
    }

    const branchManagerToken = tenant2Login.body.accessToken;

    const ownBranchGet = await request("GET", `/parks/${westMain.id}/profile`, null, branchManagerToken);
    if (ownBranchGet.statusCode !== 200) {
      fail("branch_manager could not read own branch", ownBranchGet);
    }

    const otherBranchGet = await request("GET", `/parks/${westAnnex.id}/profile`, null, branchManagerToken);
    if (otherBranchGet.statusCode !== 403 || otherBranchGet.body.code !== "branch_scope_forbidden") {
      fail("branch_manager should not read other branch profile", otherBranchGet);
    }

    const otherBranchUpdate = await request(
      "PUT",
      `/parks/${westAnnex.id}/profile`,
      {
        name: "West Annex Updated",
        profile: { capacity: 1900 },
      },
      branchManagerToken
    );
    if (otherBranchUpdate.statusCode !== 403 || otherBranchUpdate.body.code !== "branch_scope_forbidden") {
      fail("branch_manager should not update other branch profile", otherBranchUpdate);
    }

    const ownBranchUpdate = await request(
      "PUT",
      `/parks/${westMain.id}/profile`,
      {
        name: "West Main Updated",
        profile: { capacity: 3200 },
      },
      branchManagerToken
    );
    if (ownBranchUpdate.statusCode !== 200 || ownBranchUpdate.body.branch.profile.capacity !== 3200) {
      fail("branch_manager should update own branch profile", ownBranchUpdate);
    }

    const bootstrapBranchUpdate = await request(
      "PUT",
      `/parks/${tenant1BranchId}/profile`,
      {
        name: "Izmir Aqua Park North",
        profile: {
          timezone: "Europe/Istanbul",
          capacity: 6000,
          contactEmail: "north@safepark.local",
        },
      },
      platformToken
    );
    if (bootstrapBranchUpdate.statusCode !== 200 || bootstrapBranchUpdate.body.branch.profile.capacity !== 6000) {
      fail("super_admin update on same tenant branch failed", bootstrapBranchUpdate);
    }

    console.log("Smoke passed: tenant-scoped login and branch-manager branch boundaries are enforced");
  } catch (error) {
    fail(error.message);
  } finally {
    await shutdown();
  }
}

runSmoke();
