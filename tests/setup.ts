import { beforeAll, afterAll, beforeEach, vi } from "vitest";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

config({ path: ".env.test" });

vi.mock("~/server/auth", () => ({
  auth: vi.fn(),
  handlers: {},
}));

export const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === "development"
      ? ["query", "error", "warn"]
      : ["error"],
});

export let testUser: { id: string };

beforeAll(async () => {
  await prisma.$connect();
  console.log("✅ Prisma conectado ao banco de teste");

  testUser = await prisma.user.upsert({
    where: { id: "test-user-123" },
    update: {},
    create: {
      id: "test-user-123",
      name: "Test User",
      email: "test@example.com",
    },
  });
  
  console.log("✅ Usuário de teste criado:", testUser.id);
});

afterAll(async () => {
  // Limpar TUDO antes de deletar o usuário (ordem importa!)
  await prisma.notes.deleteMany();
  await prisma.opportunity.deleteMany();
  await prisma.client.deleteMany(); // ← Deleta clientes primeiro
  await prisma.car.deleteMany();
  await prisma.post.deleteMany();
  
  // Agora pode deletar o usuário sem erro de foreign key
  await prisma.user.delete({ where: { id: "test-user-123" } }).catch(() => {});
  
  await prisma.$disconnect();
  console.log("✅ Prisma desconectado");
});

beforeEach(async () => {
  await prisma.notes.deleteMany();
  await prisma.opportunity.deleteMany();
  await prisma.client.deleteMany();
  await prisma.car.deleteMany();
  await prisma.post.deleteMany();
});