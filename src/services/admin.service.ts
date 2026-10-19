import { Prisma, type OrderStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { FINISHED_ORDER_STATUSES, PLATFORM_COMMISSION_RATE } from "@/lib/constants";
import {
  almatyDateRangeToUtc,
  daysBetween,
  formatAlmatyDate,
  startOfAlmatyDay,
  startOfAlmatyMonth,
  startOfAlmatyWeek,
} from "@/lib/time";
import type {
  AdminClientsQuery,
  AdminClientStatus,
  AdminDriversQuery,
  AdminDriverStatus,
  AdminOrdersQuery,
  AdminPayoutsQuery,
} from "@/schemas/admin.schema";

function calculateCommission(
  earnings: number,
  rate = PLATFORM_COMMISSION_RATE,
): { commission: number; net: number } {
  const commission = Math.round(earnings * rate);
  const net = earnings - commission;
  return { commission, net };
}

const RECENT_ORDERS_LIMIT = 6;
const DAYS_IN_WEEK = 7;

const activeOrderFilter = { status: { notIn: FINISHED_ORDER_STATUSES } } as const;

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

const adminOnlineDriverSelect = {
  id: true,
  carModel: true,
  carNumber: true,
  rating: true,
  lat: true,
  lng: true,
  lastSeenAt: true,
  user: {
    select: {
      name: true,
    },
  },
  orders: {
    where: activeOrderFilter,
    select: { id: true },
    take: 1,
  },
} as const;

type AdminOnlineDriverRecord = Prisma.DriverGetPayload<{ select: typeof adminOnlineDriverSelect }>;

function toAdminOnlineDriver(driver: AdminOnlineDriverRecord) {
  const { user, orders, ...rest } = driver;
  return {
    ...rest,
    name: user.name,
    isBusy: orders.length > 0,
  };
}

const adminMapOrderSelect = {
  id: true,
  fromAddress: true,
  toAddress: true,
  createdAt: true,
  fromLat: true,
  fromLng: true,
} as const;

type AdminMapOrderRecord = Prisma.OrderGetPayload<{ select: typeof adminMapOrderSelect }>;

function toAdminMapOrder(order: AdminMapOrderRecord) {
  return {
    id: order.id,
    fromAddress: order.fromAddress,
    toAddress: order.toAddress,
    createdAt: order.createdAt,
    lat: order.fromLat,
    lng: order.fromLng,
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
    where: activeOrderFilter,
    select: { id: true },
    take: 1,
  },
} as const;

type AdminDriverRecord = Prisma.DriverGetPayload<{ select: typeof adminDriverSelect }>;

interface OrderStats {
  total: number;
  completed: number;
  cancelled: number;
}

function buildOrderStatsMap<K extends "driverId" | "clientId">(
  rows: Array<{ status: OrderStatus; _count: { _all: number } } & Record<K, string | null>>,
  key: K,
): Map<string, OrderStats> {
  const map = new Map<string, OrderStats>();
  for (const row of rows) {
    const id = row[key];
    if (!id) continue;
    const stats = map.get(id) ?? { total: 0, completed: 0, cancelled: 0 };
    stats.total += row._count._all;
    if (row.status === "COMPLETED") {
      stats.completed += row._count._all;
    } else if (row.status === "CANCELLED") {
      stats.cancelled += row._count._all;
    }
    map.set(id, stats);
  }
  return map;
}

function toAdminDriver(
  driver: AdminDriverRecord,
  stats: OrderStats = { total: 0, completed: 0, cancelled: 0 },
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
    completedOrders: stats.completed,
    cancelledOrders: stats.cancelled,
  };
}

const adminClientSelect = {
  id: true,
  name: true,
  phone: true,
  rating: true,
  createdAt: true,
  orders: {
    where: { status: { notIn: FINISHED_ORDER_STATUSES } },
    select: { status: true },
    orderBy: { createdAt: "desc" },
    take: 1,
  },
} as const;

type AdminClientRecord = Prisma.UserGetPayload<{ select: typeof adminClientSelect }>;

