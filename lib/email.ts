import { Resend } from "resend";

type OtpType = "sign-in" | "email-verification" | "forget-password";

type SendOtpEmailParams = {
  email: string;
  otp: string;
  type: OtpType;
};

const messages: Record<OtpType, { subject: string; heading: string }> = {
  "sign-in": {
    subject: "Dein Anmeldecode",
    heading: "Melde dich bei Kognito an",
  },
  "email-verification": {
    subject: "Bestätige deine E-Mail-Adresse",
    heading: "Bestätige deine E-Mail-Adresse",
  },
  "forget-password": {
    subject: "Dein Code zum Zurücksetzen des Passworts",
    heading: "Setze dein Passwort zurück",
  },
};

export async function sendOtpEmail({
  email,
  otp,
  type,
}: SendOtpEmailParams) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;

  if (!apiKey) {
    throw new Error("Resend API key is not set in environment variables.");
  }

  if (!from) {
    throw new Error("Resend from email is not set in environment variables.");
  }

  const message = messages[type];
  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from,
    to: [email],
    subject: message.subject,
    text: `${message.heading}\n\nDein Code lautet: ${otp}\n\nEr ist 5 Minuten gültig. Falls du diese Anfrage nicht gestellt hast, ignoriere diese E-Mail.`,
    html: `
      <h1>${message.heading}</h1>
      <p>Dein Code lautet:</p>
      <p style="font-size: 32px; font-weight: 700; letter-spacing: 0.2em;">
        ${otp}
      </p>
      <p>Der Code ist 5 Minuten gültig.</p>
      <p>Falls du diese Anfrage nicht gestellt hast, ignoriere diese E-Mail.</p>
    `,
  });

  if (error) {
    throw new Error(
      `Resend konnte die E-Mail nicht versenden: ${error.message}`
    );
  }
}