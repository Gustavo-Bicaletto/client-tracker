import { describe, it, expect } from "vitest";
import { appRouter } from "~/server/api/root";
import { createTestContext } from "../testContext";

describe("Car Router", () => {
  describe("create", () => {
    it("deve criar um carro com sucesso", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const car = await caller.car.create({
        brand: "Honda",
        model: "Civic",
        version: "EXL",
        year: 2023,
      });

      expect(car).toMatchObject({
        id: expect.any(Number),
        brand: "Honda",
        model: "Civic",
        version: "EXL",
        year: 2023,
      });
    });

    it("deve criar carro sem version e year (nullable)", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const car = await caller.car.create({
        brand: "Toyota",
        model: "Corolla",
        version: null,
        year: null,
      });

      expect(car.version).toBeNull();
      expect(car.year).toBeNull();
    });

    it("deve rejeitar carro duplicado", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      await caller.car.create({
        brand: "Ford",
        model: "Ka",
        version: "SE",
        year: 2022,
      });

      await expect(
        caller.car.create({
          brand: "Ford",
          model: "Ka",
          version: "SE",
          year: 2022,
        })
      ).rejects.toThrow("Este modelo de carro já está cadastrado");
    });
  });

  describe("getAll", () => {
    it("deve listar carros com paginação", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      await caller.car.create({
        brand: "Honda",
        model: "Civic",
        version: null,
        year: null,
      });

      await caller.car.create({
        brand: "Toyota",
        model: "Corolla",
        version: null,
        year: null,
      });

      const result = await caller.car.getAll({ limit: 10 });

      expect(result.cars.length).toBeGreaterThan(0);
      expect(result.cars[0]).toHaveProperty("_count");
    });

    it("deve filtrar carros por marca", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      await caller.car.create({
        brand: "Honda",
        model: "Civic",
        version: null,
        year: null,
      });

      await caller.car.create({
        brand: "Toyota",
        model: "Corolla",
        version: null,
        year: null,
      });

      const result = await caller.car.getAll({
        limit: 10,
        brand: "Honda",
      });

      expect(result.cars.every((car) => car.brand === "Honda")).toBe(true);
    });

    it("deve buscar carros por termo de pesquisa", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      await caller.car.create({
        brand: "Honda",
        model: "Civic",
        version: "Sport",
        year: null,
      });

      const result = await caller.car.getAll({
        limit: 10,
        searchTerm: "Sport",
      });

      expect(result.cars.length).toBeGreaterThan(0);
      expect(result.cars[0]?.version).toContain("Sport");
    });
  });

  describe("getById", () => {
    it("deve buscar carro por ID", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const created = await caller.car.create({
        brand: "Volkswagen",
        model: "Gol",
        version: null,
        year: 2021,
      });

      const found = await caller.car.getById({ id: created.id });

      expect(found).toMatchObject({
        id: created.id,
        brand: "Volkswagen",
        model: "Gol",
        year: 2021,
      });
      expect(found).toHaveProperty("opportunities");
      expect(found).toHaveProperty("_count");
    });

    it("deve rejeitar ID inexistente", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.car.getById({ id: 99999 })).rejects.toThrow(
        "Carro não encontrado"
      );
    });
  });

  describe("getByBrand", () => {
    it("deve buscar carros por marca", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      await caller.car.create({
        brand: "Chevrolet",
        model: "Onix",
        version: null,
        year: null,
      });

      await caller.car.create({
        brand: "Chevrolet",
        model: "Tracker",
        version: null,
        year: null,
      });

      const cars = await caller.car.getByBrand({ brand: "Chevrolet" });

      expect(cars.length).toBe(2);
      expect(cars.every((car) => car.brand === "Chevrolet")).toBe(true);
    });
  });

  describe("getBrands", () => {
    it("deve listar todas as marcas únicas", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      await caller.car.create({
        brand: "Fiat",
        model: "Uno",
        version: null,
        year: null,
      });

      await caller.car.create({
        brand: "Fiat",
        model: "Mobi",
        version: null,
        year: null,
      });

      await caller.car.create({
        brand: "Renault",
        model: "Kwid",
        version: null,
        year: null,
      });

      const brands = await caller.car.getBrands();

      expect(brands).toContain("Fiat");
      expect(brands).toContain("Renault");
      expect(brands.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("getModelsByBrand", () => {
    it("deve listar modelos por marca", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      await caller.car.create({
        brand: "Hyundai",
        model: "HB20",
        version: null,
        year: null,
      });

      await caller.car.create({
        brand: "Hyundai",
        model: "Creta",
        version: null,
        year: null,
      });

      const models = await caller.car.getModelsByBrand({ brand: "Hyundai" });

      expect(models.length).toBe(2);
      expect(models.some((m) => m.model === "HB20")).toBe(true);
      expect(models.some((m) => m.model === "Creta")).toBe(true);
    });
  });

  describe("search", () => {
    it("deve buscar carros por termo (autocomplete)", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      await caller.car.create({
        brand: "Nissan",
        model: "Kicks",
        version: null,
        year: null,
      });

      const results = await caller.car.search({
        query: "Kicks",
        limit: 10,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.model).toBe("Kicks");
    });

    it("deve buscar por marca", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      await caller.car.create({
        brand: "Jeep",
        model: "Compass",
        version: null,
        year: null,
      });

      const results = await caller.car.search({
        query: "Jeep",
        limit: 10,
      });

      expect(results.some((r) => r.brand === "Jeep")).toBe(true);
    });
  });

  describe("update", () => {
    it("deve atualizar carro existente", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const car = await caller.car.create({
        brand: "Peugeot",
        model: "208",
        version: "Active",
        year: 2020,
      });

      const updated = await caller.car.update({
        id: car.id,
        version: "Griffe",
        year: 2021,
      });

      expect(updated.version).toBe("Griffe");
      expect(updated.year).toBe(2021);
    });

    it("deve rejeitar atualização que cria duplicata", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      await caller.car.create({
        brand: "Kia",
        model: "Sportage",
        version: "EX",
        year: 2023,
      });

      const car2 = await caller.car.create({
        brand: "Kia",
        model: "Seltos",
        version: null,
        year: null,
      });

      await expect(
        caller.car.update({
          id: car2.id,
          model: "Sportage",
          version: "EX",
          year: 2023,
        })
      ).rejects.toThrow("Já existe um carro com estas características");
    });

    it("deve rejeitar atualização de carro inexistente", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.car.update({
          id: 99999,
          brand: "Test",
        })
      ).rejects.toThrow("Carro não encontrado");
    });
  });

  describe("delete", () => {
    it("deve deletar carro sem oportunidades", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const car = await caller.car.create({
        brand: "BYD",
        model: "Dolphin",
        version: null,
        year: null,
      });

      await caller.car.delete({ id: car.id });

      await expect(caller.car.getById({ id: car.id })).rejects.toThrow(
        "Carro não encontrado"
      );
    });

    it("deve rejeitar deleção de carro com oportunidades vinculadas", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      // Criar cliente
      const client = await caller.clients.create({
        name: "Cliente Teste",
        email: null,
        phone: null,
        urgency: "NORMAL",
      });

      // Criar carro
      const car = await caller.car.create({
        brand: "Tesla",
        model: "Model 3",
        version: null,
        year: null,
      });

      // Criar oportunidade vinculada ao carro
      await caller.opportunity.create({
        clientId: client.id,
        carLabel: "Tesla Model 3",
        carModelId: car.id,
        stage: "LEAD",
        urgency: "NORMAL",
      });

      // Tentar deletar carro
      await expect(caller.car.delete({ id: car.id })).rejects.toThrow(
        /oportunidade\(s\) vinculada\(s\)/
      );
    });

    it("deve rejeitar deleção de carro inexistente", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.car.delete({ id: 99999 })).rejects.toThrow(
        "Carro não encontrado"
      );
    });
  });

  describe("getStats", () => {
    it("deve retornar estatísticas de carros", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      await caller.car.create({
        brand: "Audi",
        model: "A3",
        version: null,
        year: null,
      });

      await caller.car.create({
        brand: "Audi",
        model: "Q3",
        version: null,
        year: null,
      });

      const stats = await caller.car.getStats();

      expect(stats).toHaveProperty("totalCars");
      expect(stats).toHaveProperty("carsByBrand");
      expect(stats).toHaveProperty("mostUsedCars");
      expect(stats.totalCars).toBeGreaterThan(0);
    });
  });
});