function toAdminClient(
  client: AdminClientRecord,
  stats: OrderStats = { total: 0, completed: 0, cancelled: 0 },
  lastOrderAt?: string | null,
) {
  return {
    id: client.id,
    name: client.name,
    phone: client.phone,
    rating: client.rating,
    createdAt: client.createdAt,
    totalOrders: stats.total,
    completedOrders: stats.completed,
    cancelledOrders: stats.cancelled,
    lastOrderAt: lastOrderAt ?? null,
    activeOrderStatus: client.orders[0]?.status ?? null,
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
        select: adminOnlineDriverSelect,
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
      onlineDrivers: onlineDrivers.map(toAdminOnlineDriver),
      activeOrderPoints: activeOrderPoints.map(({ id, fromLat, fromLng }) => ({
        id,
        lat: fromLat,
        lng: fromLng,
      })),
      weeklyOrders,
    };
  },

  async getMapData() {
    const now = new Date();
    const [onlineDrivers, waitingOrders] = await Promise.all([
      prisma.driver.findMany({
        where: {
          isOnline: true,
          lat: { not: null },
          lng: { not: null },
        },
        orderBy: { rating: "desc" },
        select: adminOnlineDriverSelect,
      }),
      prisma.order.findMany({
        where: { status: "NEW" },
        orderBy: { createdAt: "desc" },
        select: adminMapOrderSelect,
      }),
    ]);

    const drivers = onlineDrivers.map((driver) => {
      const base = toAdminOnlineDriver(driver);
      return {
        id: base.id,
        name: base.name,
        carModel: base.carModel,
        carNumber: base.carNumber,
        lat: base.lat as number,
        lng: base.lng as number,
        isBusy: base.isBusy,
        lastSeenAt: base.lastSeenAt,
      };
    });

    const orders = waitingOrders.map(toAdminMapOrder);

    const busyDrivers = drivers.filter((d) => d.isBusy).length;
    const freeDrivers = drivers.length - busyDrivers;

    return {
      generatedAt: now.toISOString(),
      drivers,
      orders,
      counts: {
        waitingOrders: orders.length,
        busyDrivers,
        freeDrivers,
      },
    };
  },

  async getOrders(query: AdminOrdersQuery) {
    const skip = (query.page - 1) * query.pageSize;
    const take = query.pageSize;

    const baseWhere: Prisma.OrderWhereInput = {};

    const createdAtRange = almatyDateRangeToUtc(query.from, query.to);
    if (createdAtRange) {
      baseWhere.createdAt = createdAtRange;
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

    const orderStatsByDriver = buildOrderStatsMap(orderCounts, "driverId");

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

  async getClients(query: AdminClientsQuery) {
    const skip = (query.page - 1) * query.pageSize;
    const take = query.pageSize;

    const baseWhere: Prisma.UserWhereInput = {
      role: "CLIENT",
    };

    if (query.q) {
      baseWhere.OR = [
        { name: { contains: query.q, mode: "insensitive" } },
        { phone: { contains: query.q } },
      ];
    }

    const activeOrderWhere: Prisma.OrderWhereInput = {
      status: { notIn: FINISHED_ORDER_STATUSES },
    };

    const statusConditions: Record<AdminClientStatus, Prisma.UserWhereInput> = {
      ACTIVE: { orders: { some: activeOrderWhere } },
      NO_ORDERS: { orders: { none: {} } },
    };

    const where: Prisma.UserWhereInput = query.status
      ? { ...baseWhere, ...statusConditions[query.status] }
      : { ...baseWhere };

    const [clients, allCount, activeCount, noOrdersCount] = await Promise.all([
      prisma.user.findMany({
        where,
        select: adminClientSelect,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.user.count({ where: baseWhere }),
      prisma.user.count({ where: { ...baseWhere, ...statusConditions.ACTIVE } }),
      prisma.user.count({ where: { ...baseWhere, ...statusConditions.NO_ORDERS } }),
    ]);

    const total = query.status
      ? query.status === "ACTIVE"
        ? activeCount
        : noOrdersCount
      : allCount;

    const clientIds = clients.map((client) => client.id);

    const [orderCounts, lastOrders] =
      clientIds.length > 0
        ? await Promise.all([
            prisma.order.groupBy({
              by: ["clientId", "status"],
              where: { clientId: { in: clientIds } },
              _count: { _all: true },
            }),
            prisma.order.groupBy({
              by: ["clientId"],
              where: { clientId: { in: clientIds } },
              _max: { createdAt: true },
            }),
          ])
        : [[], []];

    const orderStatsByClient = buildOrderStatsMap(orderCounts, "clientId");
    const lastOrderAtByClient = new Map(
      lastOrders.map((row) => [
        row.clientId,
        row._max.createdAt ? row._max.createdAt.toISOString() : null,
      ]),
    );

    return {
      items: clients.map((client) =>
        toAdminClient(
          client,
          orderStatsByClient.get(client.id),
          lastOrderAtByClient.get(client.id),
        ),
      ),
      total,
      page: query.page,
      pageSize: query.pageSize,
      statusCounts: {
        ALL: allCount,
        ACTIVE: activeCount,
        NO_ORDERS: noOrdersCount,
      },
    };
  },

  async getPayouts(query: AdminPayoutsQuery) {
    const skip = (query.page - 1) * query.pageSize;
    const take = query.pageSize;

    const now = new Date();
    const from = query.from ?? formatAlmatyDate(startOfAlmatyMonth(now));
    const to = query.to ?? formatAlmatyDate(now);
    const completedAtRange = almatyDateRangeToUtc(from, to);

    const where: Prisma.OrderWhereInput = {
      status: "COMPLETED",
      driverId: { not: null },
      ...(completedAtRange && { completedAt: completedAtRange }),
    };

    if (query.q) {
      where.driver = {
        OR: [
          { user: { name: { contains: query.q, mode: "insensitive" } } },
          { user: { phone: { contains: query.q } } },
          { carNumber: { contains: query.q, mode: "insensitive" } },
        ],
      };
    }

    const [allGroups, pagedGroups] = await Promise.all([
      prisma.order.groupBy({
        by: ["driverId"],
        where,
        _sum: { price: true },
        _count: { _all: true },
      }),
      prisma.order.groupBy({
        by: ["driverId"],
        where,
        _sum: { price: true },
        _count: { _all: true },
        _max: { completedAt: true },
        orderBy: { _sum: { price: "desc" } },
        skip,
        take,
      }),
    ]);

    const total = allGroups.length;
    const totalEarnings = allGroups.reduce((acc, g) => acc + (g._sum.price ?? 0), 0);
    const completedOrders = allGroups.reduce((acc, g) => acc + g._count._all, 0);
    const { commission: totalCommission, net: totalNet } =
      calculateCommission(totalEarnings, PLATFORM_COMMISSION_RATE);

    const driverIds = pagedGroups
      .map((g) => g.driverId)
      .filter((id): id is string => Boolean(id));

    const drivers =
      driverIds.length > 0
        ? await prisma.driver.findMany({
            where: { id: { in: driverIds } },
            select: {
              id: true,
              carModel: true,
              carNumber: true,
              user: {
                select: {
                  name: true,
                  phone: true,
                },
              },
            },
          })
        : [];

    const driversById = new Map(drivers.map((d) => [d.id, d]));

    const items = pagedGroups.map((group) => {
      const driver = group.driverId ? driversById.get(group.driverId) : undefined;
      const earnings = group._sum.price ?? 0;
      const count = group._count._all;
      const { commission, net } = calculateCommission(earnings, PLATFORM_COMMISSION_RATE);
      const averageCheck = count > 0 ? Math.round(earnings / count) : 0;
      const lastCompletedAt = group._max.completedAt
        ? group._max.completedAt.toISOString()
        : null;

      return {
        driverId: group.driverId ?? "",
        name: driver?.user.name ?? "—",
        phone: driver?.user.phone ?? "—",
        carModel: driver?.carModel ?? null,
        carNumber: driver?.carNumber ?? null,
        completedOrders: count,
        earnings,
        commission,
        net,
        averageCheck,
        lastCompletedAt,
      };
    });

    return {
      period: { from, to },
      commissionRate: PLATFORM_COMMISSION_RATE,
      summary: {
        totalEarnings,
        completedOrders,
        drivers: total,
        commission: totalCommission,
        net: totalNet,
      },
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  },
};
