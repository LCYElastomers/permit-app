export interface NotificationChoice {
  channel: string;
  topic: string;
  enabled: boolean;
}

export const NOTIFICATION_CHANNELS = [
  { code: "IN_APP", label: "In app" },
  { code: "SMS", label: "SMS" },
  { code: "EMAIL", label: "Email" },
] as const;

export const NOTIFICATION_TOPICS = [
  { code: "AUTHORIZATION_REQUESTED", label: "Authorization Requested" },
  { code: "PERMIT_ASSIGNED", label: "Permit Assigned / Receiver Action Required" },
  { code: "PERMIT_SUSPENDED", label: "Permit Suspended" },
  { code: "PERMIT_RETURNED", label: "Permit Returned for Correction" },
  { code: "PERMIT_EXPIRING", label: "Permit Expiring" },
  { code: "REAUTHORIZATION_REQUIRED", label: "Reauthorization Required" },
] as const;

export function normalizeEmail(raw: string): { email: string; error: string | null } {
  const trimmed = raw.trim();
  if (!trimmed) return { email: "", error: null };
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at >= trimmed.length - 1) return { email: "", error: "Enter a valid work email." };
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (/\s/.test(local) || /\s/.test(domain) || local.includes("@")) return { email: "", error: "Enter a valid work email." };
  if (!domain.includes(".") || domain.startsWith(".") || domain.endsWith(".") || domain.includes("..")) {
    return { email: "", error: "Enter a valid work email." };
  }
  const email = `${local}@${domain.toLowerCase()}`;
  if (email.length > 200) return { email: "", error: "Enter a valid work email." };
  return { email, error: null };
}

export function normalizePhone(raw: string): { e164: string | null; error: string | null } {
  const text = raw.trim();
  if (!text) return { e164: null, error: null };
  const international = text.startsWith("+");
  let digits = text.replace(/\D/g, "");
  if (!digits) return { e164: null, error: "Enter a valid phone number." };
  if (!international && digits.length === 10) digits = `1${digits}`;
  else if (!international && digits.length === 11 && digits.startsWith("1")) {
    /* already a US country code */
  } else if (!international) return { e164: null, error: "Enter a valid phone number." };
  if (digits.length < 8 || digits.length > 15 || digits.startsWith("0")) return { e164: null, error: "Enter a valid phone number." };
  return { e164: `+${digits}`, error: null };
}

export function preferenceEnabled(preferences: NotificationChoice[], channel: string, topic: string) {
  return preferences.some((item) => item.channel === channel && item.topic === topic && item.enabled);
}

export function preferencePayload(preferences: NotificationChoice[], mobile: string | null, email: string): NotificationChoice[] {
  return NOTIFICATION_CHANNELS.flatMap((channel) =>
    NOTIFICATION_TOPICS.map((topic) => ({
      channel: channel.code,
      topic: topic.code,
      enabled:
        preferenceEnabled(preferences, channel.code, topic.code)
        && (channel.code !== "SMS" || Boolean(mobile))
        && (channel.code !== "EMAIL" || email.length > 0),
    })),
  );
}
