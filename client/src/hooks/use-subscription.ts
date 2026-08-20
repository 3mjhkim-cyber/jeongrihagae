import { useQuery } from "@tanstack/react-query";

interface SubscriptionData {
  status: string;
  isLocked?: boolean;
  trialEndDate?: string | null;
  nextBillingDate?: string | null;
  daysUntilTrialEnd?: number | null;
  showPaymentNudge?: boolean;
}

export function useSubscription() {
  return useQuery<SubscriptionData>({
    queryKey: ["/api/subscription"],
    queryFn: async () => {
      const res = await fetch("/api/subscription");
      if (!res.ok) throw new Error("Failed to fetch subscription");
      return res.json();
    },
  });
}

/**
 * 무료 체험(trialing) 또는 유료 구독(active) 중이거나, 해지했더라도 아직 이미 낸
 * 기간(trialEndDate/nextBillingDate)이 남아있으면 접근 가능으로 취급한다.
 * server/routes.ts 의 requireActiveSubscription 미들웨어와 동일한 기준이어야
 * 화면이 백엔드보다 먼저 잠기는 일이 없다.
 */
export function isSubscriptionDataAccessible(data: SubscriptionData | undefined): boolean {
  if (!data) return false;
  if (data.status === "active" || data.status === "trialing") return true;
  if (data.status === "cancelled") {
    const now = new Date();
    if (data.trialEndDate && new Date(data.trialEndDate) > now) return true;
    if (data.nextBillingDate && new Date(data.nextBillingDate) > now) return true;
  }
  return false;
}

export function useIsSubscriptionAccessible() {
  const { data, isLoading } = useSubscription();
  return { isLoading, userAccessible: isSubscriptionDataAccessible(data) };
}

/**
 * 해지했지만 아직 남은 이용 기간(유예기간)의 종료일과 남은 일수.
 * 유예기간이 아니면 null.
 */
export function getCancelGraceInfo(
  data: SubscriptionData | undefined,
): { endDate: string; daysLeft: number } | null {
  if (!data || data.status !== "cancelled") return null;
  const now = new Date();
  const endDate =
    data.trialEndDate && new Date(data.trialEndDate) > now
      ? data.trialEndDate
      : data.nextBillingDate && new Date(data.nextBillingDate) > now
        ? data.nextBillingDate
        : null;
  if (!endDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  const daysLeft = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return { endDate, daysLeft };
}
