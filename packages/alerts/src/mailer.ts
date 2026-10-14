import { Resend } from "resend";

export type Email = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** e.g. List-Unsubscribe for one-click unsubscribe in mail clients. */
  headers?: Record<string, string>;
};

export interface Mailer {
  send(email: Email): Promise<void>;
}

/** Sends through Resend (RESEND_API_KEY, EMAIL_FROM). */
export class ResendMailer implements Mailer {
  private readonly resend: Resend;
  constructor(
    apiKey = process.env.RESEND_API_KEY,
    private readonly from = process.env.EMAIL_FROM ?? "TeToca <alertas@example.org>",
  ) {
    if (!apiKey) throw new Error("RESEND_API_KEY is not set");
    this.resend = new Resend(apiKey);
  }
  async send(email: Email): Promise<void> {
    const { error } = await this.resend.emails.send({ from: this.from, ...email });
    if (error) throw new Error(`Resend: ${error.message}`);
  }
}

/** Development fallback: prints emails instead of sending them. */
export class ConsoleMailer implements Mailer {
  readonly sent: Email[] = [];
  async send(email: Email): Promise<void> {
    this.sent.push(email);
    console.log(`\n[email] To: ${email.to}\nSubject: ${email.subject}\n${email.text}\n`);
  }
}

export function createMailer(): Mailer {
  return process.env.RESEND_API_KEY ? new ResendMailer() : new ConsoleMailer();
}
