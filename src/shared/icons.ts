import type { IconName } from "./protocol";

export const ICON_NAMES: readonly IconName[] = ["online", "offline", "need-install"];

export const ICON_SIZES = [16, 32, 48, 128] as const;

export type IconSize = (typeof ICON_SIZES)[number];

export function iconPath(name: IconName, size: IconSize): string {
  return `icons/${name}-${size}.png`;
}

export function iconPathMap(
  name: IconName,
  prefix = "",
): Record<IconSize, string> {
  return Object.fromEntries(
    ICON_SIZES.map((size) => [size, `${prefix}${iconPath(name, size)}`]),
  ) as Record<IconSize, string>;
}
