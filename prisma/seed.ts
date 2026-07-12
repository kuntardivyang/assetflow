import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;
const tag = (n: number) => `AF-${String(n).padStart(4, "0")}`;

async function main() {
  console.log("Resetting data…");
  // Order matters (FK constraints).
  await prisma.activityLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditItem.deleteMany();
  await prisma.auditCycleAuditor.deleteMany();
  await prisma.auditCycle.deleteMany();
  await prisma.maintenanceRequest.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.transferRequest.deleteMany();
  await prisma.allocation.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();

  const hash = (pw: string) => bcrypt.hashSync(pw, 10);

  console.log("Seeding users…");
  const admin = await prisma.user.create({
    data: { name: "Divya Admin", email: "admin@assetflow.com", passwordHash: hash("admin123"), role: "ADMIN" },
  });
  const manager = await prisma.user.create({
    data: { name: "Rohan Mehta", email: "manager@assetflow.com", passwordHash: hash("manager123"), role: "ASSET_MANAGER" },
  });
  const head = await prisma.user.create({
    data: { name: "Aditi Rao", email: "head@assetflow.com", passwordHash: hash("head123"), role: "DEPARTMENT_HEAD" },
  });
  const priya = await prisma.user.create({
    data: { name: "Priya Shah", email: "priya@assetflow.com", passwordHash: hash("employee123"), role: "EMPLOYEE" },
  });
  const arjun = await prisma.user.create({
    data: { name: "Arjun Nair", email: "arjun@assetflow.com", passwordHash: hash("employee123"), role: "EMPLOYEE" },
  });

  console.log("Seeding departments…");
  const engineering = await prisma.department.create({
    data: { name: "Engineering", code: "ENG", headId: head.id },
  });
  const facilities = await prisma.department.create({
    data: { name: "Facilities", code: "FAC" },
  });
  const fieldOps = await prisma.department.create({
    data: { name: "Field Ops", code: "FOPS", parentId: facilities.id },
  });

  await prisma.user.update({ where: { id: head.id }, data: { departmentId: engineering.id } });
  await prisma.user.update({ where: { id: priya.id }, data: { departmentId: engineering.id } });
  await prisma.user.update({ where: { id: arjun.id }, data: { departmentId: facilities.id } });

  console.log("Seeding categories…");
  const electronics = await prisma.category.create({
    data: { name: "Electronics", extraFields: { warrantyMonths: 24 } },
  });
  const furniture = await prisma.category.create({ data: { name: "Furniture" } });
  const vehicles = await prisma.category.create({ data: { name: "Vehicles" } });
  const equipment = await prisma.category.create({ data: { name: "Equipment" } });

  console.log("Seeding assets…");
  let n = 0;
  const yearsAgo = (y: number) => new Date(Date.now() - Math.round(y * 365 * DAY));
  const mk = (data: Record<string, unknown>) =>
    prisma.asset.create({ data: { tag: tag(++n), ...data } as never });

  const laptop = await mk({ name: "Dell Latitude 7440", categoryId: electronics.id, serialNumber: "DL7440-2231", acquisitionCost: 1250, acquisitionDate: yearsAgo(1.5), location: "Bengaluru HQ", status: "ALLOCATED", currentHolderId: priya.id, currentDeptId: engineering.id, condition: "Good" });
  const projector = await mk({ name: "Epson Projector", categoryId: electronics.id, serialNumber: "EP-0062", acquisitionCost: 700, acquisitionDate: yearsAgo(3), location: "HQ Floor 2", status: "UNDER_MAINTENANCE" });
  await mk({ name: "Office Chair", categoryId: furniture.id, acquisitionCost: 120, acquisitionDate: yearsAgo(2), location: "Warehouse", status: "AVAILABLE" });
  const monitor = await mk({ name: "LG UltraWide Monitor", categoryId: electronics.id, acquisitionCost: 400, acquisitionDate: yearsAgo(0.8), location: "HQ Floor 1", status: "ALLOCATED", currentHolderId: arjun.id, currentDeptId: facilities.id });
  await mk({ name: "Standing Desk", categoryId: furniture.id, acquisitionCost: 300, acquisitionDate: yearsAgo(1), location: "HQ Floor 1", status: "AVAILABLE" });
  const van = await mk({ name: "Delivery Van", categoryId: vehicles.id, serialNumber: "VAN-343", acquisitionCost: 22000, acquisitionDate: yearsAgo(4.5), location: "Depot", status: "ALLOCATED", currentHolderId: arjun.id, currentDeptId: fieldOps.id });
  await mk({ name: "Forklift", categoryId: equipment.id, acquisitionCost: 15000, acquisitionDate: yearsAgo(5), location: "Warehouse", status: "AVAILABLE", condition: "Fair" });
  await mk({ name: "Camera Kit", categoryId: electronics.id, acquisitionCost: 900, acquisitionDate: yearsAgo(2.5), location: "Media Room", status: "AVAILABLE" });
  await mk({ name: "Whiteboard", categoryId: furniture.id, acquisitionCost: 60, acquisitionDate: yearsAgo(0.5), location: "HQ Floor 2", status: "AVAILABLE" });
  await mk({ name: "Server Rack", categoryId: equipment.id, acquisitionCost: 5000, acquisitionDate: yearsAgo(3.5), location: "Data Center", status: "RESERVED" });
  await mk({ name: "iPad Pro", categoryId: electronics.id, acquisitionCost: 1100, acquisitionDate: yearsAgo(1.2), location: "HQ Floor 1", status: "AVAILABLE" });
  await mk({ name: "Printer", categoryId: electronics.id, acquisitionCost: 350, acquisitionDate: yearsAgo(4), location: "HQ Floor 2", status: "AVAILABLE" });
  await mk({ name: "Toolbox Set", categoryId: equipment.id, acquisitionCost: 200, acquisitionDate: yearsAgo(2), location: "Depot", status: "AVAILABLE" });
  await mk({ name: "Conference Phone", categoryId: electronics.id, acquisitionCost: 250, acquisitionDate: yearsAgo(1), location: "Meeting Room A", status: "AVAILABLE" });
  await mk({ name: "Retired Laptop", categoryId: electronics.id, acquisitionCost: 900, acquisitionDate: yearsAgo(6), location: "Storage", status: "RETIRED" });

  // Bookable shared resources (rooms) — booking-only, never allocated.
  const roomB2 = await mk({ name: "Conference Room B2", categoryId: furniture.id, acquisitionDate: yearsAgo(2), location: "HQ Floor 2", status: "AVAILABLE", bookable: true });
  const roomA1 = await mk({ name: "Meeting Room A1", categoryId: furniture.id, acquisitionDate: yearsAgo(2), location: "HQ Floor 1", status: "AVAILABLE", bookable: true });
  await mk({ name: "Training Room", categoryId: furniture.id, acquisitionDate: yearsAgo(2), location: "HQ Floor 3", status: "AVAILABLE", bookable: true });

  console.log("Seeding allocations…");
  await prisma.allocation.create({
    data: { assetId: laptop.id, toUserId: priya.id, toDeptId: engineering.id, allocatedById: manager.id, allocatedAt: new Date(Date.now() - 30 * DAY), expectedReturnDate: new Date(Date.now() + 15 * DAY), status: "ACTIVE" },
  });
  await prisma.allocation.create({
    data: { assetId: monitor.id, toUserId: arjun.id, toDeptId: facilities.id, allocatedById: manager.id, allocatedAt: new Date(Date.now() - 10 * DAY), status: "ACTIVE" },
  });
  // Overdue allocation (feeds dashboard banner + notifications).
  await prisma.allocation.create({
    data: { assetId: van.id, toUserId: arjun.id, toDeptId: fieldOps.id, allocatedById: manager.id, allocatedAt: new Date(Date.now() - 20 * DAY), expectedReturnDate: new Date(Date.now() - 3 * DAY), status: "ACTIVE" },
  });

  console.log("Seeding bookings…");
  const at = (h: number, m = 0) => {
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  };
  await prisma.booking.create({
    data: { assetId: roomB2.id, bookedById: manager.id, deptId: engineering.id, startTime: at(9), endTime: at(10), status: "UPCOMING" },
  });
  await prisma.booking.create({
    data: { assetId: roomA1.id, bookedById: priya.id, deptId: engineering.id, startTime: at(14), endTime: at(15), status: "UPCOMING" },
  });

  console.log("Seeding maintenance…");
  await prisma.maintenanceRequest.create({
    data: { assetId: projector.id, raisedById: priya.id, description: "Bulb not turning on", priority: "HIGH", status: "APPROVED" },
  });
  await prisma.maintenanceRequest.create({
    data: { assetId: laptop.id, raisedById: arjun.id, description: "Battery drains fast", priority: "MEDIUM", status: "PENDING" },
  });

  console.log("Seeding audit cycle…");
  const cycle = await prisma.auditCycle.create({
    data: {
      name: "Q3 Audit — Engineering",
      scopeDeptId: engineering.id,
      startDate: new Date(),
      endDate: new Date(Date.now() + 14 * DAY),
      status: "OPEN",
      createdById: admin.id,
      auditors: { create: [{ userId: head.id }, { userId: manager.id }] },
      items: {
        create: [
          { assetId: laptop.id, expectedLocation: "Bengaluru HQ", result: "PENDING" },
          { assetId: monitor.id, expectedLocation: "HQ Floor 1", result: "PENDING" },
          { assetId: projector.id, expectedLocation: "HQ Floor 2", result: "PENDING" },
        ],
      },
    },
  });

  console.log("Seeding notifications + activity…");
  await prisma.notification.createMany({
    data: [
      { userId: priya.id, type: "ASSET_ASSIGNED", message: "Laptop AF-0001 assigned to you", link: "/allocation" },
      { userId: manager.id, type: "OVERDUE_RETURN", message: "Delivery Van AF-0006 is overdue for return", link: "/allocation", dedupeKey: "OVERDUE_RETURN:seed-van" },
      { userId: priya.id, type: "BOOKING_CONFIRMED", message: "Conference Room B2 booked 9:00-10:00", link: "/booking" },
    ],
  });
  await prisma.activityLog.createMany({
    data: [
      { actorId: manager.id, action: "allocate", entityType: "Asset", entityId: laptop.id, description: "Laptop AF-0001 allocated to Priya Shah — Engineering" },
      { actorId: priya.id, action: "book", entityType: "Booking", description: "Room B2 booking confirmed — 9:00 to 10:00" },
      { actorId: manager.id, action: "maintenance", entityType: "Asset", entityId: projector.id, description: "Projector AF-0002 maintenance approved" },
    ],
  });

  // Advance the tag sequence past the seeded assets so the next real
  // registration continues the AF-#### series (review B2).
  await prisma.$executeRawUnsafe(`SELECT setval('asset_tag_seq', ${n})`);

  console.log(`Done. Seeded ${n} assets, 5 users, 3 departments, 1 audit cycle.`);
  console.log("Cycle:", cycle.name);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
