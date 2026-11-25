export const WORKSPACE_ROLES = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];

export const ROLE_WEIGHT = {
  VIEWER: 1,
  MEMBER: 2,
  ADMIN: 3,
  OWNER: 4,
};

export function hasMinRole(actualRole, minRole) {
  return (ROLE_WEIGHT[actualRole] || 0) >= (ROLE_WEIGHT[minRole] || 99);
}
