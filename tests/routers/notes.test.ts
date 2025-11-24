import { describe, it, expect } from "vitest";
import { appRouter } from "~/server/api/root";
import { createTestContext } from "../testContext";

describe("Notes Router", () => {
  it("deve criar nota vinculada a oportunidade", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const client = await caller.clients.create({
      name: "Cliente para Nota",
      email: null,
      phone: null,
      urgency: "NORMAL",
    });

    const opp = await caller.opportunity.create({
      clientId: client.id,
      carLabel: "Carro Y",
      carModelId: null,
      stage: "LEAD",
      urgency: "NORMAL",
    });

    const note = await caller.notes.create({
      opportunityId: opp.id,
      title: "Primeira conversa",
      content: "Cliente demonstrou interesse no carro",
    });

    expect(note).toMatchObject({
      id: expect.any(Number),
      opportunityId: opp.id,
      title: "Primeira conversa",
      content: "Cliente demonstrou interesse no carro",
    });
  });

  it("deve listar notas de uma oportunidade", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const client = await caller.clients.create({
      name: "Cliente",
      email: null,
      phone: null,
      urgency: "NORMAL",
    });

    const opp = await caller.opportunity.create({
      clientId: client.id,
      carLabel: "Carro Z",
      carModelId: null,
      stage: "LEAD",
      urgency: "NORMAL",
    });

    await caller.notes.create({
      opportunityId: opp.id,
      title: "Contato inicial",
      content: "Primeira conversa com cliente",
    });

    await caller.notes.create({
      opportunityId: opp.id,
      title: "Proposta enviada",
      content: "Enviado proposta comercial por email",
    });

    await caller.notes.create({
      opportunityId: opp.id,
      title: "Follow-up",
      content: "Aguardando resposta do cliente",
    });

    const result = await caller.notes.getByOpportunity({
      opportunityId: opp.id,
    });

    // ✅ CORREÇÃO: Acessar .notes do resultado
    expect(result.notes).toHaveLength(3);
    expect(result.notes.every((note) => note.opportunityId === opp.id)).toBe(true);
  });

  it("deve atualizar nota existente", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const client = await caller.clients.create({
      name: "Cliente",
      email: null,
      phone: null,
      urgency: "NORMAL",
    });

    const opp = await caller.opportunity.create({
      clientId: client.id,
      carLabel: "Carro W",
      carModelId: null,
      stage: "LEAD",
      urgency: "NORMAL",
    });

    const note = await caller.notes.create({
      opportunityId: opp.id,
      title: "Título original",
      content: "Conteúdo original",
    });

    const updated = await caller.notes.update({
      id: note.id,
      title: "Título atualizado",
      content: "Conteúdo atualizado",
    });

    expect(updated.title).toBe("Título atualizado");
    expect(updated.content).toBe("Conteúdo atualizado");
  });

  it("deve deletar nota", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const client = await caller.clients.create({
      name: "Cliente",
      email: null,
      phone: null,
      urgency: "NORMAL",
    });

    const opp = await caller.opportunity.create({
      clientId: client.id,
      carLabel: "Carro V",
      carModelId: null,
      stage: "LEAD",
      urgency: "NORMAL",
    });

    const note = await caller.notes.create({
      opportunityId: opp.id,
      title: "Nota para deletar",
      content: "Esta nota será deletada",
    });

    await caller.notes.delete({ id: note.id });

    const result = await caller.notes.getByOpportunity({
      opportunityId: opp.id,
    });

    // ✅ CORREÇÃO: Acessar .notes
    expect(result.notes).toHaveLength(0);
  });
});