const crypto = require("crypto");
const http = require("http");
const { roleKeys } = require("./models/tenantFoundationModels");

const PORT = Number(process.env.PORT || 3001);
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 8 * 60 * 60 * 1000);

const state = {
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

function sanitizeBootstrapBody(body) {
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

  const tenantCode = String(body.tenant.code || "").trim();
  const tenantName = String(body.tenant.name || "").trim();
  const branchCode = String(body.branch.code || "").trim();
  const branchName = String(body.branch.name || "").trim();
  const adminFullName = String(body.adminUser.fullName || "").trim();
  const adminEmail = normalizeEmail(body.adminUser.email);
  const adminPassword = String(body.adminUser.password || "");

  if (!tenantCode || !tenantName || !branchCode || !branchName || !adminFullName || !adminEmail || !adminPassword) {
    throw createHttpError(400, "Missing required fields in bootstrap payload", "missing_fields");
  }
  if (adminPassword.length < 8) {
    throw createHttpError(400, "Admin password must be at least 8 characters", "weak_password");
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
    adminUser: {
      fullName: adminFullName,
      email: adminEmail,
      password: adminPassword,
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

async function handleBootstrap(req, res) {
  if (state.tenants.length > 0) {
    throw createHttpError(409, "Bootstrap already completed", "bootstrap_already_done");
  }

  const payload = sanitizeBootstrapBody(await readJsonBody(req));

  if (state.users.some((user) => user.email === payload.adminUser.email)) {
    throw createHttpError(409, "Admin email already exists", "email_already_exists");
  }

  ensureRolesSeeded();

  const now = nowIso();
  const tenant = {
    id: nextId("tenant", "ten"),
    code: payload.tenant.code,
    name: payload.tenant.name,
    createdAt: now,
    updatedAt: now,
  };
  state.tenants.push(tenant);

  const branch = {
    id: nextId("branch", "brn"),
    tenantId: tenant.id,
    code: payload.branch.code,
    name: payload.branch.name,
    profile: payload.branch.profile,
    createdAt: now,
    updatedAt: now,
  };
  state.branches.push(branch);

  const adminUser = {
    id: nextId("user", "usr"),
    tenantId: tenant.id,
    branchId: branch.id,
    email: payload.adminUser.email,
    fullName: payload.adminUser.fullName,
    passwordHash: hashPassword(payload.adminUser.password),
    isActive: true,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
  };
  state.users.push(adminUser);
  assignRoleToUser(adminUser.id, "super_admin");

  recordAuditLog({
    tenantId: tenant.id,
    branchId: branch.id,
    userId: adminUser.id,
    action: "setup.bootstrap.completed",
    entityType: "tenant",
    entityId: tenant.id,
    metadata: {
      tenantCode: tenant.code,
      branchCode: branch.code,
      adminEmail: adminUser.email,
    },
  });

  sendJson(res, 201, {
    setupCompleted: true,
    tenant,
    branch: publicBranch(branch),
    adminUser: {
      ...publicUser(adminUser),
      roles: getRoleKeysForUser(adminUser.id),
    },
  });
}

async function handleLogin(req, res) {
  const body = await readJsonBody(req);
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  if (!email || !password) {
    throw createHttpError(400, "`email` and `password` are required", "missing_credentials");
  }

  const user = state.users.find((item) => item.email === email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    recordAuditLog({
      action: "auth.login.failed",
      entityType: "user",
      metadata: { email },
    });
    throw createHttpError(401, "Invalid email or password", "invalid_credentials");
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

  const now = nowIso();
  user.lastLoginAt = now;
  user.updatedAt = now;

  recordAuditLog({
    tenantId: user.tenantId,
    branchId: user.branchId,
    userId: user.id,
    action: "auth.login.success",
    entityType: "user",
    entityId: user.id,
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

function findBranchOrThrow(branchId) {
  const branch = state.branches.find((item) => item.id === branchId);
  if (!branch) {
    throw createHttpError(404, "Branch not found", "branch_not_found");
  }
  return branch;
}

function ensureTenantAccess(auth, branch) {
  if (auth.user.tenantId !== branch.tenantId) {
    throw createHttpError(403, "Forbidden for branch outside tenant", "cross_tenant_forbidden");
  }
}

function handleGetBranchProfile(req, res, branchId) {
  const auth = requireAuth(req, res);
  if (!auth) {
    return;
  }

  const branch = findBranchOrThrow(branchId);
  ensureTenantAccess(auth, branch);

  sendJson(res, 200, {
    branch: publicBranch(branch),
  });
}

async function handleUpdateBranchProfile(req, res, branchId) {
  const auth = requireAuth(req, res);
  if (!auth) {
    return;
  }
  if (!requireRole(res, auth, ["super_admin", "branch_manager"])) {
    return;
  }

  const branch = findBranchOrThrow(branchId);
  ensureTenantAccess(auth, branch);

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
    sendJson(res, 200, { version: "0.3.0" });
    return;
  }

  try {
    if (req.method === "POST" && pathName === "/setup/bootstrap") {
      await handleBootstrap(req, res);
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
