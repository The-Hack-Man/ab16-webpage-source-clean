export type Permission = string;

export type Role = string;

export type CapabilityMap = Record<Permission, Role[]>;

export type AuthContext = {
  userId: string;
  role: string | null;
  permissions?: string[];
};

export function hasPermission(
  ctx: AuthContext,
  permission: Permission,
  capabilities: CapabilityMap,
): boolean {
  if (!ctx.userId) return false;
  const allowedRoles = capabilities[permission] ?? [];
  const userRoles = ctx.permissions && ctx.permissions.length > 0
    ? ctx.permissions
    : (ctx.role ? [ctx.role] : []);
  return userRoles.some((r) => allowedRoles.includes(r));
}
