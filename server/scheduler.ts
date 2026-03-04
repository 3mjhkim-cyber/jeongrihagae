/**
 * 일일 구독 스케줄러
 *
 * A. 무료체험 만료 처리
 *    - trial_end_date <= 오늘+3일 이고 status=trialing → pending_payment 전환
 *    - (D-3 경고 및 체험 만료 모두 동일하게 pending_payment 처리)
 *
 * B. 정기 결제 처리
 *    - next_billing_date <= 오늘 AND status IN ('active','past_due')
 *    - 결제 성공: status=active, last_billing_at 갱신, next_billing_date +1개월, fail_count=0
 *    - 결제 실패: fail_count+1, status=past_due
 *      · fail_count < MAX_FAIL_COUNT: next_billing_date = 내일 (재시도)
 *      · fail_count >= MAX_FAIL_COUNT: next_billing_date = null (재시도 중단)
 */

import { randomBytes } from "crypto";
import { storage } from "./storage";
import { chargeBillingKey, PLAN_PRICE, MAX_FAIL_COUNT } from "./billing";

// ─── 날짜 유틸 ───────────────────────────────────────────────────────────────

/** 오늘 자정(00:00:00.000) */
function todayMidnight(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * date + 1개월.
 * 월말 처리: Jan 31 → Feb 28/29 (넘침 없이 해당 월 말일로 고정)
 */
export function addOneMonth(date: Date): Date {
  const d = new Date(date);
  const targetMonth = (d.getMonth() + 1) % 12;
  d.setMonth(d.getMonth() + 1);
  // setMonth 가 월을 넘어갔으면(예: Jan31 → Mar3) 해당 달 말일로 되돌림
  if (d.getMonth() !== targetMonth) {
    d.setDate(0); // 이전 달(= 원하는 달)의 마지막 날
  }
  return d;
}

// ─── A. 무료체험 만료 처리 ───────────────────────────────────────────────────

async function processTrialExpirations(): Promise<void> {
  const today = todayMidnight();

  // D-3 기준: 오늘로부터 3일 후까지 만료되는 체험 구독을 pending_payment 로 전환
  const warningLimit = new Date(today);
  warningLimit.setDate(warningLimit.getDate() + 3);
  warningLimit.setHours(23, 59, 59, 999); // 3일 후 하루 끝까지 포함

  const expiring = await storage.getExpiringTrials(warningLimit);
  if (expiring.length === 0) return;

  for (const sub of expiring) {
    await storage.updateUserSubscription(sub.id, { status: "pending_payment" });
  }
  console.log(
    `[scheduler] trial→pending_payment 전환: ${expiring.length}건`,
  );
}

// ─── B. 정기 결제 처리 ───────────────────────────────────────────────────────

async function processRecurringBillings(): Promise<void> {
  const today = todayMidnight();
  const dueSubs = await storage.getDueSubscriptions(today);
  if (dueSubs.length === 0) return;

  let charged = 0;
  let failed = 0;

  for (const sub of dueSubs) {
    if (!sub.billingKey) continue;

    // 최대 재시도 초과 구독은 건너뜀 (수동 개입 필요)
    if (sub.failCount >= MAX_FAIL_COUNT) {
      console.log(
        `[scheduler] userId=${sub.userId} 최대 재시도(${MAX_FAIL_COUNT}회) 초과, 건너뜀`,
      );
      continue;
    }

    const orderId = `sub_${sub.userId}_${randomBytes(4).toString("hex")}`;
    const now = new Date();

    const result = await chargeBillingKey(sub.billingKey, sub.userId, orderId);

    // 결제 내역 저장
    await storage.createUserPayment({
      userId: sub.userId,
      amount: PLAN_PRICE,
      attemptedAt: now,
      paidAt: result.success ? now : null,
      result: result.success ? "success" : "fail",
      providerTxId: result.txId,
      failReason: result.failReason ?? null,
    });

    if (result.success) {
      await storage.updateUserSubscription(sub.id, {
        status: "active",
        lastBillingAt: now,
        nextBillingDate: addOneMonth(today),
        failCount: 0,
      });
      charged++;
    } else {
      const newFailCount = sub.failCount + 1;
      const nextRetry =
        newFailCount < MAX_FAIL_COUNT
          ? new Date(today.getTime() + 24 * 60 * 60 * 1000) // 내일 재시도
          : null; // 재시도 중단

      await storage.updateUserSubscription(sub.id, {
        status: "past_due",
        failCount: newFailCount,
        nextBillingDate: nextRetry,
      });
      failed++;
      console.log(
        `[scheduler] userId=${sub.userId} 결제 실패 ` +
          `(${newFailCount}/${MAX_FAIL_COUNT}): ${result.failReason}`,
      );
    }
  }

  console.log(`[scheduler] 정기결제: 성공=${charged}, 실패=${failed}`);
}

// ─── 스케줄러 메인 ───────────────────────────────────────────────────────────

export async function runDailyScheduler(): Promise<void> {
  console.log("[scheduler] 일일 스케줄러 실행 시작");
  try {
    await processTrialExpirations();
    await processRecurringBillings();
    console.log("[scheduler] 일일 스케줄러 실행 완료");
  } catch (err) {
    console.error("[scheduler] 실행 중 오류:", err);
  }
}

/**
 * 서버 시작 시 스케줄러를 등록합니다.
 *  1. 즉시 1회 실행 (서버 재시작 시 밀린 작업 처리)
 *  2. 다음 자정에 맞춰 실행 후 24시간 간격으로 반복
 */
export function startScheduler(): void {
  // 즉시 실행
  runDailyScheduler();

  // 다음 자정(UTC 기준)까지의 밀리초
  function msUntilMidnight(): number {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setUTCDate(midnight.getUTCDate() + 1);
    midnight.setUTCHours(0, 0, 0, 0);
    return midnight.getTime() - now.getTime();
  }

  setTimeout(() => {
    runDailyScheduler();
    setInterval(runDailyScheduler, 24 * 60 * 60 * 1000);
  }, msUntilMidnight());

  console.log("[scheduler] 일일 스케줄러 등록 완료");
}
