const crypto = require("crypto");
const http = require("http");
const { roleKeys } = require("./models/tenantFoundationModels");

const PORT = Number(process.env.PORT || 3001);
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 8 * 60 * 60 * 1000);

const PLATFORM_ADMIN_ROLE = "platform_admin";
const TENANT_ADMIN_ROLES = new Set(["super_admin", "branch_manager", "operator"]);

const state = {
  platformState: {
    isInstalled: false,
    installedAt: null,
    installedTenantId: null,
    installedBranchId: null,
    installedUserId: null,
  },
  tenants: [],
  branches: [],
  users: [],
  roles: [],
  userRoles: [],
  auditLogs: [],
  sessions: new Map(),
  sequence: {
    tenant: 1,
    branch: 1,
    user: 1,
    role: 1,
    audit: 1,
  },
};

function nowIso() {
  return new Date().toISOString();
}

function nextId(kind, prefix) {
  const current = state.sequence[kind];
  state.sequence[kind] += 1;
  return `${prefix}_${String(current).padStart(4, "0")}`;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeCode(code) {
  return String(code || "").trim().toLowerCase();
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function createHttpError(statusCode, message, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) {
    error.code = code;
  }
  return error;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let rawBody = "";

    req.on("data", (chunk) => {
      rawBody += chunk;
      if (rawBody.length > 1024 * 1024) {
        reject(createHttpError(413, "Payload too large"));
      }
    });

    req.on("end", () => {
      if (!rawBody) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(rawBody));
      } catch (_) {
        reject(createHttpError(400, "Invalid JSON body", "invalid_json"));
      }
    });

    req.on("error", () => {
      reject(createHttpError(400, "Failed to read request body"));
    });
  });
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, saltedHash) {
  const [salt, storedHash] = String(saltedHash || "").split(":");
  if (!salt || !storedHash) {
    return false;
  }

  const candidateHash = crypto.scryptSync(password, salt, 64).toString("hex");
  const storedBuffer = Buffer.from(storedHash, "hex");
  const candidateBuffer = Buffer.from(candidateHash, "hex");
  if (storedBuffer.length !== candidateBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(storedBuffer, candidateBuffer);
}

function sanitizeProfileInput(profile) {
  if (profile === undefined) {
    return {};
  }

  if (!isPlainObject(profile)) {
    throw createHttpError(400, "`profile` must be an object", "invalid_profile");
  }

  return cloneJson(profile);
}

function sanitizeExtraBranches(extraBranches) {
  if (extraBranches === undefined) {
    return [];
  }
  if (!Array.isArray(extraBranches)) {
    throw createHttpError(400, "`extraBranches` must be an array", "invalid_extra_branches");
  }

  return extraBranches.map((branch, index) => {
    if (!isPlainObject(branch)) {
      throw createHttpError(400, `extraBranches[${index}] must be an object`, "invalid_extra_branch");
    }

    const code = normalizeCode(branch.code);
    const name = String(branch.name || "").trim();
    if (!code || !name) {
      throw createHttpError(400, `extraBranches[${index}] code and name are required`, "missing_extra_branch_fields");
    }

    return {
      code,
      name,
      profile: sanitizeProfileInput(branch.profile),
    };
  });
}

function sanitizeAdminRoles(rawRoles, allowRoleSelection) {
  if (!allowRoleSelection || rawRoles === undefined) {
    return ["super_admin"];
  }

  if (!Array.isArray(rawRoles) || rawRoles.length === 0) {
    throw createHttpError(400, "`adminUser.roles` must be a non-empty array", "invalid_admin_roles");
  }

  const normalized = Array.from(
    new Set(
      rawRoles.map((role) => String(role || "").trim().toLowerCase())
    )
  );

  const invalidRole = normalized.find((role) => !TENANT_ADMIN_ROLES.has(role));
  if (invalidRole) {
    throw createHttpError(400, `Unsupported admin role: ${invalidRole}`, "invalid_admin_role");
  }

  return normalized;
}

function sanitizeTenantProvisionPayload(body, options = {}) {
  const allowAdminRoleSelection = Boolean(options.allowAdminRoleSelection);

  if (!isPlainObject(body)) {
    throw createHttpError(400, "Request body must be an object");
  }
  if (!isPlainObject(body.tenant)) {
    throw createHttpError(400, "`tenant` object is required", "tenant_required");
  }
  if (!isPlainObject(body.branch)) {
    throw createHttpError(400, "`branch` object is required", "branch_required");
  }
  if (!isPlainObject(body.adminUser)) {
    throw createHttpError(400, "`adminUser` object is required", "admin_required");
  }

  const tenantCode = normalizeCode(body.tenant.code);
  const tenantName = String(body.tenant.name || "").trim();
  const branchCode = normalizeCode(body.branch.code);
  const branchName = String(body.branch.name || "").trim();
  const adminFullName = String(body.adminUser.fullName || "").trim();
  const adminEmail = normalizeEmail(body.adminUser.email);
  const adminPassword = String(body.adminUser.password || "");

  if (!tenantCode || !tenantName || !branchCode || !branchName || !adminFullName || !adminEmail || !adminPassword) {
    throw createHttpError(400, "Missing required fields in payload", "missing_fields");
  }
  if (adminPassword.length < 8) {
    throw createHttpError(400, "Admin password must be at least 8 characters", "weak_password");
  }

  const extraBranches = sanitizeExtraBranches(body.extraBranches);
  const branchCodes = [branchCode, ...extraBranches.map((item) => item.code)];
  const uniqueBranchCodes = new Set(branchCodes);
  if (uniqueBranchCodes.size !== branchCodes.length) {
    throw createHttpError(400, "Branch codes must be unique within tenant payload", "duplicate_branch_code");
  }

  return {
    tenant: {
      code: tenantCode,
      name: tenantName,
    },
    branch: {
      code: branchCode,
      name: branchName,
      profile: sanitizeProfileInput(body.branch.profile),
    },
    extraBranches,
    adminUser: {
      fullName: adminFullName,
      email: adminEmail,
      password: adminPassword,
      roles: sanitizeAdminRoles(body.adminUser.roles, allowAdminRoleSelection),
    },
  };
}

function ensureRolesSeeded() {
  const now = nowIso();
  for (const key of roleKeys) {
    if (state.roles.some((role) => role.key === key)) {
      continue;
    }
    state.roles.push({
      id: nextId("role", "rol"),
      key,
      description: key.replace(/_/g, " "),
      createdAt: now,
    });
  }
}

function findTenantByCode(code) {
  return state.tenants.find((tenant) => tenant.code === normalizeCode(code));
}

function assertTenantCodeAvailable(code) {
  if (findTenantByCode(code)) {
    throw createHttpError(409, "Tenant code already exists", "tenant_code_exists");
  }
}

function assertTenantEmailAvailable(tenantId, email) {
  const exists = state.users.some((user) => user.tenantId === tenantId && user.email === email);
  if (exists) {
    throw createHttpError(409, "Email already exists in tenant", "email_already_exists");
  }
}

function assignRoleToUser(userId, roleKey) {
  const role = state.roles.find((item) => item.key === roleKey);
  if (!role) {
    throw createHttpError(500, `Role "${roleKey}" is not seeded`);
  }

  const exists = state.userRoles.some((item) => item.userId === userId && item.roleId === role.id);
  if (!exists) {
    state.userRoles.push({
      userId,
      roleId: role.id,
      createdAt: nowIso(),
    });
  }
}

function getRoleKeysForUser(userId) {
  return state.userRoles
    .filter((item) => item.userId === userId)
    .map((item) => state.roles.find((role) => role.id === item.roleId))
    .filter(Boolean)
    .map((role) => role.key);
}

function recordAuditLog(entry) {
  state.auditLogs.push({
    id: nextId("audit", "adt"),
    tenantId: entry.tenantId || null,
    branchId: entry.branchId || null,
    userId: entry.userId || null,
    action: entry.action,
    entityType: entry.entityType || null,
    entityId: entry.entityId || null,
    metadata: entry.metadata || {},
    createdAt: nowIso(),
  });
}

function publicUser(user) {
  return {
    id: user.id,
    tenantId: user.tenantId,
    branchId: user.branchId,
    email: user.email,
    fullName: user.fullName,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function publicBranch(branch) {
  return {
    id: branch.id,
    tenantId: branch.tenantId,
    code: branch.code,
    name: branch.name,
    profile: branch.profile,
    createdAt: branch.createdAt,
    updatedAt: branch.updatedAt,
  };
}

function createBranch(tenantId, branchInput, timestamp) {
  const branch = {
    id: nextId("branch", "brn"),
    tenantId,
    code: branchInput.code,
    name: branchInput.name,
    profile: branchInput.profile,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  state.branches.push(branch);
  return branch;
}

function createTenantWithAdmin(payload, options = {}) {
  const adminRoles = Array.from(new Set(options.adminRoles || ["super_admin"]));
  const action = options.action || "tenant.created";
  const actorUserId = options.actorUserId || null;
  const actorMetadata = options.actorMetadata || {};

  assertTenantCodeAvailable(payload.tenant.code);

  const timestamp = nowIso();
  const tenant = {
    id: nextId("tenant", "ten"),
    code: payload.tenant.code,
    name: payload.tenant.name,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  state.tenants.push(tenant);

  const primaryBranch = createBranch(tenant.id, payload.branch, timestamp);
  const extraBranches = payload.extraBranches.map((branchInput) => createBranch(tenant.id, branchInput, timestamp));

  assertTenantEmailAvailable(tenant.id, payload.adminUser.email);
  const adminUser = {
    id: nextId("user", "usr"),
    tenantId: tenant.id,
    branchId: primaryBranch.id,
    email: payload.adminUser.email,
    fullName: payload.adminUser.fullName,
    passwordHash: hashPassword(payload.adminUser.password),
    isActive: true,
    lastLoginAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  state.users.push(adminUser);

  for (const roleKey of adminRoles) {
    assignRoleToUser(adminUser.id, roleKey);
  }

  recordAuditLog({
    tenantId: tenant.id,
    branchId: primaryBranch.id,
    userId: actorUserId || adminUser.id,
    action,
    entityType: "tenant",
    entityId: tenant.id,
    metadata: {
      tenantCode: tenant.code,
      branchCode: primaryBranch.code,
      adminEmail: adminUser.email,
      adminRoles,
      ...actorMetadata,
    },
  });

  return {
    tenant,
    branches: [primaryBranch, ...extraBranches],
    primaryBranch,
    adminUser,
    adminRoles,
  };
}

function parseBearerToken(authorizationHeader) {
  if (!authorizationHeader) {
    return "";
  }
  const parts = String(authorizationHeader).trim().split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return "";
  }
  return parts[1];
}

function getAuthContextFromToken(token) {
  const session = state.sessions.get(token);
  if (!session) {
    return null;
  }
  if (session.expiresAtMs <= Date.now()) {
    state.sessions.delete(token);
    return null;
  }

  const user = state.users.find((item) => item.id === session.userId);
  if (!user || !user.isActive) {
    return null;
  }

  const roles = getRoleKeysForUser(user.id);
  const tenant = state.tenants.find((item) => item.id === user.tenantId) || null;
  const branch = state.branches.find((item) => item.id === user.branchId) || null;

  return {
    token,
    user,
    roles,
    tenant,
    branch,
    session,
  };
}

function requireAuth(req, res) {
  const token = parseBearerToken(req.headers.authorization);
  if (!token) {
    sendJson(res, 401, { error: "Unauthorized", code: "missing_bearer_token" });
    return null;
  }

  const context = getAuthContextFromToken(token);
  if (!context) {
    sendJson(res, 401, { error: "Unauthorized", code: "invalid_or_expired_token" });
    return null;
  }

  return context;
}

function requireRole(res, authContext, requiredRoleKeys) {
  const isAllowed = authContext.roles.some((role) => requiredRoleKeys.includes(role));
  if (!isAllowed) {
    sendJson(res, 403, { error: "Forbidden", code: "insufficient_role", requiredRoles: requiredRoleKeys });
    return false;
  }
  return true;
}

function ensureTenantAccess(auth, branch) {
  if (auth.user.tenantId !== branch.tenantId) {
    throw createHttpError(403, "Forbidden for branch outside tenant", "cross_tenant_forbidden");
  }
}

function ensureBranchProfileAccess(auth, branch) {
  ensureTenantAccess(auth, branch);

  if (auth.roles.includes("super_admin")) {
    return;
  }

  if (auth.roles.includes("branch_manager")) {
    if (auth.user.branchId === branch.id) {
      return;
    }
    throw createHttpError(403, "Branch manager can only access own branch", "branch_scope_forbidden");
  }

  throw createHttpError(403, "Forbidden", "insufficient_role");
}

function findBranchOrThrow(branchId) {
  const branch = state.branches.find((item) => item.id === branchId);
  if (!branch) {
    throw createHttpError(404, "Branch not found", "branch_not_found");
  }
  return branch;
}

function markPlatformInstalled(created) {
  state.platformState.isInstalled = true;
  state.platformState.installedAt = nowIso();
  state.platformState.installedTenantId = created.tenant.id;
  state.platformState.installedBranchId = created.primaryBranch.id;
  state.platformState.installedUserId = created.adminUser.id;
}

function handleSetupStatus(req, res) {
  sendJson(res, 200, {
    installed: state.platformState.isInstalled,
  });
}

async function handleInstall(req, res) {
  if (state.platformState.isInstalled) {
    throw createHttpError(409, "Platform is already installed", "already_installed");
  }

  ensureRolesSeeded();
  const payload = sanitizeTenantProvisionPayload(await readJsonBody(req));

  const created = createTenantWithAdmin(payload, {
    adminRoles: ["super_admin", PLATFORM_ADMIN_ROLE],
    action: "setup.install.completed",
  });

  markPlatformInstalled(created);

  sendJson(res, 201, {
    installed: true,
    tenant: created.tenant,
    branch: publicBranch(created.primaryBranch),
    branches: created.branches.map(publicBranch),
    adminUser: {
      ...publicUser(created.adminUser),
      roles: getRoleKeysForUser(created.adminUser.id),
    },
  });
}

function handleBootstrapDeprecated(req, res) {
  sendJson(res, 410, {
    error: "Endpoint deprecated",
    code: "bootstrap_deprecated",
    message: "Use POST /install endpoint for initial setup",
    installEndpoint: "/install",
  });
}

async function handleCreateTenant(req, res) {
  if (!state.platformState.isInstalled) {
    throw createHttpError(409, "Platform is not installed yet", "install_required");
  }

  const auth = requireAuth(req, res);
  if (!auth) {
    return;
  }
  if (!requireRole(res, auth, [PLATFORM_ADMIN_ROLE])) {
    return;
  }

  ensureRolesSeeded();
  const payload = sanitizeTenantProvisionPayload(await readJsonBody(req), {
    allowAdminRoleSelection: true,
  });

  const created = createTenantWithAdmin(payload, {
    adminRoles: payload.adminUser.roles,
    action: "tenant.created",
    actorUserId: auth.user.id,
    actorMetadata: {
      actorRoles: auth.roles,
      actorTenantId: auth.user.tenantId,
    },
  });

  sendJson(res, 201, {
    tenant: created.tenant,
    branch: publicBranch(created.primaryBranch),
    branches: created.branches.map(publicBranch),
    adminUser: {
      ...publicUser(created.adminUser),
      roles: getRoleKeysForUser(created.adminUser.id),
    },
  });
}

async function handleLogin(req, res) {
  const body = await readJsonBody(req);
  const tenantCode = normalizeCode(body.tenantCode);
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");

  if (!tenantCode || !email || !password) {
    throw createHttpError(400, "`tenantCode`, `email` and `password` are required", "missing_credentials");
  }

  const tenant = findTenantByCode(tenantCode);
  const user = tenant
    ? state.users.find((item) => item.tenantId === tenant.id && item.email === email)
    : null;

  if (!tenant || !user || !verifyPassword(password, user.passwordHash)) {
    recordAuditLog({
      tenantId: tenant ? tenant.id : null,
      action: "auth.login.failed",
      entityType: "user",
      metadata: { tenantCode, email },
    });
    throw createHttpError(401, "Invalid tenantCode, email or password", "invalid_credentials");
  }

  if (!user.isActive) {
    throw createHttpError(403, "User is inactive", "inactive_user");
  }

  const token = crypto.randomBytes(32).toString("hex");
  const issuedAtMs = Date.now();
  const expiresAtMs = issuedAtMs + SESSION_TTL_MS;
  state.sessions.set(token, {
    userId: user.id,
    issuedAtMs,
    expiresAtMs,
  });

  const timestamp = nowIso();
  user.lastLoginAt = timestamp;
  user.updatedAt = timestamp;

  recordAuditLog({
    tenantId: user.tenantId,
    branchId: user.branchId,
    userId: user.id,
    action: "auth.login.success",
    entityType: "user",
    entityId: user.id,
    metadata: {
      tenantCode,
    },
  });

  sendJson(res, 200, {
    accessToken: token,
    tokenType: "Bearer",
    expiresAt: new Date(expiresAtMs).toISOString(),
    user: {
      ...publicUser(user),
      roles: getRoleKeysForUser(user.id),
    },
  });
}

function handleMe(req, res) {
  const auth = requireAuth(req, res);
  if (!auth) {
    return;
  }

  sendJson(res, 200, {
    user: {
      ...publicUser(auth.user),
      roles: auth.roles,
    },
    tenant: auth.tenant,
    branch: auth.branch ? publicBranch(auth.branch) : null,
  });
}

function handleGetBranchProfile(req, res, branchId) {
  const auth = requireAuth(req, res);
  if (!auth) {
    return;
  }

  const branch = findBranchOrThrow(branchId);
  ensureBranchProfileAccess(auth, branch);

  sendJson(res, 200, {
    branch: publicBranch(branch),
  });
}

async function handleUpdateBranchProfile(req, res, branchId) {
  const auth = requireAuth(req, res);
  if (!auth) {
    return;
  }

  const branch = findBranchOrThrow(branchId);
  ensureBranchProfileAccess(auth, branch);

  const payload = await readJsonBody(req);
  if (!isPlainObject(payload)) {
    throw createHttpError(400, "Request body must be an object");
  }

  const nextName = payload.name === undefined ? branch.name : String(payload.name || "").trim();
  if (!nextName) {
    throw createHttpError(400, "`name` cannot be empty when provided", "invalid_name");
  }

  let nextProfile = branch.profile;
  if (payload.profile !== undefined) {
    if (!isPlainObject(payload.profile)) {
      throw createHttpError(400, "`profile` must be an object", "invalid_profile");
    }
    nextProfile = {
      ...branch.profile,
      ...cloneJson(payload.profile),
    };
  }

  branch.name = nextName;
  branch.profile = nextProfile;
  branch.updatedAt = nowIso();

  recordAuditLog({
    tenantId: branch.tenantId,
    branchId: branch.id,
    userId: auth.user.id,
    action: "branch.profile.updated",
    entityType: "branch",
    entityId: branch.id,
    metadata: {
      actorRoles: auth.roles,
    },
  });

  sendJson(res, 200, { branch: publicBranch(branch) });
}

async function handleRequest(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, "http://localhost");
  const pathName = url.pathname;

  if (req.method === "GET" && pathName === "/health") {
    sendJson(res, 200, { status: "ok" });
    return;
  }

  if (req.method === "GET" && pathName === "/version") {
    sendJson(res, 200, { version: "0.4.0" });
    return;
  }

  if (req.method === "GET" && pathName === "/setup/status") {
    handleSetupStatus(req, res);
    return;
  }

  try {
    if (req.method === "POST" && pathName === "/install") {
      await handleInstall(req, res);
      return;
    }

    if (req.method === "POST" && pathName === "/setup/bootstrap") {
      handleBootstrapDeprecated(req, res);
      return;
    }

    if (req.method === "POST" && pathName === "/tenants") {
      await handleCreateTenant(req, res);
      return;
    }

    if (req.method === "POST" && pathName === "/auth/login") {
      await handleLogin(req, res);
      return;
    }

    if (req.method === "GET" && pathName === "/auth/me") {
      handleMe(req, res);
      return;
    }

    const branchProfileMatch = pathName.match(/^\/parks\/([^/]+)\/profile$/);
    if (branchProfileMatch && req.method === "GET") {
      handleGetBranchProfile(req, res, decodeURIComponent(branchProfileMatch[1]));
      return;
    }

    if (branchProfileMatch && req.method === "PUT") {
      await handleUpdateBranchProfile(req, res, decodeURIComponent(branchProfileMatch[1]));
      return;
    }
  } catch (error) {
    if (error.statusCode) {
      sendJson(res, error.statusCode, {
        error: error.message,
        code: error.code || "request_error",
      });
      return;
    }

    console.error("Unhandled backend error:", error);
    sendJson(res, 500, {
      error: "Internal Server Error",
      code: "internal_error",
    });
    return;
  }

  sendJson(res, 404, { error: "Not Found" });
}

function createServer() {
  return http.createServer((req, res) => {
    handleRequest(req, res).catch((error) => {
      console.error("Fatal request error:", error);
      sendJson(res, 500, { error: "Internal Server Error", code: "fatal_request_error" });
    });
  });
}

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, () => {
    console.log(`SafePark backend listening on http://localhost:${PORT}`);
  });
}

module.exports = {
  createServer,
  state,
};
