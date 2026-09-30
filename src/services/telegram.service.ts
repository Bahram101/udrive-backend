import { prisma } from "@/lib/prisma";
import { PHONE_REGEX } from "@/lib/constants";
import { createOtpCode } from "@/lib/otp";

const TELEGRAM_API_BASE = "https://api.telegram.org";

function normalizePhone(rawPhone: string): string | null {
  const digits = rawPhone.replace(/[^0-9]/g, "");
  const phone = digits.startsWith("7")
    ? `+${digits}`
    : `+7${digits.slice(-10)}`;
  return PHONE_REGEX.test(phone) ? phone : null;
}

export const TelegramService = {
  
  async getChatIdForPhone(phone: string): Promise<string | null> {
    const link = await prisma.telegramLink.findUnique({ where: { phone } });
    return link?.chatId ?? null;
  },

  async sendMessage(chatId: string, text: string): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      console.error("TELEGRAM_BOT_TOKEN is not configured");
      return;
    }
    const response = await fetch(
      `${TELEGRAM_API_BASE}/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      },
    );

    if (!response.ok) {
      console.error("Failed to send Telegram message", await response.text());
    }
  },

  async handleStart(chatId: string): Promise<void> {
    await this.sendMessage(
      chatId,
      "Здравствуйте! Чтобы получать коды подтверждения uDrive в Telegram, поделитесь номером телефона кнопкой ниже.",
    );

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;

    await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "Нажмите кнопку, чтобы поделиться номером",
        reply_markup: {
          keyboard: [
            [{ text: "📱 Поделиться номером", request_contact: true }],
          ],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      }),
    });
  },

  async handleContact(chatId: string, rawPhone: string): Promise<void> {
    const phone = normalizePhone(rawPhone);

    if (!phone) {
      await this.sendMessage(chatId, "Не удалось распознать номер телефона.");
      return;
    }

    await prisma.telegramLink.upsert({
      where: { phone },
      create: { phone, chatId },
      update: { chatId },
    });

    const code = await createOtpCode(phone);

    await this.sendMessage(
      chatId,
      `Готово! Ваш код подтверждения uDrive: ${code}`,
    );
  },
};
