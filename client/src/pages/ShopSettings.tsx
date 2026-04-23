import { useAuth } from "@/hooks/use-auth";
import { useIsSubscriptionAccessible } from "@/hooks/use-subscription";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Loader2, User, Key, ArrowLeft, CheckCircle2, AlertCircle, ExternalLink, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import type { Shop } from "@shared/schema";

export default function ShopSettings() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { userAccessible, isLoading: isSubLoading } = useIsSubscriptionAccessible();
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: shop, isLoading: isShopLoading } = useQuery<Shop>({
    queryKey: ['/api/shop/settings'],
    queryFn: async () => {
      const res = await fetch('/api/shop/settings');
      if (!res.ok) throw new Error('Failed to fetch shop settings');
      return res.json();
    },
    enabled: !!user && user.role === 'shop_owner',
  });

  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [isWithdrawDialogOpen, setIsWithdrawDialogOpen] = useState(false);
  const [isWithdrawConfirmOpen, setIsWithdrawConfirmOpen] = useState(false);
  const [withdrawPassword, setWithdrawPassword] = useState('');

  const withdrawMutation = useMutation({
    mutationFn: async (password: string) => {
      const res = await fetch('/api/user/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || '탈퇴 처리 중 오류가 발생했습니다.');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '탈퇴 완료', description: '계정이 삭제되었습니다.' });
      setLocation('/login');
    },
    onError: (error: Error) => {
      toast({ title: '탈퇴 실패', description: error.message, variant: 'destructive' });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const res = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || '비밀번호 변경 실패');
      }
      return res.json();
    },
    onSuccess: () => {
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setIsPasswordDialogOpen(false);
      toast({ title: '변경 완료', description: '비밀번호가 변경되었습니다.' });
    },
    onError: (error: Error) => {
      toast({ title: '변경 실패', description: error.message, variant: 'destructive' });
    },
  });

  useEffect(() => {
    if (!isAuthLoading && (!user || user.role !== 'shop_owner')) {
      setLocation('/login');
    }
  }, [isAuthLoading, user, setLocation]);

  useEffect(() => {
    if (!isSubLoading && user?.role === 'shop_owner') {
      const s = user.shop as any;
      const shopAccessible = s?.subscriptionStatus === 'active' ||
        (s?.subscriptionStatus === 'cancelled' && s?.subscriptionEnd && new Date(s.subscriptionEnd) > new Date());
      if (!shopAccessible && !userAccessible) setLocation('/admin/subscription');
    }
  }, [user, userAccessible, isSubLoading, setLocation]);

  if (isAuthLoading || isShopLoading) {
    return <div className="h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!user || user.role !== 'shop_owner') return null;

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast({ title: '입력 오류', description: '모든 필드를 입력해주세요.', variant: 'destructive' });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({ title: '입력 오류', description: '새 비밀번호가 일치하지 않습니다.', variant: 'destructive' });
      return;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{10,}$/;
    if (!passwordRegex.test(passwordForm.newPassword)) {
      toast({
        title: '비밀번호 형식 오류',
        description: '영문 대문자, 소문자, 숫자, 특수문자를 포함하여 10자 이상이어야 합니다.',
        variant: 'destructive',
      });
      return;
    }

    changePasswordMutation.mutate({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    });
  };

  const isSubscriptionActive = shop?.subscriptionStatus === 'active';
  const subscriptionLabel = isSubscriptionActive ? '활성' : '비활성';

  return (
    <div className="min-h-screen bg-secondary/30 pb-20">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation('/admin/dashboard')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center">
            <User className="w-5 h-5 text-foreground/70" />
          </div>
          <div>
            <h1 className="font-bold text-lg">설정</h1>
            <p className="text-sm text-muted-foreground">계정 및 구독 관리</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-4">

        {/* 계정 정보 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" /> 계정 정보
            </CardTitle>
            <CardDescription>로그인 계정 정보입니다</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">이메일 / 아이디</Label>
                <p className="text-sm font-medium bg-secondary/40 px-3 py-2 rounded-lg">
                  {(user as any).email || (user as any).username || '-'}
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">가게명</Label>
                <div className="flex items-center gap-2 bg-secondary/40 px-3 py-2 rounded-lg">
                  <p className="text-sm font-medium flex-1">{shop?.name || '-'}</p>
                  <button
                    onClick={() => setLocation('/admin/operations')}
                    className="text-xs text-primary hover:underline flex items-center gap-0.5"
                  >
                    수정 <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 비밀번호 변경 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" /> 비밀번호
            </CardTitle>
            <CardDescription>로그인 비밀번호를 변경합니다</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => setIsPasswordDialogOpen(true)} data-testid="button-open-password-dialog">
              <Key className="w-4 h-4 mr-2" />
              비밀번호 변경
            </Button>
          </CardContent>
        </Card>

        {/* 구독 관리 */}
        <Card className={isSubscriptionActive ? 'border-green-200 bg-green-50/50' : 'border-orange-200 bg-orange-50/50'}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isSubscriptionActive
                  ? <CheckCircle2 className="w-5 h-5 text-green-600" />
                  : <AlertCircle className="w-5 h-5 text-orange-500" />
                }
                구독 관리
              </div>
              <Badge variant={isSubscriptionActive ? 'default' : 'secondary'}>
                {subscriptionLabel}
              </Badge>
            </CardTitle>
            <CardDescription>
              {isSubscriptionActive
                ? '스탠다드 플랜 이용 중'
                : '구독을 활성화하여 서비스를 이용하세요'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              onClick={() => setLocation('/admin/subscription')}
              variant={isSubscriptionActive ? 'outline' : 'default'}
            >
              {isSubscriptionActive ? '구독 관리' : '구독하기'}
            </Button>
            {isSubscriptionActive && shop?.subscriptionEnd && (
              <p className="text-sm text-muted-foreground">
                만료일: {new Date(shop.subscriptionEnd).toLocaleDateString('ko-KR')}
              </p>
            )}
          </CardContent>
        </Card>

        {/* 회원 탈퇴 */}
        <div className="text-center pt-2 pb-4">
          <button
            onClick={() => setIsWithdrawDialogOpen(true)}
            className="text-xs text-muted-foreground/50 hover:text-red-500 transition-colors"
          >
            회원 탈퇴
          </button>
        </div>

      </main>

      {/* 비밀번호 변경 다이얼로그 */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={(open) => {
        setIsPasswordDialogOpen(open);
        if (!open) setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" /> 비밀번호 변경
            </DialogTitle>
            <DialogDescription>로그인 비밀번호를 변경합니다</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="current-password">현재 비밀번호</Label>
              <Input
                id="current-password"
                type="password"
                value={passwordForm.currentPassword}
                onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                placeholder="현재 비밀번호를 입력하세요"
                data-testid="input-current-password"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-password">새 비밀번호</Label>
              <Input
                id="new-password"
                type="password"
                value={passwordForm.newPassword}
                onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                placeholder="새 비밀번호를 입력하세요"
                data-testid="input-new-password"
              />
              <p className="text-xs text-muted-foreground">
                영문 대문자, 소문자, 숫자, 특수문자를 포함하여 10자 이상
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm-password">새 비밀번호 확인</Label>
              <Input
                id="confirm-password"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                placeholder="새 비밀번호를 다시 입력하세요"
                data-testid="input-confirm-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={changePasswordMutation.isPending} data-testid="button-change-password">
              {changePasswordMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              비밀번호 변경
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* 회원 탈퇴 - 비밀번호 확인 다이얼로그 */}
      <Dialog open={isWithdrawDialogOpen} onOpenChange={(open) => {
        setIsWithdrawDialogOpen(open);
        if (!open) setWithdrawPassword('');
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" /> 회원 탈퇴
            </DialogTitle>
            <DialogDescription>
              탈퇴하면 가맹점, 예약, 고객 데이터가 모두 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="withdraw-password">비밀번호 확인</Label>
            <Input
              id="withdraw-password"
              type="password"
              value={withdrawPassword}
              onChange={e => setWithdrawPassword(e.target.value)}
              placeholder="현재 비밀번호를 입력하세요"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsWithdrawDialogOpen(false)}>취소</Button>
            <Button
              variant="destructive"
              disabled={!withdrawPassword}
              onClick={() => {
                setIsWithdrawDialogOpen(false);
                setIsWithdrawConfirmOpen(true);
              }}
            >
              다음
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 회원 탈퇴 - 최종 확인 다이얼로그 */}
      <AlertDialog open={isWithdrawConfirmOpen} onOpenChange={setIsWithdrawConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>정말 탈퇴하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold text-red-600">{shop?.name}</span> 가맹점과 모든 예약·고객 데이터가
              영구 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIsWithdrawConfirmOpen(false);
              setWithdrawPassword('');
            }}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={withdrawMutation.isPending}
              onClick={() => withdrawMutation.mutate(withdrawPassword)}
            >
              {withdrawMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              탈퇴하기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
