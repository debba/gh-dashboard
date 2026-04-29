export function getContrastColor(hex: string): "#0a0c12" | "#e7eaf3" {
  if (!hex || hex.length < 6) return "#e7eaf3";
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return 0.299 * red + 0.587 * green + 0.114 * blue > 140 ? "#0a0c12" : "#e7eaf3";
}

export function getLanguageColor(name: string): string {
  if (!name) return "#6e7280";
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `hsl(${hash % 360} 68% 56%)`;
}
