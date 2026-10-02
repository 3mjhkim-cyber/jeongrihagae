/**
 * 요금 계산
 *
 * - 기본요금, 창립 멤버 가격, 창립 멤버 상한은 app_settings 테이블에서 읽는다.
 *   (슈퍼관리자 화면에서 수정. 아래 PRICING_DEFAULTS 는 설정이 비어 있을 때 넣는 초기값)
 * - 창립 멤버 매장은 지정 시점에 shops.founding_price 로 가격이 고정되므로,
 *   이후 설정값이 바뀌어도 그 매장의 월 요금은 바뀌지 않는다.
 */

import { storage } from "./storage";
import type { Shop } from "@shared/schema";

export const PRICING_KEYS = {
  basePrice: "base_price",
  foundingPrice: "founding_price",
  foundingLimit: "founding_limit",
} as const;

/** app_settings 에 값이 없을 때 최초 1회 저장되는 초기값 */
const PRICING_DEFAULTS = {
  basePrice: 19_000,
  foundingPrice: 9_900,
  foundingLimit: 30,
};

export interface PricingSettings {
  basePrice: number;
  foundingPrice: number;
  foundingLimit: number;
}

/** 서버 시작 시 호출: 비어 있는 요금 설정을 초기값으로 채운다 (이미 있으면 그대로 둠) */
export async function ensurePricingSettings(): Promise<void> {
  for (const [name, key] of Object.entries(PRICING_KEYS) as [keyof PricingSettings, string][]) {
    const existing = await storage.getSetting(key);
    if (existing === undefined) {
      await storage.setSetting(key, String(PRICING_DEFAULTS[name]));
    }
  }
}

function toPositiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export async function getPricingSettings(): Promise<PricingSettings> {
  const [basePrice, foundingPrice, foundingLimit] = await Promise.all([
    storage.getSetting(PRICING_KEYS.basePrice),
    storage.getSetting(PRICING_KEYS.foundingPrice),
    storage.getSetting(PRICING_KEYS.foundingLimit),
  ]);
  return {
    basePrice: toPositiveInt(basePrice, PRICING_DEFAULTS.basePrice),
    foundingPrice: toPositiveInt(foundingPrice, PRICING_DEFAULTS.foundingPrice),
    foundingLimit: toPositiveInt(foundingLimit, PRICING_DEFAULTS.foundingLimit),
  };
}

/** 기본요금을 이미 알고 있을 때의 매장 월 요금 (목록처럼 여러 매장을 한 번에 계산할 때) */
export function priceForShop(shop: Shop | undefined | null, basePrice: number): number {
  if (shop?.isFoundingMember && shop.foundingPrice != null && shop.foundingPrice > 0) {
    return shop.foundingPrice;
  }
  return basePrice;
}

/** 매장의 월 요금: 창립 멤버면 고정가, 아니면 현재 기본요금 */
export async function getShopPrice(shop: Shop | undefined | null): Promise<number> {
  const { basePrice } = await getPricingSettings();
  return priceForShop(shop, basePrice);
}

/** 사용자(구독 결제 단위)의 월 요금: 소속 매장 기준, 매장이 없으면 기본요금 */
export async function getUserPrice(userId: number): Promise<number> {
  const user = await storage.getUser(userId);
  const shop = user?.shopId ? await storage.getShop(user.shopId) : undefined;
  return getShopPrice(shop);
}
