import { describe, it, expect } from "vitest";
import { appRouter } from "~/server/api/root";
import { createTestContext } from "../testContext";

describe("Opportunity Router", () => {
  it("deve criar oportunidade vinculada a cliente", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const client = await caller.clients.create({
      name: "Cliente para Oportunidade",
      email: null,
      phone: null,
      urgency: "NORMAL",
    });

    const opp = await caller.opportunity.create({
      clientId: client.id,
      carLabel: "Honda Civic 2023",
      carModelId: null,
      stage: "LEAD",
      urgency: "HIGH",
    });

    expect(opp).toMatchObject({
      id: expect.any(Number),
      clientId: client.id,
      carLabel: "Honda Civic 2023",
      stage: "LEAD",
      urgency: "HIGH",
    });
  });

  it("deve listar oportunidades por cliente", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const client = await caller.clients.create({
      name: "Cliente Multi Opp",
      email: null,
      phone: null,
      urgency: "NORMAL",
    });

    await caller.opportunity.create({
      clientId: client.id,
      carLabel: "Carro A",
      carModelId: null,
      stage: "LEAD",
      urgency: "NORMAL",
    });

    await caller.opportunity.create({
      clientId: client.id,
      carLabel: "Carro B",
      carModelId: null,
      stage: "CONTACTED",
      urgency: "HIGH",
    });

    const opportunities = await caller.opportunity.getByClient({
      clientId: client.id,
    });

    // CORREÇÃO: Verificar tamanho e elementos individuais
    expect(opportunities).toHaveLength(2);
    expect(opportunities.every(opp => opp.clientId === client.id)).toBe(true);
  });

  it("deve atualizar stage da oportunidade", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const client = await caller.clients.create({
      name: "Cliente Teste",
      email: null,
      phone: null,
      urgency: "NORMAL",
    });

    const opp = await caller.opportunity.create({
      clientId: client.id,
      carLabel: "Carro X",
      carModelId: null,
      stage: "LEAD",
      urgency: "NORMAL",
    });

    const updated = await caller.opportunity.updateStage({
      id: opp.id,
      stage: "CONTACTED",
    });

    expect(updated.stage).toBe("CONTACTED");
  });
});