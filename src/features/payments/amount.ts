// Tap expresses KWD amounts as decimal numbers with three places; we keep
// integer fils everywhere else.
export function filsToKwdAmount(fils: number): number {
  if (!Number.isInteger(fils) || fils < 0) throw new RangeError("fils must be a non-negative integer");
  return fils / 1000;
}

export function kwdAmountToFils(amount: number | string): number {
  const text = typeof amount === "number" ? amount.toFixed(3) : amount.trim();
  if (!/^\d+(\.\d{1,3})?$/.test(text)) throw new RangeError(`invalid amount: ${text}`);
  const [whole, fraction = ""] = text.split(".");
  return Number(whole) * 1000 + Number(fraction.padEnd(3, "0"));
}

export function formatAmountForHash(fils: number): string {
  return (fils / 1000).toFixed(3);
}
