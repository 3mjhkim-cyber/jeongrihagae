/**
 * PortOne V2 빌링키 결제 서비스
 *
 * 실제 운영 시 환경변수 설정:
 *   PORTONE_API_SECRET   - PortOne API 시크릿 키
 *   PORTONE_STORE_ID     - PortOne 스토어 ID  (예: store-xxxx)
 *   PORTONE_CHANNEL_KEY  - PortOne 채널 키    (예: channel-key-xxxx)
 *
 * PORTONE_API_SECRET 이 없으면 스텁 모드(개발/테스트용)로 동작합니다.
 */

/** 단일 플랜 가격 (KRW) */
export const PLAN_PRICE = 39_000;

/** 결제 최대 재시도 횟수 (3일 연속 1일 1회) */
export const MAX_FAIL_COUNT = 3;

const PORTONE_API_BASE = "https://api.portone.io";

export interface BillingResult {
  success: boolean;
  txId: string;
  failReason?: string;
}

/**
 * PortOne V2 REST API로 빌링키 결제를 요청합니다.
 *
 * PORTONE_API_SECRET 미설정 시 스텁 성공을 반환합니다.
 * 운영 환경에서는 실제 API 응답에 따라 success/fail 을 반환합니다.
 */
export async function chargeBillingKey(
  billingKey: string,
  userId: number,
  orderId: string,
): Promise<BillingResult> {
  const apiSecret = process.env.PORTONE_API_SECRET;

  // ── 개발/테스트 스텁 ──────────────────────────────────────────────────────
  if (!apiSecret) {
    console.log(
      `[billing stub] userId=${userId} orderId=${orderId} amount=${PLAN_PRICE}KRW`,
    );
    return { success: true, txId: `stub_${orderId}` };
  }

  // ── 실제 PortOne V2 API 호출 ─────────────────────────────────────────────
  // POST /payments/{paymentId}/billing-key
  //   storeId, billingKey, channelKey, orderName, amount, currency, customer
  const body = {
    storeId: process.env.PORTONE_STORE_ID,
    billingKey,
    channelKey: process.env.PORTONE_CHANNEL_KEY,
    orderName: "펫그루머 서비스 월정액",
    customer: { id: String(userId) },
    amount: { total: PLAN_PRICE },
    currency: "KRW",
  };

  try {
    const res = await fetch(
      `${PORTONE_API_BASE}/payments/${encodeURIComponent(orderId)}/billing-key`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `PortOne ${apiSecret}`,
        },
        body: JSON.stringify(body),
      },
    );

    const data = (await res.json()) as any;

    if (res.ok && data.status === "PAID") {
      return { success: true, txId: data.id ?? orderId };
    }

    const failReason =
      data.message ?? data.failure?.message ?? `HTTP ${res.status}`;
    return { success: false, txId: data.id ?? orderId, failReason };
  } catch (err: any) {
    return { success: false, txId: orderId, failReason: err.message };
  }
}
