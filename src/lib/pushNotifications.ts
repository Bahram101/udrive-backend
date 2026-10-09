import { Expo, ExpoPushMessage } from "expo-server-sdk";

const expo = new Expo();

export async function sendPushNotification(
  pushToken: string | null | undefined,
  title: string,
  body: string,
  data?: Record<string, unknown>,
  channelId: string = "orders-v2",
  sound: "default" | "alarm.wav" | "arrived.wav" | null = "alarm.wav",
): Promise<void> {
  if (!pushToken || !Expo.isExpoPushToken(pushToken)) {
    return;
  }

  try {
    const message: ExpoPushMessage = {
      to: pushToken,
      channelId,
      title,
      body,
      data,
    };
    if (sound) {
      message.sound = sound;
    }

    await expo.sendPushNotificationsAsync([message]);
  } catch (error) {
    console.error("Failed to send push notification", error);
  }
}
