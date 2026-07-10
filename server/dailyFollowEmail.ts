import { and, desc, eq } from "drizzle-orm";
import type { CareContact, DevotionalNote, Prayer, User } from "@shared/schema";
import { careContacts, userEmailPreferences } from "@shared/schema";
import { getChurchReadingForToday } from "../src/lib/churchReading";
import { db } from "./db";
import { sendEmail } from "./resend";
import { storage } from "./storage";

const DEFAULT_APP_URL = "https://www.wechurch.online";

function appUrl(path = "/") {
  const base = (process.env.PUBLIC_APP_URL || process.env.APP_URL || DEFAULT_APP_URL).replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function truncate(value: unknown, max = 140) {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}...`;
}

function formatZhDate(date: Date) {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function categoryLabel(category?: string | null) {
  switch (category) {
    case "thanksgiving":
      return "感恩";
    case "supplication":
      return "代求";
    case "praise":
      return "讚美";
    default:
      return "代禱";
  }
}

function noteSnippet(note?: DevotionalNote) {
  if (!note) return null;

  const steps = [
    { label: "看見", value: note.observation },
    { label: "領受", value: note.coreInsightNote || note.heartbeatVerse },
    { label: "回應", value: note.actionPlan },
  ].filter((step) => step.value && String(step.value).trim());

  if (steps.length === 0) return null;
  return steps;
}

async function getCareContactsForEmail(userId: string): Promise<CareContact[]> {
  return db
    .select()
    .from(careContacts)
    .where(and(eq(careContacts.userId, userId), eq(careContacts.isArchived, false)))
    .orderBy(desc(careContacts.lastCaredAt), desc(careContacts.createdAt))
    .limit(3);
}

async function getPrayerWallItems(): Promise<Prayer[]> {
  const allPrayers = await storage.getPrayers();
  return allPrayers
    .filter((prayer) => !prayer.isAnswered)
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, 3);
}

export interface DailyFollowEmail {
  subject: string;
  html: string;
  text: string;
  context: {
    readingReference: string;
    readingDayNumber: number;
    hasDevotionalNote: boolean;
    prayerCount: number;
    careCount: number;
  };
}

export async function buildDailyFollowEmail(user: User, date = new Date()): Promise<DailyFollowEmail> {
  const reading = getChurchReadingForToday(date);
  const [devotionalNote, prayers, contacts] = await Promise.all([
    storage.getDevotionalNoteByVerseReference(user.id, reading.scriptureReference),
    getPrayerWallItems(),
    getCareContactsForEmail(user.id),
  ]);
  const noteSteps = noteSnippet(devotionalNote);
  const displayName = user.displayName || user.email.split("@")[0] || "弟兄姊妹";
  const zhDate = formatZhDate(date);

  const subject = `今天與主同行｜${zhDate}`;
  const preview = "今日經文、靈修短文、代禱事項與關懷提醒都在這裡。";

  const verseList = reading.previewVerses
    .map(
      (verse) => `
        <p style="margin:10px 0;color:#243044;font-size:17px;line-height:1.75;">
          <strong style="color:#3182ce;">${verse.verse}</strong>
          ${escapeHtml(verse.text)}
        </p>
      `,
    )
    .join("");

  const noteHtml = noteSteps
    ? `
      <div style="margin-top:18px;padding:16px;border:1px solid #bee3f8;border-radius:18px;background:#f7fbff;">
        <p style="margin:0 0 10px;color:#1f2937;font-size:16px;font-weight:800;">你的三步驟靈修筆記</p>
        ${noteSteps
          .map(
            (step) => `
              <p style="margin:8px 0;color:#40516a;font-size:15px;line-height:1.65;">
                <strong>${escapeHtml(step.label)}：</strong>${escapeHtml(truncate(step.value, 150))}
              </p>
            `,
          )
          .join("")}
      </div>
    `
    : `
      <div style="margin-top:18px;padding:16px;border:1px solid #e2e8f0;border-radius:18px;background:#f8fafc;">
        <p style="margin:0;color:#53657d;font-size:15px;line-height:1.7;">今天還沒有三步驟靈修筆記，可以從「看見、領受、回應」開始寫下一句。</p>
      </div>
    `;

  const prayerHtml = prayers.length
    ? prayers
        .map(
          (prayer) => `
            <tr>
              <td style="padding:14px 0;border-bottom:1px solid #edf2f7;">
                <p style="margin:0 0 6px;color:#243044;font-size:16px;font-weight:800;">${escapeHtml(categoryLabel(prayer.category))}${prayer.isPinned ? " · 置頂" : ""}</p>
                <p style="margin:0;color:#53657d;font-size:15px;line-height:1.7;">${escapeHtml(truncate(prayer.content, 170))}</p>
              </td>
            </tr>
          `,
        )
        .join("")
    : `
      <tr>
        <td style="padding:14px 0;color:#53657d;font-size:15px;line-height:1.7;">目前禱告牆沒有新的守望事項。</td>
      </tr>
    `;

  const careHtml = contacts.length
    ? contacts
        .map(
          (contact) => `
            <tr>
              <td style="padding:14px 0;border-bottom:1px solid #fff1e6;">
                <p style="margin:0 0 6px;color:#243044;font-size:16px;font-weight:800;">${escapeHtml(contact.name)}</p>
                ${contact.need ? `<p style="margin:0 0 4px;color:#53657d;font-size:15px;line-height:1.65;">需要：${escapeHtml(truncate(contact.need, 120))}</p>` : ""}
                ${contact.nextAction ? `<p style="margin:0;color:#53657d;font-size:15px;line-height:1.65;">下一步：${escapeHtml(truncate(contact.nextAction, 120))}</p>` : ""}
              </td>
            </tr>
          `,
        )
        .join("")
    : `
      <tr>
        <td style="padding:14px 0;color:#53657d;font-size:15px;line-height:1.7;">今天還沒有指定關懷對象，可以回到 App 加入一位需要記得的人。</td>
      </tr>
    `;

  const html = `
<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC','Microsoft JhengHei',sans-serif;color:#243044;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preview)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f7fb;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #dbe7f3;border-radius:24px;overflow:hidden;">
            <tr>
              <td style="padding:28px 24px 18px;background:#f8fbff;border-bottom:1px solid #dbe7f3;">
                <p style="margin:0 0 8px;color:#3182ce;font-size:15px;font-weight:800;">WeChurch 每日同行</p>
                <h1 style="margin:0;color:#243044;font-size:28px;line-height:1.25;">${escapeHtml(displayName)}，今天一起愛神、愛人</h1>
                <p style="margin:12px 0 0;color:#66758c;font-size:16px;">${escapeHtml(zhDate)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <h2 style="margin:0 0 12px;color:#1f2937;font-size:21px;">愛神｜今日靈修</h2>
                <p style="margin:0 0 10px;color:#243044;font-size:20px;font-weight:800;">${escapeHtml(reading.scriptureReference)}</p>
                <div style="padding:16px 18px;border-radius:20px;background:#eef6ff;">${verseList}</div>
                <div style="margin-top:18px;padding:18px;border-radius:20px;background:#ffffff;border:1px solid #dbeafe;">
                  <p style="margin:0 0 8px;color:#243044;font-size:18px;font-weight:800;">${escapeHtml(reading.devotionalTitle)}</p>
                  <p style="margin:0;color:#53657d;font-size:16px;line-height:1.8;">${escapeHtml(reading.devotionalText)}</p>
                </div>
                ${noteHtml}
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:18px;">
                  <tr>
                    <td style="padding-right:10px;">
                      <a href="${appUrl("/learn/church-reading")}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#3182ce;color:#ffffff;text-decoration:none;font-weight:800;font-size:15px;">打開今日靈修</a>
                    </td>
                    <td>
                      <a href="${appUrl("/learn/my-notes")}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#edf2f7;color:#243044;text-decoration:none;font-weight:800;font-size:15px;">回看筆記</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 24px 24px;">
                <h2 style="margin:0 0 12px;color:#1f2937;font-size:21px;">愛人｜今天去關心人</h2>
                <div style="padding:18px;border-radius:20px;background:#fffaf5;border:1px solid #fed7aa;">
                  <p style="margin:0 0 8px;color:#ea580c;font-size:16px;font-weight:800;">每日代求</p>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${prayerHtml}</table>
                </div>
                <div style="margin-top:16px;padding:18px;border-radius:20px;background:#fffdf8;border:1px solid #fde68a;">
                  <p style="margin:0 0 8px;color:#b45309;font-size:16px;font-weight:800;">具體關心的人</p>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${careHtml}</table>
                </div>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:18px;">
                  <tr>
                    <td style="padding-right:10px;">
                      <a href="${appUrl("/prayer-wall")}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#f43f5e;color:#ffffff;text-decoration:none;font-weight:800;font-size:15px;">前往禱告牆</a>
                    </td>
                    <td>
                      <a href="${appUrl("/care")}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#fff7ed;color:#c2410c;text-decoration:none;font-weight:800;font-size:15px;">管理關懷</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                <p style="margin:0;color:#66758c;font-size:13px;line-height:1.7;">這封信是 WeChurch 每日同行摘要，幫助你在一天開始時看見今天的經文、代禱與關懷。個人禱告清單目前仍在 App 內，之後會再接入每日信。</p>
                <p style="margin:10px 0 0;color:#66758c;font-size:13px;">
                  <a href="${appUrl("/grace-record")}" style="color:#3182ce;text-decoration:none;">打開個人禱告與恩典紀錄簿</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    `WeChurch 每日同行｜${zhDate}`,
    `${displayName}，今天一起愛神、愛人`,
    "",
    `今日經文：${reading.scriptureReference}`,
    ...reading.previewVerses.map((verse) => `${verse.verse} ${verse.text}`),
    "",
    `靈修短文：${reading.devotionalTitle}`,
    reading.devotionalText,
    "",
    noteSteps?.length
      ? `你的三步驟筆記：${noteSteps.map((step) => `${step.label}：${truncate(step.value, 120)}`).join(" / ")}`
      : "今天還沒有三步驟靈修筆記。",
    "",
    "每日代求：",
    ...(prayers.length ? prayers.map((prayer) => `- ${categoryLabel(prayer.category)}：${truncate(prayer.content, 150)}`) : ["- 目前禱告牆沒有新的守望事項。"]),
    "",
    "具體關心的人：",
    ...(contacts.length
      ? contacts.map((contact) => `- ${contact.name}${contact.need ? `｜需要：${truncate(contact.need, 100)}` : ""}${contact.nextAction ? `｜下一步：${truncate(contact.nextAction, 100)}` : ""}`)
      : ["- 今天還沒有指定關懷對象。"]),
    "",
    `今日靈修：${appUrl("/learn/church-reading")}`,
    `靈修筆記：${appUrl("/learn/my-notes")}`,
    `禱告牆：${appUrl("/prayer-wall")}`,
    `關懷：${appUrl("/care")}`,
    `個人禱告與恩典紀錄簿：${appUrl("/grace-record")}`,
  ].join("\n");

  return {
    subject,
    html,
    text,
    context: {
      readingReference: reading.scriptureReference,
      readingDayNumber: reading.dayNumber,
      hasDevotionalNote: Boolean(noteSteps?.length),
      prayerCount: prayers.length,
      careCount: contacts.length,
    },
  };
}

export async function sendDailyFollowEmail(user: User, date = new Date()) {
  const email = await buildDailyFollowEmail(user, date);
  await sendEmail({
    to: user.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });

  await db
    .insert(userEmailPreferences)
    .values({
      userId: user.id,
      dailyFollowEnabled: false,
      dailyFollowTime: "07:00",
      timezone: "Asia/Taipei",
      lastDailyFollowSentAt: date,
    })
    .onConflictDoUpdate({
      target: userEmailPreferences.userId,
      set: {
        lastDailyFollowSentAt: date,
        updatedAt: date,
      },
    });

  return email.context;
}
