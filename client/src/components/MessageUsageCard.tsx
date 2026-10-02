/**
 * 사장님 대시보드용 알림톡 한도 카드
 * - 이번 기간 사용량 / 한도 / 남은 건수
 * - 80% 이상: 노란 경고, 100%: 빨간 경고
 * - 한도는 매장 결제일마다 초기화 (server/messaging.ts)
 */
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

type MessageUsage = {
  used: number;
  limit: number;
  remaining: number;
  periodStart: string;
  periodEnd: string;
  enforced: boolean;
};

export function MessageUsageCard() {
  const { data } = useQuery<MessageUsage>({ queryKey: ["/api/shop/message-usage"] });
  if (!data) return null;

  const ratio = data.limit > 0 ? data.used / data.limit : 0;
  const level = ratio >= 1 ? "full" : ratio >= 0.8 ? "warn" : "ok";
  const percent = Math.min(100, Math.round(ratio * 100));
  // 기간 끝 날짜(다음 결제일)는 새 기간의 첫날이라, 표시는 그 전날까지로 한다
  const lastDay = new Date(new Date(data.periodEnd).getTime() - 24 * 60 * 60 * 1000);

  const styles = {
    ok:   { box: "bg-white border-border",       bar: "bg-primary",    text: "text-foreground" },
    warn: { box: "bg-amber-50 border-amber-300", bar: "bg-amber-500",  text: "text-amber-700" },
    full: { box: "bg-red-50 border-red-300",     bar: "bg-red-500",    text: "text-red-600" },
  }[level];

  return (
    <div className={`rounded-2xl border p-4 sm:p-5 shadow-sm mb-6 ${styles.box}`} data-testid="card-message-usage">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-primary flex-shrink-0" />
          <span className="font-semibold">이번 달 알림톡</span>
          <span className="text-xs text-muted-foreground">
            {format(new Date(data.periodStart), "M/d")} ~ {format(lastDay, "M/d")}
          </span>
        </div>
        <div className="text-right">
          <span className={`text-lg font-bold ${styles.text}`}>{data.used.toLocaleString()}</span>
          <span className="text-sm text-muted-foreground"> / {data.limit.toLocaleString()}통</span>
          <span className={`ml-2 text-sm font-medium ${styles.text}`}>남은 {data.remaining.toLocaleString()}통</span>
        </div>
      </div>

      <div className="mt-3 h-2 rounded-full bg-secondary overflow-hidden">
        <div className={`h-full ${styles.bar} transition-all`} style={{ width: `${percent}%` }} />
      </div>

      {level !== "ok" && (
        <p className={`mt-3 text-sm flex items-start gap-1.5 ${styles.text}`}>
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {level === "warn"
            ? `한도의 ${percent}%를 사용했어요. 한도를 넘으면 방문 전 리마인드가 발송되지 않아요.`
            : data.enforced
              ? "이번 달 한도를 모두 사용했어요. 방문 전 리마인드는 발송되지 않아요. (예약 확정·예약금 안내·예약 취소 알림은 계속 발송됩니다)"
              : "이번 달 한도를 모두 사용했어요."}
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        {format(new Date(data.periodEnd), "M월 d일")} 결제일에 초기화됩니다.
      </p>
    </div>
  );
}
