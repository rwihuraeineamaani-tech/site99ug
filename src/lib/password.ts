/** A random password that always clears the leaked-password and length checks. */
export function suggestPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%&*?";
  const all = upper + lower + digits + symbols;
  const pick = (set: string, n: number) =>
    Array.from(crypto.getRandomValues(new Uint32Array(n)), (v) => set[v % set.length]);
  const chars = [...pick(upper, 2), ...pick(lower, 6), ...pick(digits, 3), ...pick(symbols, 2), ...pick(all, 3)];
  // shuffle
  const r = crypto.getRandomValues(new Uint32Array(chars.length));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = r[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export const PASSWORD_HINT =
  "At least 8 characters. Common or leaked passwords are refused — use Suggest for a safe one.";
