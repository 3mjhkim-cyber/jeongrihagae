/**
 * AuditLogs.tsx — 슈퍼관리자 변경 기록 (/superadmin/audit-logs)
 *
 * 기본요금, 창립 멤버 지정/해제, 알림톡 한도, 한도 초과 차단 스위치 변경 내역을
 * 최신순으로 보여준다. (서버: GET /api/admin/audit-logs, 최근 300건)
 */

import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Loader2, ArrowLeft, History, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AdminAuditLog } from "@shared/schema";

const ACTION_LABELS: Record<string, string> = {
  base_price: "기본요금 변경",
  founding_on: "창립 멤버 지정",
  founding_off: "창립 멤버 해제",
  message_limit: "알림톡 한도 변경",
  message_limit_enforced: "한도 초과 차단 설정",
};

function fmtDateTime(d: Date | string): string {
  const dt = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

export default function AuditLogs() {
  const { user, isLoading: isAuthLoading, logout } = useAuth();
  const [_, setLocation] = useLocation();

  const { data: logs, isLoading, refetch, isFetching } = useQuery<AdminAuditLog[]>({
    queryKey: ["/api/admin/audit-logs"],
    enabled: !!user && user.role === "super_admin",
  });

  useEffect(() => {
    if (!isAuthLoading && (!user || user.role !== "super_admin")) setLocation("/login");
  }, [isAuthLoading, user, setLocation]);

  if (isAuthLoading || !user) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (user.role !== "super_admin") return null;

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost" size="sm"
              className="gap-1 text-muted-foreground hover:text-foreground px-2 flex-shrink-0"
              onClick={() => setLocation("/superadmin")}
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">돌아가기</span>
            </Button>
            <div className="w-px h-6 bg-border flex-shrink-0" />
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary rounded-xl flex items-center justify-center flex-shrink-0">
              <History className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-sm sm:text-lg leading-tight">변경 기록</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">요금 · 창립 멤버 · 알림톡 한도</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => logout()} className="flex-shrink-0">
            <LogOut className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">로그아웃</span>
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b gap-2">
            <h2 className="font-bold text-sm sm:text-base">
              최근 변경 <span className="text-xs font-normal text-muted-foreground">(최대 300건)</span>
            </h2>
            <Button
              variant="ghost" size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="text-muted-foreground gap-1 px-2"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">새로고침</span>
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : !logs || logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <History className="w-10 h-10 opacity-30" />
              <p className="text-sm">아직 변경 기록이 없습니다</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-5 py-2.5 whitespace-nowrap">날짜</th>
                    <th className="text-left font-medium px-3 py-2.5 whitespace-nowrap">무엇을</th>
                    <th className="text-left font-medium px-3 py-2.5 whitespace-nowrap">매장</th>
                    <th className="text-left font-medium px-3 py-2.5 whitespace-nowrap">변경 내용</th>
                    <th className="text-left font-medium px-5 py-2.5 whitespace-nowrap">관리자</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {logs.map(log => (
                    <tr key={log.id} data-testid={`row-audit-${log.id}`}>
                      <td className="px-5 py-3 whitespace-nowrap text-muted-foreground">{fmtDateTime(log.createdAt)}</td>
                      <td className="px-3 py-3 whitespace-nowrap font-medium">{ACTION_LABELS[log.action] ?? log.action}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{log.shopName ?? "전체"}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {log.before ?? "-"} <span className="text-muted-foreground">→</span> <b>{log.after ?? "-"}</b>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-muted-foreground">{log.adminEmail ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
