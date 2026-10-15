import { prisma } from "@/lib/prisma";
import { FINISHED_ORDER_STATUSES } from "@/lib/constants";
import { daysBetween, startOfAlmatyDay, startOfAlmatyWeek } from "@/lib/time";

const RECENT_ORDERS_LIMIT = 6;
const DAYS_IN_WEEK = 7;

export const AdminService = {
  async getDashboard() {
    const now = new Date();
    const todayStart = startOfAlmatyDay(now);
    const yesterdayStart = startOfAlmatyDay(now, -1);
    const weekStart = startOfAlmatyWeek(now);
    const activeOrder = { status: { notIn: FINISHED_ORDER_STATUSES } };
    const completedBetween = (from: Date, to?: Date) => ({
      status: "COMPLETED" as const,
      completedAt: { gte: from, ...(to && { lt: to }) },
    });

    const [
      activeOrders,
      waitingOrders,
      driversTotal,
      onlineDrivers,
      ordersToday,
      ordersYesterday,
      revenueToday,
      revenueYesterday,
      recentOrders,
      activeOrderPoints,
      weekOrders,
    ] = await Promise.all([
      prisma.order.count({ where: activeOrder }),
      prisma.order.count({ where: { status: "NEW" } }),
      prisma.driver.count({ where: { user: { role: "DRIVER" } } }),
      prisma.driver.findMany({
        where: { isOnline: true },
        orderBy: { rating: "desc" },
        select: {
          id: true,
          carModel: true,
          carNumber: true,
          rating: true,
          lat: true,
          lng: true,
          lastSeenAt: true,
          user: { select: { name: true } },
          orders: { where: activeOrder, select: { id: true }, take: 1 },
        },
      }),
      prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.order.count({ where: { createdAt: { gte: yesterdayStart, lt: todayStart } } }),
      prisma.order.aggregate({ _sum: { price: true }, where: completedBetween(todayStart) }),
      prisma.order.aggregate({
        _sum: { price: true },
        where: completedBetween(yesterdayStart, todayStart),
      }),
      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        take: RECENT_ORDERS_LIMIT,
        select: {
          id: true,
          status: true,
          fromAddress: true,
          toAddress: true,
          price: true,
          createdAt: true,
          cancelledBy: true,
          client: { select: { name: true } },
          driver: { select: { carModel: true, carNumber: true, user: { select: { name: true } } } },
        },
      }),
      prisma.order.findMany({
        where: activeOrder,
        select: { id: true, fromLat: true, fromLng: true },
      }),
      prisma.order.findMany({
        where: { createdAt: { gte: weekStart } },
        select: { createdAt: true },
      }),
    ]);

    // Orders per day of the current week, Monday first.
    const weeklyOrders = Array<number>(DAYS_IN_WEEK).fill(0);
    for (const { createdAt } of weekOrders) {
      const day = daysBetween(weekStart, createdAt);
      if (day >= 0 && day < DAYS_IN_WEEK) weeklyOrders[day] += 1;
    }

    return {
      generatedAt: now.toISOString(),
      stats: {
        activeOrders,
        waitingOrders,
        driversOnline: onlineDrivers.length,
        driversTotal,
        ordersToday,
        ordersYesterday,
        revenueToday: revenueToday._sum.price ?? 0,
        revenueYesterday: revenueYesterday._sum.price ?? 0,
      },
      recentOrders: recentOrders.map(({ client, driver, ...order }) => ({
        ...order,
        clientName: client.name,
        driver: driver && {
          name: driver.user.name,
          carModel: driver.carModel,
          carNumber: driver.carNumber,
        },
      })),
      onlineDrivers: onlineDrivers.map(({ user, orders, ...driver }) => ({
        ...driver,
        name: user.name,
        isBusy: orders.length > 0,
      })),
      activeOrderPoints: activeOrderPoints.map(({ id, fromLat, fromLng }) => ({
        id,
        lat: fromLat,
        lng: fromLng,
      })),
      weeklyOrders,
    };
  },
};
