import { Action, Effect, PolicyRule, SC_LAB_RBAC_CONFIG, PERMISSION_POLICIES } from '../config/rbacConfig.js';

export function mapMethodToAction(method: string): Action {
  const m = method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(m)) return 'read';
  if (['POST', 'PUT', 'PATCH'].includes(m)) return 'write';
  if (m === 'DELETE') return 'delete';
  return 'read';
}

export function expandUserRoles(userRole?: string): Set<string> {
  const expanded = new Set<string>();
  if (!userRole) {
    expanded.add('GUEST');
    return expanded;
  }

  // Normalize role string to 4-tier model (MEMBER, COORDINATOR, ADMIN, SUPER_ADMIN)
  let normalizedRole = userRole.toUpperCase();
  if (['USER', 'STUDENT'].includes(normalizedRole)) normalizedRole = 'MEMBER';
  if (['LAB_MANAGER', 'RESEARCHER'].includes(normalizedRole)) normalizedRole = 'COORDINATOR';

  const queue: string[] = [normalizedRole];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (expanded.has(current)) continue;
    expanded.add(current);

    const roleDef = SC_LAB_RBAC_CONFIG.roles[current];
    if (roleDef && Array.isArray(roleDef.inherits)) {
      for (const parent of roleDef.inherits) {
        queue.push(parent);
      }
    }
  }

  return expanded;
}

export function matchResourcePattern(pattern: string, path: string): boolean {
  // Normalize trailing slash
  const normPath = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  const normPattern = pattern.length > 1 && pattern.endsWith('/') ? pattern.slice(0, -1) : pattern;

  if (normPattern.endsWith('/**')) {
    const prefix = normPattern.slice(0, -3);
    // Path matches bare prefix, prefix/, or any subpath
    return normPath === prefix || normPath.startsWith(prefix + '/');
  }

  if (normPattern.includes('*')) {
    // Convert glob '*' (single segment match) to regex pattern
    const regexStr = '^' + normPattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape regex special chars except *
      .replace(/\*/g, '[^/]+') + '$';
    const regex = new RegExp(regexStr);
    return regex.test(normPath);
  }

  return normPath === normPattern;
}

export interface EvaluationResult {
  allowed: boolean;
  effect: Effect | 'none';
  priority?: number;
  matchedRule?: PolicyRule;
  reason: string;
}

export function evaluateRbacPolicy(
  userRole: string | undefined,
  path: string,
  method: string,
  userPermissions?: Set<string>
): EvaluationResult {
  const action = mapMethodToAction(method);
  const userRoles = expandUserRoles(userRole);

  const matchedRules: PolicyRule[] = [];

  // Evaluate explicit user permissions using dynamic PERMISSION_POLICIES
  if (userPermissions && userPermissions.size > 0) {
    for (const permission of userPermissions) {
      const permissionPolicies = PERMISSION_POLICIES[permission];
      if (permissionPolicies) {
        for (const policy of permissionPolicies) {
          if (!policy.action.includes(action)) continue;
          const resources = Array.isArray(policy.resource) ? policy.resource : [policy.resource];
          if (resources.some(resPattern => matchResourcePattern(resPattern, path))) {
            matchedRules.push(policy);
          }
        }
      }
    }
  }

  for (const policy of SC_LAB_RBAC_CONFIG.policies) {
    // 1. Check role match
    if (!userRoles.has(policy.role)) continue;

    // 2. Check action match
    if (!policy.action.includes(action)) continue;

    // 3. Check resource match
    const resources = Array.isArray(policy.resource) ? policy.resource : [policy.resource];
    const pathMatches = resources.some(resPattern => matchResourcePattern(resPattern, path));

    if (pathMatches) {
      matchedRules.push(policy);
    }
  }

  if (matchedRules.length === 0) {
    return {
      allowed: false,
      effect: 'none',
      reason: `Fail-closed: No matching RBAC policy for role(s) [${Array.from(userRoles).join(', ')}], path '${path}', action '${action}'`,
    };
  }

  // 4. Sort by priority DESC
  matchedRules.sort((a, b) => b.priority - a.priority);

  const highestPriority = matchedRules[0].priority;
  const topRules = matchedRules.filter(r => r.priority === highestPriority);

  // Deny beats allow at equal priority
  const denyRule = topRules.find(r => r.effect === 'deny');
  if (denyRule) {
    return {
      allowed: false,
      effect: 'deny',
      priority: highestPriority,
      matchedRule: denyRule,
      reason: `Denied by rule (priority ${highestPriority}) for role '${denyRule.role}' on '${path}'`,
    };
  }

  const allowRule = topRules.find(r => r.effect === 'allow');
  if (allowRule) {
    return {
      allowed: true,
      effect: 'allow',
      priority: highestPriority,
      matchedRule: allowRule,
      reason: `Allowed by rule (priority ${highestPriority}) for role '${allowRule.role}' on '${path}'`,
    };
  }

  return {
    allowed: false,
    effect: 'none',
    reason: 'Fail-closed: Unresolved policy evaluation',
  };
}
