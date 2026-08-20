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
export const PLAN_PRICE = 9_900;

/** 결제 최대 재시도 횟수 (3일 연속 1일 1회) */
export const MAX_FAIL_COUNT = 3;

const PORTONE_API_BASE = "https://api.portone.io";

export interface BillingResult {
  success: boolean;
  txId: string;
  failReason?: string;
}

/** 결제 요청 후 상태를 재확인할 때, 이 상태들은 "확정 실패"로 간주해 더 기다리지 않는다 */
const TERMINAL_FAILURE_STATUSES = new Set(["FAILED", "CANCELLED"]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function extractFailReason(data: any, httpStatus: number): string {
  return (
    data?.failure?.reason ??
    data?.failure?.pgMessage ??
    data?.failure?.message ??
    data?.message ??
    (data?.status ? `status=${data.status}` : `HTTP ${httpStatus}`)
  );
}

/**
 * PortOne V2 REST API로 빌링키 결제를 요청합니다.
 *
 * PORTONE_API_SECRET 미설정 시 스텁 성공을 반환합니다.
 * 운영 환경에서는 실제 API 응답에 따라 success/fail 을 반환합니다.
 *
 * 카카오페이 등 간편결제는 결제 요청(POST) 응답 시점에 아직 최종 승인이
 * 안 끝나 PAID 가 아닌 중간 상태로 응답이 오는 경우가 있다(레이스 컨디션).
 * 그래서 즉시 PAID 가 아니어도 확정 실패 상태가 아니라면, 결제 건을 GET
 * 으로 짧은 간격을 두고 몇 차례 더 조회해 최종 상태를 확인한다.
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
    storeId: process.env.VITE_PORTONE_STORE_ID || process.env.PORTONE_STORE_ID,
    billingKey,
    channelKey: process.env.VITE_PORTONE_CHANNEL_KEY || process.env.PORTONE_CHANNEL_KEY,
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

    let data = (await res.json()) as any;

    if (res.ok && data.status === "PAID") {
      return { success: true, txId: data.id ?? orderId };
    }

    // 즉시 PAID 가 아니고, 확정 실패도 아니면 최종 승인이 아직 반영 안 됐을 수 있다.
    // 짧은 간격으로 몇 번 더 조회해서 최종 상태를 확인한다.
    if (res.ok && !TERMINAL_FAILURE_STATUSES.has(data.status)) {
      for (let attempt = 0; attempt < 4; attempt++) {
        await sleep(1500);
        const pollRes = await fetch(
          `${PORTONE_API_BASE}/payments/${encodeURIComponent(orderId)}`,
          { headers: { Authorization: `PortOne ${apiSecret}` } },
        );
        const pollData = (await pollRes.json()) as any;
        if (pollRes.ok && pollData.status === "PAID") {
          return { success: true, txId: pollData.id ?? orderId };
        }
        data = pollData;
        if (pollRes.ok && TERMINAL_FAILURE_STATUSES.has(pollData.status)) break;
      }
    }

    // 실패 원인 진단용 로그 (실패 사유가 어느 필드에 있는지 모를 때를 대비해 응답 전체를 남긴다)
    console.error(
      `[billing] charge failed userId=${userId} orderId=${orderId}`,
      JSON.stringify(data),
    );

    return { success: false, txId: data.id ?? orderId, failReason: extractFailReason(data, res.status) };
  } catch (err: any) {
    return { success: false, txId: orderId, failReason: err.message };
  }
}
