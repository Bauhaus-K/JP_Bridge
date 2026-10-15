export type EmailMessage = { to: string; subject: string; text: string; html?: string };

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<{ id: string | null }>;
}

/** RESEND_API_KEY 가 없을 때: 실제 발송 없이 서버 로그로 남긴다 (개발·테스트용). */
export class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";
  async send(message: EmailMessage) {
    console.info(`[email:console] to=${message.to} subject=${message.subject}\n${message.text}`);
    return { id: null };
  }
}

export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(message: EmailMessage) {
    const res = await this.fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Resend ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { id: data.id ?? null };
  }
}

export function createEmailProvider(env: {
  RESEND_API_KEY?: string;
  EMAIL_FROM: string;
}): EmailProvider {
  return env.RESEND_API_KEY
    ? new ResendEmailProvider(env.RESEND_API_KEY, env.EMAIL_FROM)
    : new ConsoleEmailProvider();
}

export function emailDomain(address: string): string | null {
  const at = address.lastIndexOf("@");
  return at > 0 ? address.slice(at + 1).toLowerCase() : null;
}
