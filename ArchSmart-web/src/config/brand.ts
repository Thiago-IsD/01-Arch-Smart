import { getSystemAsset } from "@/utils/get-system-asset";

export const BRAND_ASSETS = {
    horizontal: getSystemAsset("logo-horizontal.png"),
    vertical: getSystemAsset("logo-vertical.png"),
    mix: getSystemAsset("logo-mix.png"),
    icon: getSystemAsset("icone.png"),
} as const;
