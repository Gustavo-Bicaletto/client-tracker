import { describe, it, expect } from "vitest";
import { appRouter } from "~/server/api/root";
import { createTestContext } from "../testContext";

describe("Clients Router", () => {
  it("deve criar um cliente", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const client = await caller.clients.create({
      name: "João Silva",
      email: "joao@test.com",
      phone: null,
      urgency: "NORMAL",
    });

    expect(client).toMatchObject({
      id: expect.any(Number),
      name: "João Silva",
      email: "joao@test.com",
    });
  });

  it("deve listar clientes", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    await caller.clients.create({
      name: "Maria",
      email: null,
      phone: null,
      urgency: "HIGH",
    });

    const result = await caller.clients.getAll({ limit: 10 });
    
    expect(result.clients.length).toBeGreaterThan(0);
    
  });
    it("deve rejeitar email inválido", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.clients.create({
        name: "Teste",
        email: "email-invalido", // ← sem @
        phone: null,
        urgency: "NORMAL",
      })
    ).rejects.toThrow(); // Espera que dê erro
  });

  it("deve buscar cliente por ID", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const created = await caller.clients.create({
      name: "Cliente X",
      email: null,
      phone: null,
      urgency: "NORMAL",
    });

    const found = await caller.clients.getById({ id: created.id });
    
    expect(found.name).toBe("Cliente X");
  });
});