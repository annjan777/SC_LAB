// Frontend utility functions for phone and email validation

const BLOCKED_DOMAINS = new Set([
  'xyz.com',
  'abc.com',
  'test.com',
  'test.in',
  'test.org',
  'example.com',
  'example.org',
  'example.net',
  'sample.com',
  'temp.com',
  'fake.com',
  'fakemail.com',
  'dummy.com',
  'invalid.com',
  'myemail.com',
  'noemail.com',
  'none.com',
  'mailinator.com',
  'tempmail.com',
  'dispostable.com',
  'trashmail.com',
  '10minutemail.com',
  'yopmail.com',
  'throwaway.com',
  'foo.com',
  'bar.com',
  'asdf.com',
  'qwerty.com',
  'placeholder.com',
  'domain.com',
]);

/**
 * Validates and extracts a 10-digit Indian contact number.
 * Handles inputs with or without +91, 91 prefix, leading 0, spaces, dashes, parentheses.
 */
export function extractIndianPhone(
  rawPhone: string | null | undefined,
  isRequired = false
): { isValid: boolean; phone: string | null; error?: string } {
  if (!rawPhone || !rawPhone.trim()) {
    if (isRequired) {
      return { isValid: false, phone: null, error: 'Phone number is required' };
    }
    return { isValid: true, phone: null };
  }

  const trimmed = rawPhone.trim();

  // Remove spaces, dashes, dots, parentheses
  let cleaned = trimmed.replace(/[\s\-\(\)\.]/g, '');

  // Handle Indian country codes / trunk prefixes
  if (cleaned.startsWith('+91')) {
    cleaned = cleaned.slice(3);
  } else if (cleaned.startsWith('91') && cleaned.length === 12) {
    cleaned = cleaned.slice(2);
  } else if (cleaned.startsWith('+')) {
    return {
      isValid: false,
      phone: null,
      error: 'Phone number must be a 10-digit Indian contact number (with or without +91)',
    };
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.slice(1);
  }

  // Must now be exactly 10 digits
  if (!/^\d{10}$/.test(cleaned)) {
    return {
      isValid: false,
      phone: null,
      error: 'Phone number must be a 10-digit Indian contact number (e.g. 9876543210 or +91 98765 43210)',
    };
  }

  // Indian mobile numbers start with 6, 7, 8, or 9
  if (!/^[6-9]\d{9}$/.test(cleaned)) {
    return {
      isValid: false,
      phone: null,
      error: 'Invalid Indian mobile number: must start with 6, 7, 8, or 9',
    };
  }

  return { isValid: true, phone: cleaned };
}

/**
 * Validates an email address and its domain.
 * Blocks placeholder/dummy domains like @xyz.com, @test.com, etc.
 * Supports primary domains like @gmail.com, @kgpian.iitkgp.ac.in, @iitkgp.ac.in, and valid institutional/provider domains.
 */
export function validateEmail(
  rawEmail: string | null | undefined
): { isValid: boolean; email: string; error?: string } {
  if (!rawEmail || !rawEmail.trim()) {
    return { isValid: false, email: '', error: 'Email address is required' };
  }

  let email = rawEmail.trim().toLowerCase();

  // Auto-complete "@gmail" if user omitted ".com"
  if (email.endsWith('@gmail')) {
    email = email + '.com';
  }

  // Basic email structure
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(email)) {
    return {
      isValid: false,
      email,
      error: 'Please enter a valid email address format (e.g., user@gmail.com or user@kgpian.iitkgp.ac.in)',
    };
  }

  const parts = email.split('@');
  if (parts.length !== 2) {
    return { isValid: false, email, error: 'Invalid email address' };
  }

  const [localPart, domain] = parts;

  if (localPart.length === 0 || localPart.length > 64) {
    return { isValid: false, email, error: 'Invalid email username length' };
  }

  // Check blocked placeholder / fake domains
  if (BLOCKED_DOMAINS.has(domain)) {
    return {
      isValid: false,
      email,
      error: `Invalid email domain '@${domain}'. Placeholder or dummy domains are not allowed. Please use a valid domain such as @gmail.com or @kgpian.iitkgp.ac.in`,
    };
  }

  // Domain structure checks
  if (domain.includes('..') || domain.startsWith('.') || domain.endsWith('.')) {
    return { isValid: false, email, error: 'Invalid email domain format' };
  }

  const domainParts = domain.split('.');
  if (domainParts.length < 2) {
    return {
      isValid: false,
      email,
      error: 'Email domain must include a valid extension (e.g., .com, .ac.in)',
    };
  }

  // Verify each domain label
  for (const part of domainParts) {
    if (!part || part.length === 0 || part.length > 63) {
      return { isValid: false, email, error: 'Invalid domain label in email' };
    }
    if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(part)) {
      return { isValid: false, email, error: 'Email domain contains invalid characters' };
    }
  }

  // Top-level domain (TLD) must be at least 2 alpha characters
  const tld = domainParts[domainParts.length - 1];
  if (!/^[a-z]{2,24}$/.test(tld)) {
    return {
      isValid: false,
      email,
      error: `Invalid top-level domain '.${tld}'. Please use a valid email domain`,
    };
  }

  // Check minimum domain name length (e.g. single character domain 'a.com' is typically invalid/placeholder)
  if (domainParts[0].length < 2) {
    return {
      isValid: false,
      email,
      error: `Invalid domain name '@${domain}'. Please provide a valid email domain`,
    };
  }

  return { isValid: true, email };
}

/**
 * Checks whether a user's profile data actually exists and is complete.
 * Returns false if required project and employment fields are missing,
 * ensuring users who have not completed data entry are directed to the form.
 */
export function isProfileCompleted(profile: any): boolean {
  if (!profile) return false;
  if (profile.is_profile_completed === false) return false;

  const hasRequiredData = Boolean(
    profile.full_name &&
    profile.full_name !== 'New User' &&
    (profile.designation || profile.program_designation) &&
    profile.project_name &&
    profile.project_code &&
    profile.project_start_date &&
    profile.project_end_date &&
    profile.staff_contract_start_date &&
    profile.staff_contract_end_date
  );

  return Boolean(profile.is_profile_completed && hasRequiredData);
}
