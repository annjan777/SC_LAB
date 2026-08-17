// Strict SQL identifier validator to prevent SQL injection in dynamic column names
export function sanitizeIdentifier(identifier: string): string {
  if (!identifier || typeof identifier !== 'string') {
    throw new Error('Invalid SQL identifier: parameter must be a non-empty string');
  }
  // Reject any identifier containing characters outside [a-zA-Z0-9_]
  if (!/^[a-zA-Z0-9_]+$/.test(identifier)) {
    throw new Error(`Invalid SQL identifier format: "${identifier}" contains disallowed characters`);
  }
  return identifier;
}

export function sanitizeIdentifiers(identifiers: string[]): string[] {
  return identifiers.map(sanitizeIdentifier);
}
