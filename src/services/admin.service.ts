import { Prisma, type OrderStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { FINISHED_ORDER_STATUSES } from "@/lib/constants";
import {
  almatyDayStartFromDateString,
  daysBetween,
  startOfAlmatyDay,
  startOfAlmatyWeek,
} from "@/lib/time";
import type {
  AdminDriversQuery,
  AdminDriverStatus,
  AdminOrdersQuery,
} from "@/schemas/admin.schema";

const RECENT_ORDERS_LIMIT = 6;
const DAYS_IN_WEEK = 7;

const adminOrderSelect = {
  id: true,
  status: true,
  fromAddress: true,
  toAddress: true,
  price: true,
  createdAt: true,
  completedAt: true,
  cancelledAt: true,
  cancelledBy: true,
  client: {
    select: {
      name: true,
      phone: true,
    },
  },
  driver: {
    select: {
      carModel: true,
      carNumber: true,
      user: {
        select: {
          name: true,
          phone: true,
        },
      },
    },
  },
} as const;

type AdminOrderRecord = Prisma.OrderGetPayload<{ select: typeof adminOrderSelect }>;

function toAdminOrder(order: AdminOrderRecord) {
  return {
    id: order.id,
    status: order.status,
    fromAddress: order.fromAddress,
    toAddress: order.toAddress,
    price: order.price,
    createdAt: order.createdAt,
    completedAt: order.completedAt,
    cancelledAt: order.cancelledAt,
    cancelledBy: order.cancelledBy,
    client: {
      name: order.client.name,
      phone: order.client.phone,
    },
    driver: order.driver
      ? {
          name: order.driver.user.name,
          phone: order.driver.user.phone,
          carModel: order.driver.carModel,
          carNumber: order.driver.carNumber,
        }
      : null,
  };
}

const adminDriverSelect = {
  id: true,
  carModel: true,
  carNumber: true,
  rating: true,
  isOnline: true,
  lastSeenAt: true,
  createdAt: true,
  user: {
    select: {
      name: true,
      phone: true,
    },
  },
  orders: {
    where: { status: { notIn: FINISHED_ORDER_STATUSES } },
    select: { id: true },
    take: 1,
  },
} as const;

type AdminDriverRecord = Prisma.DriverGetPayload<{ select: typeof adminDriverSelect }>;

interface DriverOrderStats {
  completedOrders: number;
  cancelledOrders: number;
}

function toAdminDriver(
  driver: AdminDriverRecord,
  stats: DriverOrderStats = { completedOrders: 0, cancelledOrders: 0 },
) {
  return {
    id: driver.id,
    name: driver.user.name,
    phone: driver.user.phone,
    carModel: driver.carModel,
    carNumber: driver.carNumber,
    rating: driver.rating,
    isOnline: driver.isOnline,
    isBusy: driver.orders.length > 0,
    lastSeenAt: driver.lastSeenAt,
    createdAt: driver.createdAt,
    completedOrders: stats.completedOrders,
    cancelledOrders: stats.cancelledOrders,
  };
}

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
        select: adminOrderSelect,
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
      recentOrders: recentOrders.map(toAdminOrder),
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

  async getOrders(query: AdminOrdersQuery) {
    const skip = (query.page - 1) * query.pageSize;
    const take = query.pageSize;

    const baseWhere: Prisma.OrderWhereInput = {};

    if (query.from || query.to) {
      const createdAtFilter: Prisma.DateTimeFilter = {};
      if (query.from) {
        createdAtFilter.gte = almatyDayStartFromDateString(query.from);
      }
      if (query.to) {
        createdAtFilter.lt = startOfAlmatyDay(almatyDayStartFromDateString(query.to), 1);
      }
      baseWhere.createdAt = createdAtFilter;
    }

    if (query.q) {
      const idQuery = query.q.replace(/^#+/, "").toLowerCase();
      baseWhere.OR = [
        { client: { name: { contains: query.q, mode: "insensitive" } } },
        { client: { phone: { contains: query.q } } },
        { driver: { user: { name: { contains: query.q, mode: "insensitive" } } } },
        { driver: { carNumber: { contains: query.q, mode: "insensitive" } } },
        { fromAddress: { contains: query.q, mode: "insensitive" } },
        { toAddress: { contains: query.q, mode: "insensitive" } },
        // Empty prefix (q = "#") would match every order.
        ...(idQuery ? [{ id: { startsWith: idQuery } }] : []),
      ];
    }

    const where: Prisma.OrderWhereInput = { ...baseWhere };

    if (query.status === "ACTIVE") {
      where.status = { notIn: FINISHED_ORDER_STATUSES };
    } else if (query.status) {
      where.status = query.status;
    }

    const [orders, total, statusGroups] = await Promise.all([
      prisma.order.findMany({
        where,
        select: adminOrderSelect,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.order.count({ where }),
      prisma.order.groupBy({
        by: ["status"],
        where: baseWhere,
        _count: { _all: true },
      }),
    ]);

    const statusCounts: Record<OrderStatus, number> = {
      NEW: 0,
      ACCEPTED: 0,
      ARRIVED: 0,
      STARTED: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };

    for (const group of statusGroups) {
      statusCounts[group.status] = group._count._all;
    }

    return {
      items: orders.map(toAdminOrder),
      total,
      page: query.page,
      pageSize: query.pageSize,
      statusCounts,
    };
  },

  async getDrivers(query: AdminDriversQuery) {
    const skip = (query.page - 1) * query.pageSize;
    const take = query.pageSize;

    const baseWhere: Prisma.DriverWhereInput = {
      user: { role: "DRIVER" },
    };

    if (query.q) {
      baseWhere.OR = [
        { user: { name: { contains: query.q, mode: "insensitive" } } },
        { user: { phone: { contains: query.q } } },
        { carNumber: { contains: query.q, mode: "insensitive" } },
        { carModel: { contains: query.q, mode: "insensitive" } },
      ];
    }

    const activeOrderWhere: Prisma.OrderWhereInput = {
      status: { notIn: FINISHED_ORDER_STATUSES },
    };

    const statusConditions: Record<AdminDriverStatus, Prisma.DriverWhereInput> = {
      ONLINE: { isOnline: true },
      FREE: { isOnline: true, orders: { none: activeOrderWhere } },
      BUSY: { orders: { some: activeOrderWhere } },
      OFFLINE: { isOnline: false },
    };

    const where: Prisma.DriverWhereInput = query.status
      ? { ...baseWhere, ...statusConditions[query.status] }
      : { ...baseWhere };

    const [drivers, total, onlineCount, freeCount, busyCount, offlineCount] =
      await Promise.all([
        prisma.driver.findMany({
          where,
          select: adminDriverSelect,
          orderBy: [
            { isOnline: "desc" },
            { rating: "desc" },
            { createdAt: "desc" },
          ],
          skip,
          take,
        }),
        prisma.driver.count({ where }),
        prisma.driver.count({ where: { ...baseWhere, ...statusConditions.ONLINE } }),
        prisma.driver.count({ where: { ...baseWhere, ...statusConditions.FREE } }),
        prisma.driver.count({ where: { ...baseWhere, ...statusConditions.BUSY } }),
        prisma.driver.count({ where: { ...baseWhere, ...statusConditions.OFFLINE } }),
      ]);

    const driverIds = drivers.map((driver) => driver.id);
    const orderCounts =
      driverIds.length > 0
        ? await prisma.order.groupBy({
            by: ["driverId", "status"],
            where: {
              driverId: { in: driverIds },
              status: { in: ["COMPLETED", "CANCELLED"] },
            },
            _count: { _all: true },
          })
        : [];

    const orderStatsByDriver = new Map<string, DriverOrderStats>();

    for (const row of orderCounts) {
      if (!row.driverId) continue;
      const stats = orderStatsByDriver.get(row.driverId) ?? {
        completedOrders: 0,
        cancelledOrders: 0,
      };
      if (row.status === "COMPLETED") {
        stats.completedOrders = row._count._all;
      } else if (row.status === "CANCELLED") {
        stats.cancelledOrders = row._count._all;
      }
      orderStatsByDriver.set(row.driverId, stats);
    }

    return {
      items: drivers.map((driver) =>
        toAdminDriver(driver, orderStatsByDriver.get(driver.id)),
      ),
      total,
      page: query.page,
      pageSize: query.pageSize,
      statusCounts: {
        ONLINE: onlineCount,
        FREE: freeCount,
        BUSY: busyCount,
        OFFLINE: offlineCount,
      },
    };
  },
};
