/**
 * 솔라피 발송 통합 + 매장별 알림톡 한도
 *
 * - 모든 솔라피 발송은 sendMessage() 한 곳을 거친다 (알림톡, 비밀번호 찾기 SMS).
 * - 매장 알림톡은 sendAndLog() 로 보내고, 발송마다 notification_logs 에 기록한다.
 * - 매장별 월 한도(shops.message_limit, 기본 300통)는 매장의 결제일 기준으로 초기화된다.
 * - 한도를 넘으면 LIMITED_TEMPLATE_TYPES(리마인드 등)만 발송을 막는다.
 *   예약 확정·예약금 안내·예약 취소는 손님이 꼭 받아야 하므로 한도와 무관하게 발송한다.
 *   차단 여부는 app_settings 의 message_limit_enforced 로 켜고 끈다 (기본: 켜짐).
 */

import { SolapiMessageService } from "solapi";
import { storage } from "./storage";
import { db } from "./db";
import { notificationLogs, type Shop } from "@shared/schema";

/**
 * 알림 유형 키
 * 카카오 알림톡 심사 통과 후 templateCode를 각 항목에 매핑하세요.
 */
export type KakaoTemplateType =
  | 'bookingConfirmed'   // 예약 확정
  | 'depositGuide'       // 예약금 안내
  | 'reminderBefore'     // 방문 전 리마인드
  | 'bookingCancelled';  // 예약 취소

/**
 * 솔라피에서 발급받은 카카오 알림톡 템플릿 코드 매핑
 * 심사 통과 후 .env에 각 코드를 입력하세요.
 */
const KAKAO_TEMPLATE_CODES: Record<KakaoTemplateType, string> = {
  bookingConfirmed:  process.env.KAKAO_TEMPLATE_CODE_BOOKING_CONFIRMED  || '',
  depositGuide:      process.env.KAKAO_TEMPLATE_CODE_DEPOSIT_GUIDE       || '',
  reminderBefore:    process.env.KAKAO_TEMPLATE_CODE_REMINDER_BEFORE     || '',
  bookingCancelled:  process.env.KAKAO_TEMPLATE_CODE_BOOKING_CANCELLED   || '',
};

/** 한도를 넘으면 발송하지 않는 알림 (미용 완료 알림이 생기면 여기에 추가) */
export const LIMITED_TEMPLATE_TYPES: ReadonlySet<KakaoTemplateType> = new Set<KakaoTemplateType>(['reminderBefore']);

/** 슈퍼관리자가 고를 수 있는 매장별 월 한도 */
export const MESSAGE_LIMIT_OPTIONS = [300, 400, 500] as const;

const MESSAGE_LIMIT_ENFORCED_KEY = "message_limit_enforced";

const maskPhone = (phone: string) => phone.replace(/(\d{3})-?(\d{3,4})-?(\d{4})/, '$1-****-$3');

// ─── 솔라피 단일 발송 창구 ──────────────────────────────────────────────────────

export interface SendResult {
  success: boolean;
  providerMessageId?: string;
  errorMessage?: string;
}

/**
 * 솔라피로 메시지 1건 발송. kakaoTemplateId 가 있으면 알림톡, 없으면 문자.
 * 알림톡은 실패 시 SMS 대체발송을 하지 않는다 (SMS 단가가 더 비싸서 기본 OFF).
 */
export async function sendMessage(opts: {
  to: string;
  text: string;
  kakaoTemplateId?: string;
}): Promise<SendResult> {
  const apiKey    = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  const from      = process.env.SOLAPI_SENDER_PHONE;
  const pfId      = process.env.KAKAO_PFID;

  if (!apiKey || !apiSecret || !from || (opts.kakaoTemplateId && !pfId)) {
    console.warn('[솔라피] 환경변수 미설정 — 발송 건너뜀');
    return { success: false, errorMessage: '솔라피 환경변수 미설정' };
  }

  try {
    const solapi = new SolapiMessageService(apiKey, apiSecret);
    const result = opts.kakaoTemplateId
      ? await solapi.sendOne({
          to: opts.to,
          from,
          type: 'ATA',
          text: opts.text,
          kakaoOptions: { pfId: pfId!, templateId: opts.kakaoTemplateId, disableSms: true },
        })
      : await solapi.sendOne({ to: opts.to, from, text: opts.text });
    return { success: true, providerMessageId: result.messageId };
  } catch (err: any) {
    console.error('[솔라피 발송 실패]', {
      message: err?.message,
      fullError: JSON.stringify(err, null, 2),
    });
    return { success: false, errorMessage: err?.message };
  }
}

// ─── 한도 계산 ───────────────────────────────────────────────────────────────

