import type { EmailMessage } from "./provider";

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function layout(paragraphs: string[], link?: { href: string; label: string }) {
  const body = paragraphs.map(
    (p) => `<p style="margin:0 0 12px;line-height:1.6">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`,
  );
  if (link) {
    body.push(
      `<p style="margin:16px 0"><a href="${escapeHtml(link.href)}" style="background:#3446b4;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">${escapeHtml(link.label)}</a></p>`,
    );
  }
  body.push(
    '<p style="margin:24px 0 0;color:#666;font-size:12px">JP Bridge · 이 메일은 발신 전용입니다.</p>',
  );
  return `<div style="font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;max-width:560px">${body.join("")}</div>`;
}

export const REVIEW_TARGET_LABEL = {
  es_version: "ES",
  career_translation: "職務経歴書(경력 번역)",
  interview_session: "모의면접 리포트",
} as const;

export function reviewDoneEmail(params: {
  to: string;
  displayName: string | null;
  targetType: keyof typeof REVIEW_TARGET_LABEL;
  link: string;
}): EmailMessage {
  const name = params.displayName ? `${params.displayName}님` : "안녕하세요";
  const target = REVIEW_TARGET_LABEL[params.targetType];
  const lines = [
    `${name}, 요청하신 ${target} 운영자 검수가 완료되었습니다.`,
    "검수 코멘트와 수정 제안은 아래 링크에서 확인할 수 있습니다. 최종 판단은 본인이 합니다.",
  ];
  return {
    to: params.to,
    subject: `[JP Bridge] ${target} 검수가 완료되었습니다`,
    text: `${lines.join("\n\n")}\n\n${params.link}`,
    html: layout(lines, { href: params.link, label: "검수 결과 보기" }),
  };
}
