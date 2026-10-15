import type { EmailMessage } from "./provider";

export function planRequestedAdminEmail(params: {
  to: string;
  userLabel: string;
  link: string;
}): EmailMessage {
  const text = `${params.userLabel} 님이 프로 플랜을 신청했습니다.\n운영자 콘솔에서 확인 후 활성화해 주세요.\n\n${params.link}`;
  return { to: params.to, subject: "[JP Bridge 운영] 프로 플랜 신청", text };
}

export function planActivatedEmail(params: {
  to: string;
  displayName: string | null;
  periodEnd: string | null;
  link: string;
}): EmailMessage {
  const until = params.periodEnd
    ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeZone: "Asia/Seoul" }).format(
        new Date(params.periodEnd),
      )
    : "별도 안내 시까지";
  const text = `${params.displayName ?? "회원"}님, 프로 플랜이 활성화되었습니다 (이용 기간: ${until}).\nAI 코칭 한도와 운영자 검수 횟수가 늘어났습니다.\n\n${params.link}`;
  return { to: params.to, subject: "[JP Bridge] 프로 플랜이 활성화되었습니다", text };
}
