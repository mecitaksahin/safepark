const crypto = require("crypto");
const http = require("http");
const { roleKeys } = require("./models/tenantFoundationModels");
const { query, withTransaction, runMigrations, closePool } = require("./db/postgres");

const PORT = Number(process.env.PORT || 3001);
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 8 * 60 * 60 * 1000);
const ACCESS_TOKEN_SECRET = String(process.env.ACCESS_TOKEN_SECRET || "safepark-dev-token-secret");

const PLATFORM_ADMIN_ROLE = "platform_admin";
const TENANT_ADMIN_ROLES = new Set(["super_admin", "branch_manager", "operator"]);

const roleDescriptions = {
  platform_admin: "Platform-level administrator",
  super_admin: "Tenant-level super administrator",
  branch_manager: "Branch-level manager",
  operator: "Operational user",
};

function nowIso() {
  return new Date().toISOString();
}

function toIso(value) {
  if (!value) {
    return null;
  }
  return new Date(value).toISOString();
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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-install-key");
}

function createHttpError(statusCode, message, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) {
    error.code = code;
  }
  return error;
}

function normalizePgError(error) {
  if (!error || typeof error !== "object") {
    return error;
  }
  if (error.statusCode) {
    return error;
  }

  if (error.code === "23505") {
    if (error.constraint === "tenants_code_key") {
      return createHttpError(409, "Tenant code already exists", "tenant_code_exists");
    }
    if (error.constraint === "users_tenant_id_email_key") {
      return createHttpError(409, "Email already exists in tenant", "email_already_exists");
    }
    if (error.constraint === "branches_tenant_id_code_key") {
      return createHttpError(409, "Branch code already exists in tenant", "branch_code_exists");
    }
    return createHttpError(409, "Duplicate key", "duplicate_key");
  }

  if (error.code === "22P02") {
    return createHttpError(400, "Invalid identifier format", "invalid_identifier");
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

  const normalized = Array.from(new Set(rawRoles.map((role) => String(role || "").trim().toLowerCase())));

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
  if (new Set(branchCodes).size !== branchCodes.length) {
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

function mapTenant(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapBranch(row) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    code: row.code,
    name: row.name,
    profile: row.profile_json || {},
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapUser(row) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    branchId: row.branch_id,
    email: row.email,
    fullName: row.full_name,
    isActive: row.is_active,
    lastLoginAt: toIso(row.last_login_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapPlatformState(row) {
  return {
    isInstalled: row.is_installed,
    installedAt: toIso(row.installed_at),
    installedTenantId: row.installed_tenant_id,
    installedBranchId: row.installed_branch_id,
    installedUserId: row.installed_user_id,
    updatedAt: toIso(row.updated_at),
  };
}

function encodeBase64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(value) {
  const normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
  const padLength = normalized.length % 4;
  const padded = normalized + (padLength === 0 ? "" : "=".repeat(4 - padLength));
  return Buffer.from(padded, "base64").toString("utf8");
}

function signData(data) {
  return crypto.createHmac("sha256", ACCESS_TOKEN_SECRET).update(data).digest("base64url");
}

function issueAccessToken(userId) {
  const expiresAtMs = Date.now() + SESSION_TTL_MS;
  const payload = {
    sub: userId,
    exp: Math.floor(expiresAtMs / 1000),
  };
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = signData(encodedPayload);
  return {
    token: `${encodedPayload}.${signature}`,
    expiresAtMs,
  };
}

function verifyAccessToken(token) {
  const tokenParts = String(token || "").split(".");
  if (tokenParts.length !== 2) {
    return null;
  }

  const [encodedPayload, signature] = tokenParts;
  const expectedSignature = signData(encodedPayload);
  const expectedBuffer = Buffer.from(expectedSignature);
  const signatureBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== signatureBuffer.length) {
    return null;
  }
  if (!crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(decodeBase64Url(encodedPayload));
  } catch (_) {
    return null;
  }

  if (!payload || typeof payload !== "object" || !payload.sub || !payload.exp) {
    return null;
  }
  if (Math.floor(Date.now() / 1000) >= Number(payload.exp)) {
    return null;
  }

  return payload;
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

function validateInstallKey(req) {
  const configuredInstallKey = String(process.env.INSTALL_KEY || "");
  if (!configuredInstallKey) {
    return;
  }

  const providedInstallKey = String(req.headers["x-install-key"] || "");
  if (!providedInstallKey || providedInstallKey !== configuredInstallKey) {
    throw createHttpError(403, "Invalid install key", "invalid_install_key");
  }
}

async function ensureRolesSeeded(queryable) {
  for (const roleKey of roleKeys) {
    await queryable.query(
      "INSERT INTO roles (key, description) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING",
      [roleKey, roleDescriptions[roleKey] || roleKey]
    );
  }
}

async function getRoleKeysForUser(queryable, userId) {
  const result = await queryable.query(
    `SELECT r.key
     FROM user_roles ur
     INNER JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1
     ORDER BY r.id ASC`,
    [userId]
  );
  return result.rows.map((row) => row.key);
}

async function assignRolesToUser(queryable, userId, rolesToAssign) {
  const uniqueRoles = Array.from(new Set(rolesToAssign));

  const roleCheck = await queryable.query(
    "SELECT key FROM roles WHERE key = ANY($1::text[])",
    [uniqueRoles]
  );
  if (roleCheck.rows.length !== uniqueRoles.length) {
    throw createHttpError(500, "Role seed mismatch", "role_seed_mismatch");
  }

  await queryable.query(
    `INSERT INTO user_roles (user_id, role_id)
     SELECT $1::uuid, r.id
     FROM roles r
     WHERE r.key = ANY($2::text[])
     ON CONFLICT (user_id, role_id) DO NOTHING`,
    [userId, uniqueRoles]
  );
}

async function recordAuditLog(queryable, entry) {
  await queryable.query(
    `INSERT INTO audit_logs (
      tenant_id,
      branch_id,
      user_id,
      action,
      entity_type,
      entity_id,
      metadata_json
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [
      entry.tenantId || null,
      entry.branchId || null,
      entry.userId || null,
      entry.action,
      entry.entityType || null,
      entry.entityId || null,
      JSON.stringify(entry.metadata || {}),
    ]
  );
}

async function getPlatformState(queryable, options = {}) {
  const lockClause = options.forUpdate ? "FOR UPDATE" : "";

  let result = await queryable.query(
    `SELECT
      id,
      is_installed,
      installed_at,
      installed_tenant_id,
      installed_branch_id,
      installed_user_id,
      updated_at
     FROM platform_state
     WHERE id = 1 ${lockClause}`
  );

  if (!result.rows[0]) {
    await queryable.query(
      `INSERT INTO platform_state (
        id,
        is_installed,
        installed_at,
        installed_tenant_id,
        installed_branch_id,
        installed_user_id,
        updated_at
      )
      VALUES (1, FALSE, NULL, NULL, NULL, NULL, NOW())
      ON CONFLICT (id) DO NOTHING`
    );

    result = await queryable.query(
      `SELECT
        id,
        is_installed,
        installed_at,
        installed_tenant_id,
        installed_branch_id,
        installed_user_id,
        updated_at
       FROM platform_state
       WHERE id = 1 ${lockClause}`
    );
  }

  return mapPlatformState(result.rows[0]);
}

async function findTenantByCode(queryable, tenantCode) {
  const result = await queryable.query(
    `SELECT id, code, name, created_at, updated_at
     FROM tenants
     WHERE code = $1
     LIMIT 1`,
    [tenantCode]
  );
  return result.rows[0] ? mapTenant(result.rows[0]) : null;
}

async function findBranchById(queryable, branchId) {
  const result = await queryable.query(
    `SELECT id, tenant_id, code, name, profile_json, created_at, updated_at
     FROM branches
     WHERE id = $1
     LIMIT 1`,
    [branchId]
  );
  return result.rows[0] ? mapBranch(result.rows[0]) : null;
}

async function findUserById(queryable, userId) {
  const result = await queryable.query(
    `SELECT
      id,
      tenant_id,
      branch_id,
      email,
      full_name,
      password_hash,
      is_active,
      last_login_at,
      created_at,
      updated_at
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
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

async function createTenantWithAdmin(queryable, payload, options = {}) {
  const adminRoles = Array.from(new Set(options.adminRoles || ["super_admin"]));

  const tenantInsert = await queryable.query(
    `INSERT INTO tenants (code, name)
     VALUES ($1, $2)
     RETURNING id, code, name, created_at, updated_at`,
    [payload.tenant.code, payload.tenant.name]
  );
  const tenantRow = tenantInsert.rows[0];

  const branches = [];
  const branchInputs = [payload.branch, ...payload.extraBranches];
  for (const branchInput of branchInputs) {
    const branchInsert = await queryable.query(
      `INSERT INTO branches (tenant_id, code, name, profile_json)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING id, tenant_id, code, name, profile_json, created_at, updated_at`,
      [tenantRow.id, branchInput.code, branchInput.name, JSON.stringify(branchInput.profile || {})]
    );
    branches.push(mapBranch(branchInsert.rows[0]));
  }

  const adminUserInsert = await queryable.query(
    `INSERT INTO users (tenant_id, branch_id, email, full_name, password_hash, is_active)
     VALUES ($1, $2, $3, $4, $5, TRUE)
     RETURNING
       id,
       tenant_id,
       branch_id,
       email,
       full_name,
       password_hash,
       is_active,
       last_login_at,
       created_at,
       updated_at`,
    [
      tenantRow.id,
      branches[0].id,
      payload.adminUser.email,
      payload.adminUser.fullName,
      hashPassword(payload.adminUser.password),
    ]
  );
  const adminUserRow = adminUserInsert.rows[0];

  await assignRolesToUser(queryable, adminUserRow.id, adminRoles);

  await recordAuditLog(queryable, {
    tenantId: tenantRow.id,
    branchId: branches[0].id,
    userId: options.actorUserId || adminUserRow.id,
    action: options.action || "tenant.created",
    entityType: "tenant",
    entityId: tenantRow.id,
    metadata: {
      tenantCode: tenantRow.code,
      branchCode: branches[0].code,
      adminEmail: adminUserRow.email,
      adminRoles,
      ...(options.actorMetadata || {}),
    },
  });

  return {
    tenant: mapTenant(tenantRow),
    branches,
    primaryBranch: branches[0],
    adminUser: mapUser(adminUserRow),
    adminRoles,
  };
}

async function getAuthContextFromToken(token) {
  const tokenPayload = verifyAccessToken(token);
  if (!tokenPayload) {
    return null;
  }

  const userRow = await findUserById({ query }, tokenPayload.sub);
  if (!userRow || !userRow.is_active) {
    return null;
  }

  const tenantResult = await query(
    `SELECT id, code, name, created_at, updated_at
     FROM tenants
     WHERE id = $1
     LIMIT 1`,
    [userRow.tenant_id]
  );
  if (!tenantResult.rows[0]) {
    return null;
  }

  let branch = null;
  if (userRow.branch_id) {
    const branchResult = await query(
      `SELECT id, tenant_id, code, name, profile_json, created_at, updated_at
       FROM branches
       WHERE id = $1
       LIMIT 1`,
      [userRow.branch_id]
    );
    if (branchResult.rows[0]) {
      branch = mapBranch(branchResult.rows[0]);
    }
  }

  const roles = await getRoleKeysForUser({ query }, userRow.id);

  return {
    user: mapUser(userRow),
    tenant: mapTenant(tenantResult.rows[0]),
    branch,
    roles,
  };
}

async function requireAuth(req, res) {
  const token = parseBearerToken(req.headers.authorization);
  if (!token) {
    sendJson(res, 401, { error: "Unauthorized", code: "missing_bearer_token" });
    return null;
  }

  const context = await getAuthContextFromToken(token);
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

async function handleSetupStatus(req, res) {
  const platformState = await getPlatformState({ query });
  sendJson(res, 200, {
    installed: platformState.isInstalled,
  });
}

async function handleInstall(req, res) {
  validateInstallKey(req);
  const payload = sanitizeTenantProvisionPayload(await readJsonBody(req));

  const created = await withTransaction(async (client) => {
    const platformState = await getPlatformState(client, { forUpdate: true });
    if (platformState.isInstalled) {
      throw createHttpError(409, "Platform is already installed", "already_installed");
    }

    await ensureRolesSeeded(client);

    const tenantCreated = await createTenantWithAdmin(client, payload, {
      adminRoles: ["super_admin", PLATFORM_ADMIN_ROLE],
      action: "setup.install.completed",
    });

    await client.query(
      `UPDATE platform_state
       SET
         is_installed = TRUE,
         installed_at = NOW(),
         installed_tenant_id = $1,
         installed_branch_id = $2,
         installed_user_id = $3,
         updated_at = NOW()
       WHERE id = 1`,
      [tenantCreated.tenant.id, tenantCreated.primaryBranch.id, tenantCreated.adminUser.id]
    );

    return tenantCreated;
  });

  sendJson(res, 201, {
    installed: true,
    tenant: created.tenant,
    branch: created.primaryBranch,
    branches: created.branches,
    adminUser: {
      ...created.adminUser,
      roles: created.adminRoles,
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
  const auth = await requireAuth(req, res);
  if (!auth) {
    return;
  }
  if (!requireRole(res, auth, [PLATFORM_ADMIN_ROLE])) {
    return;
  }

  const payload = sanitizeTenantProvisionPayload(await readJsonBody(req), {
    allowAdminRoleSelection: true,
  });

  const created = await withTransaction(async (client) => {
    const platformState = await getPlatformState(client, { forUpdate: true });
    if (!platformState.isInstalled) {
      throw createHttpError(409, "Platform is not installed yet", "install_required");
    }

    await ensureRolesSeeded(client);

    return createTenantWithAdmin(client, payload, {
      adminRoles: payload.adminUser.roles,
      action: "tenant.created",
      actorUserId: auth.user.id,
      actorMetadata: {
        actorRoles: auth.roles,
        actorTenantId: auth.user.tenantId,
      },
    });
  });

  sendJson(res, 201, {
    tenant: created.tenant,
    branch: created.primaryBranch,
    branches: created.branches,
    adminUser: {
      ...created.adminUser,
      roles: created.adminRoles,
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

  const tenant = await findTenantByCode({ query }, tenantCode);

  let userRow = null;
  if (tenant) {
    const userResult = await query(
      `SELECT
        id,
        tenant_id,
        branch_id,
        email,
        full_name,
        password_hash,
        is_active,
        last_login_at,
        created_at,
        updated_at
       FROM users
       WHERE tenant_id = $1 AND email = $2
       LIMIT 1`,
      [tenant.id, email]
    );
    userRow = userResult.rows[0] || null;
  }

  if (!tenant || !userRow || !verifyPassword(password, userRow.password_hash)) {
    await recordAuditLog({ query }, {
      tenantId: tenant ? tenant.id : null,
      action: "auth.login.failed",
      entityType: "user",
      metadata: { tenantCode, email },
    });
    throw createHttpError(401, "Invalid tenantCode, email or password", "invalid_credentials");
  }

  if (!userRow.is_active) {
    throw createHttpError(403, "User is inactive", "inactive_user");
  }

  await query(
    `UPDATE users
     SET
       last_login_at = NOW(),
       updated_at = NOW()
     WHERE id = $1`,
    [userRow.id]
  );

  const roles = await getRoleKeysForUser({ query }, userRow.id);
  const token = issueAccessToken(userRow.id);

  await recordAuditLog({ query }, {
    tenantId: userRow.tenant_id,
    branchId: userRow.branch_id,
    userId: userRow.id,
    action: "auth.login.success",
    entityType: "user",
    entityId: userRow.id,
    metadata: {
      tenantCode,
    },
  });

  const refreshedUser = await findUserById({ query }, userRow.id);

  sendJson(res, 200, {
    accessToken: token.token,
    tokenType: "Bearer",
    expiresAt: new Date(token.expiresAtMs).toISOString(),
    user: {
      ...mapUser(refreshedUser),
      roles,
    },
  });
}

async function handleMe(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) {
    return;
  }

  sendJson(res, 200, {
    user: {
      ...auth.user,
      roles: auth.roles,
    },
    tenant: auth.tenant,
    branch: auth.branch,
  });
}

async function handleGetBranchProfile(req, res, branchId) {
  const auth = await requireAuth(req, res);
  if (!auth) {
    return;
  }

  const branch = await findBranchById({ query }, branchId);
  if (!branch) {
    throw createHttpError(404, "Branch not found", "branch_not_found");
  }

  ensureBranchProfileAccess(auth, branch);

  sendJson(res, 200, {
    branch,
  });
}

async function handleUpdateBranchProfile(req, res, branchId) {
  const auth = await requireAuth(req, res);
  if (!auth) {
    return;
  }

  const branch = await findBranchById({ query }, branchId);
  if (!branch) {
    throw createHttpError(404, "Branch not found", "branch_not_found");
  }

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
      ...(branch.profile || {}),
      ...cloneJson(payload.profile),
    };
  }

  const updateResult = await query(
    `UPDATE branches
     SET
       name = $2,
       profile_json = $3::jsonb,
       updated_at = NOW()
     WHERE id = $1
     RETURNING id, tenant_id, code, name, profile_json, created_at, updated_at`,
    [branch.id, nextName, JSON.stringify(nextProfile || {})]
  );

  const updatedBranch = mapBranch(updateResult.rows[0]);

  await recordAuditLog({ query }, {
    tenantId: updatedBranch.tenantId,
    branchId: updatedBranch.id,
    userId: auth.user.id,
    action: "branch.profile.updated",
    entityType: "branch",
    entityId: updatedBranch.id,
    metadata: {
      actorRoles: auth.roles,
    },
  });

  sendJson(res, 200, { branch: updatedBranch });
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
    sendJson(res, 200, { version: "0.5.0" });
    return;
  }

  try {
    if (req.method === "GET" && pathName === "/setup/status") {
      await handleSetupStatus(req, res);
      return;
    }

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
      await handleMe(req, res);
      return;
    }

    const branchProfileMatch = pathName.match(/^\/parks\/([^/]+)\/profile$/);
    if (branchProfileMatch && req.method === "GET") {
      await handleGetBranchProfile(req, res, decodeURIComponent(branchProfileMatch[1]));
      return;
    }

    if (branchProfileMatch && req.method === "PUT") {
      await handleUpdateBranchProfile(req, res, decodeURIComponent(branchProfileMatch[1]));
      return;
    }
  } catch (rawError) {
    const error = normalizePgError(rawError);
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

async function startServer() {
  await runMigrations();

  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(PORT, () => {
      server.removeListener("error", reject);
      resolve();
    });
  });

  console.log(`SafePark backend listening on http://localhost:${PORT}`);
  return server;
}

if (require.main === module) {
  startServer().catch(async (error) => {
    console.error("Failed to start backend:", error);
    try {
      await closePool();
    } catch (_) {
      // Ignore shutdown failures on fatal startup path.
    }
    process.exit(1);
  });
}

module.exports = {
  createServer,
  startServer,
};
