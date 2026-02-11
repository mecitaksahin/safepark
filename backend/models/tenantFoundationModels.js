"use strict";

const tenantFoundationModels = Object.freeze({
  tenants: {
    primaryKey: "id",
    columns: ["id", "code", "name", "created_at", "updated_at"],
    unique: ["code"],
  },
  branches: {
    primaryKey: "id",
    columns: ["id", "tenant_id", "code", "name", "profile_json", "created_at", "updated_at"],
    uniqueComposite: [["tenant_id", "code"]],
  },
  users: {
    primaryKey: "id",
    columns: [
      "id",
      "tenant_id",
      "branch_id",
      "email",
      "full_name",
      "password_hash",
      "is_active",
      "last_login_at",
      "created_at",
      "updated_at",
    ],
    uniqueComposite: [["tenant_id", "email"]],
  },
  roles: {
    primaryKey: "id",
    columns: ["id", "key", "description", "created_at"],
    unique: ["key"],
  },
  userRoles: {
    primaryKey: ["user_id", "role_id"],
    columns: ["user_id", "role_id", "created_at"],
  },
  auditLogs: {
    primaryKey: "id",
    columns: [
      "id",
      "tenant_id",
      "branch_id",
      "user_id",
      "action",
      "entity_type",
      "entity_id",
      "metadata_json",
      "created_at",
    ],
  },
});

const roleKeys = Object.freeze(["platform_admin", "super_admin", "branch_manager", "operator"]);

module.exports = {
  tenantFoundationModels,
  roleKeys,
};
