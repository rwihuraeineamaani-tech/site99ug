/** Spells out a whole shilling amount, as printed on Ugandan receipts. */
const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function under1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (h) parts.push(`${ONES[h]} hundred`);
  if (r) {
    const t = r < 20 ? ONES[r] : `${TENS[Math.floor(r / 10)]}${r % 10 ? `-${ONES[r % 10]}` : ""}`;
    parts.push(h ? `and ${t}` : t);
  }
  return parts.join(" ");
}

export function amountInWords(amount: number): string {
  let n = Math.round(Math.abs(amount));
  if (n === 0) return "Zero Uganda shillings only";
  const scales = ["", " thousand", " million", " billion"];
  const chunks: string[] = [];
  let i = 0;
  while (n > 0 && i < scales.length) {
    const c = n % 1000;
    if (c) chunks.unshift(under1000(c) + scales[i]);
    n = Math.floor(n / 1000);
    i++;
  }
  const s = chunks.join(" ");
  return `${s.charAt(0).toUpperCase()}${s.slice(1)} Uganda shillings only`;
}