/** anchor 에서 k개월 뒤 같은 날짜 (해당 월에 그 날이 없으면 말일) */
function addMonthsClamped(anchor: Date, k: number): Date {
  const day = anchor.getDate();
  const d = new Date(anchor);
  d.setDate(1);
  d.setMonth(d.getMonth() + k);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

/** anchor 날짜를 기준으로 매달 반복되는 기간 중 now 가 속한 기간 */
export function currentPeriod(anchor: Date, now = new Date()): { start: Date; end: Date } {
  const base = new Date(anchor);
  base.setHours(0, 0, 0, 0);
  let k = (now.getFullYear() - base.getFullYear()) * 12 + (now.getMonth() - base.getMonth());
  if (addMonthsClamped(base, k) > now) k--;
  if (k < 0) k = 0;
  return { start: addMonthsClamped(base, k), end: addMonthsClamped(base, k + 1) };
}

/**
 * 한도 기간의 기준일
 * 1. 카카오페이 정기결제 중이면 마지막 결제일 (결제될 때마다 바뀌어 결제일에 맞춰 초기화)
 * 2. 관리자가 수동으로 유료 활성화한 매장이면 활성화 시작일
 * 3. 그 외: 마지막 결제일 → 무료체험 시작일 → 매장 가입일 순
 */
async function getPeriodAnchor(shop: Shop): Promise<Date> {
  const owner = await storage.getUserByShopId(shop.id);
  const sub = owner ? await storage.getUserSubscription(owner.id) : undefined;
  if (sub?.status === 'active' && sub.lastBillingAt) return new Date(sub.lastBillingAt);
  if (shop.subscriptionStatus === 'active' && shop.subscriptionStart) return new Date(shop.subscriptionStart);
  return new Date(sub?.lastBillingAt ?? sub?.trialStartDate ?? shop.createdAt);
}

export async function isMessageLimitEnforced(): Promise<boolean> {
  return (await storage.getSetting(MESSAGE_LIMIT_ENFORCED_KEY)) !== "false";
}

export async function setMessageLimitEnforced(enforced: boolean): Promise<void> {
  await storage.setSetting(MESSAGE_LIMIT_ENFORCED_KEY, enforced ? "true" : "false");
}

export interface MessageUsage {
  used: number;
  limit: number;
  remaining: number;
  periodStart: Date;
  periodEnd: Date;
  enforced: boolean;
}

/** 매장의 이번 기간 알림톡 사용량 (성공 발송만 집계) */
export async function getMessageUsage(shopId: number): Promise<MessageUsage | undefined> {
  const shop = await storage.getShop(shopId);
  if (!shop) return undefined;
  const anchor = await getPeriodAnchor(shop);
  const { start, end } = currentPeriod(anchor);
  const [used, enforced] = await Promise.all([
    storage.countSentMessagesSince(shopId, start),
    isMessageLimitEnforced(),
  ]);
  return {
    used,
    limit: shop.messageLimit,
    remaining: Math.max(0, shop.messageLimit - used),
    periodStart: start,
    periodEnd: end,
    enforced,
  };
}

// ─── 매장 알림톡 발송 ────────────────────────────────────────────────────────

/**
 * 매장 알림톡 발송 + 로그 저장.
 * 한도 초과로 막힌 경우 발송하지 않고 status=blocked 로 기록한 뒤 { blocked: true } 반환.
 */
export async function sendAndLog(opts: {
  templateType: KakaoTemplateType;
  phone: string;
  message: string;
  shopId: number;
  reservationId?: number;
}): Promise<SendResult & { blocked?: boolean }> {
  const { templateType, phone, message, shopId, reservationId } = opts;

  console.log(`\n[알림톡] type=${templateType} shopId=${shopId} reservationId=${reservationId} to=${maskPhone(phone)}`);

  let result: SendResult & { blocked?: boolean };
  let status: 'sent' | 'failed' | 'blocked';

  const usage = LIMITED_TEMPLATE_TYPES.has(templateType) ? await getMessageUsage(shopId) : undefined;
  const templateId = KAKAO_TEMPLATE_CODES[templateType];

  if (usage?.enforced && usage.used >= usage.limit) {
    console.log(`[알림톡] 한도 초과로 차단 (${usage.used}/${usage.limit})`);
    result = { success: false, blocked: true, errorMessage: `월 한도 초과 (${usage.used}/${usage.limit})` };
    status = 'blocked';
  } else if (!templateId) {
    console.warn(`[알림톡] 템플릿 코드 미설정 (type=${templateType}) — 발송 건너뜀`);
    result = { success: false, errorMessage: `템플릿 코드 미설정: ${templateType}` };
    status = 'failed';
  } else {
    result = await sendMessage({ to: phone, text: message, kakaoTemplateId: templateId });
    status = result.success ? 'sent' : 'failed';
  }
  console.log(`[알림톡 결과] status=${status} messageId=${result.providerMessageId ?? '-'} error=${result.errorMessage ?? '-'}`);

  try {
    await db.insert(notificationLogs).values({
      shopId,
      reservationId: reservationId ?? null,
      templateType,
      phone,
      status,
      providerMessageId: result.providerMessageId ?? null,
      errorMessage: result.errorMessage ?? null,
    });
  } catch (logErr) {
    console.error('[알림 로그 저장 실패]', logErr);
  }

  return result;
}
