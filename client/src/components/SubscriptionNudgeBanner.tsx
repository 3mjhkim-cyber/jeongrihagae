import { useState, useEffect, memo } from "react";
import { Link } from "wouter";
import { AlertTriangle, CalendarDays, X } from "lucide-react";
import { useSubscription, getCancelGraceInfo } from "@/hooks/use-subscription";

const DISMISS_KEY = "subscription-nudge-dismissed";
const DISMISS_EVENT = "subscription-nudge-dismiss";

interface Props {
  className?: string;
}

/**
 * 화면 상단 알림 배너 — 딱 2가지 경우에만 뜬다:
 *   1. 무료체험 종료 D-7 이내
 *   2. 구독 해지 후 유예기간(이미 낸 기간) 종료 D-7 이내
 * 그 외에는 아무것도 표시하지 않는다 — 해지 직후부터 화면을 잠그거나
 * 무겁게 안내하지 않고, 종료가 임박했을 때만 가볍게 알려준다.
 */
export const SubscriptionNudgeBanner = memo(function SubscriptionNudgeBanner({ className }: Props) {
  const { data: sub } = useSubscription();
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(DISMISS_KEY) === "true",
  );

  useEffect(() => {
    const handler = () => setDismissed(true);
    window.addEventListener(DISMISS_EVENT, handler);
    return () => window.removeEventListener(DISMISS_EVENT, handler);
  }, []);

  const graceInfo = getCancelGraceInfo(sub);
  const showTrialNudge = !!sub?.showPaymentNudge;
  const showCancelGraceNudge = !!graceInfo && graceInfo.daysLeft <= 7;

  if (dismissed || (!showTrialNudge && !showCancelGraceNudge)) return null;

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "true");
    window.dispatchEvent(new CustomEvent(DISMISS_EVENT));
  };

  const message = showTrialNudge
    ? <>무료체험 종료까지 <strong>{sub!.daysUntilTrialEnd}일</strong> 남았습니다.</>
    : <>이용 가능 기간 종료까지 <strong>{graceInfo!.daysLeft}일</strong> 남았습니다.</>;

  return (
    <div
      className={`flex items-center gap-3 bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-sm text-amber-800 ${className ?? ""}`}
    >
      {showTrialNudge
        ? <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-500" />
        : <CalendarDays className="w-4 h-4 flex-shrink-0 text-amber-500" />}
      <span className="flex-1">
        {message}{" "}
        <Link
          href="/admin/subscription"
          className="underline underline-offset-2 font-medium hover:opacity-75"
        >
          {showTrialNudge ? "지금 구독하기 →" : "재구독하러 가기 →"}
        </Link>
      </span>
      <button
        onClick={handleDismiss}
        className="p-1 rounded hover:bg-amber-200 transition-colors flex-shrink-0"
        aria-label="닫기"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
});
