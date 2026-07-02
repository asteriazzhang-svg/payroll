// Password policy: at least 8 chars, must contain both letters and digits.
// Returns an error message string, or null if valid.

export function validatePassword(pwd: string): string | null {
  if (typeof pwd !== 'string' || pwd.length < 8) {
    return '密码至少 8 位';
  }
  if (!/[a-zA-Z]/.test(pwd) || !/[0-9]/.test(pwd)) {
    return '密码必须同时包含字母和数字';
  }
  return null;
}
