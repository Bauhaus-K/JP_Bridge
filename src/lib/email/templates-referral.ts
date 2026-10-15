import type { EmailMessage } from "./provider";

export function referralPacketEmail(params: {
  to: string;
  partnerName: string;
  packetText: string;
  consentedAt: string;
}): EmailMessage {
  return {
    to: params.to,
    subject: "[JP Bridge] 후보자 정보 전달 (본인 동의 완료)",
    text: [
      `${params.partnerName} 담당자님께`,
      "",
      `아래 후보자는 ${params.consentedAt}에 귀사로의 정보 제공(국외 이전 포함)에 명시적으로 동의했습니다.`,
      "동의 범위의 항목만 전달하며, 후보자가 동의를 철회하면 즉시 삭제를 요청드립니다.",
      "",
      params.packetText,
      "",
      "— JP Bridge 운영팀 (JP Bridge는 직업소개를 하지 않습니다)",
    ].join("\n"),
  };
}

export function referralRevokedEmail(params: {
  to: string;
  partnerName: string;
  candidateLabel: string;
  sentAt: string | null;
}): EmailMessage {
  return {
    to: params.to,
    subject: "[JP Bridge] 후보자 정보 제공 동의 철회 — 삭제 요청",
    text: [
      `${params.partnerName} 담당자님께`,
      "",
      `${params.sentAt ?? "이전"}에 전달드린 후보자(${params.candidateLabel})가 정보 제공 동의를 철회했습니다.`,
      "보유 중인 해당 후보자의 개인정보를 지체 없이 삭제해 주시고, 처리 결과를 회신해 주시기 바랍니다.",
      "",
      "— JP Bridge 운영팀",
    ].join("\n"),
  };
}

export function referralSentUserEmail(params: {
  to: string;
  displayName: string | null;
  partnerName: string;
}): EmailMessage {
  return {
    to: params.to,
    subject: `[JP Bridge] ${params.partnerName}에 정보를 전달했습니다`,
    text: [
      `${params.displayName ?? "회원"}님, 동의하신 항목을 ${params.partnerName}에 전달했습니다.`,
      "제휴사가 직접 연락드릴 수 있습니다. 동의는 '제휴사 연결' 화면에서 언제든 철회할 수 있습니다.",
    ].join("\n"),
  };
}
