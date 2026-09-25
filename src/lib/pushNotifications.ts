import { Expo } from "expo-server-sdk";

const expo = new Expo();

export async function sendPushNotification(
  pushToken: string | null | undefined,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  if (!pushToken || !Expo.isExpoPushToken(pushToken)) {
    return;
  }

  try {
    await expo.sendPushNotificationsAsync([
      { to: pushToken, sound: "alarm.wav", title, body, data },
    ]);
  } catch (error) {
    console.error("Failed to send push notification", error);
  }
}
