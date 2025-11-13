import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";

export const carRouter = createTRPCRouter({
  // Criar novo modelo de carro
  create: protectedProcedure
    .input(
      z.object({
        brand: z.string().min(1, "Marca é obrigatória"),
        model: z.string().min(1, "Modelo é obrigatório"),
        version: z.string().optional().nullable(),
        year: z.number().min(1900).max(2100).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verificar se já existe um carro idêntico
      const existingCar = await ctx.db.car.findFirst({
        where: {
          brand: input.brand,
          model: input.model,
          version: input.version ?? null,
          year: input.year ?? null,
        },
      });

      if (existingCar) {
        throw new Error("Este modelo de carro já está cadastrado");
      }

      return ctx.db.car.create({
        data: {
          brand: input.brand,
          model: input.model,
          version: input.version,
          year: input.year,
        },
      });
    }),

  // Buscar todos os carros com paginação
  getAll: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        cursor: z.number().optional(),
        brand: z.string().optional(),
        searchTerm: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor, brand, searchTerm } = input;

      const where = {
        ...(brand && { brand }),
        ...(searchTerm && {
          OR: [
            { brand: { contains: searchTerm, mode: "insensitive" as const } },
            { model: { contains: searchTerm, mode: "insensitive" as const } },
            { version: { contains: searchTerm, mode: "insensitive" as const } },
          ],
        }),
      };

      const cars = await ctx.db.car.findMany({
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        where,
        orderBy: [
          { brand: "asc" },
          { model: "asc" },
          { year: "desc" },
        ],
        include: {
          _count: {
            select: {
              opportunities: true,
            },
          },
        },
      });

      let nextCursor: number | undefined = undefined;
      if (cars.length > limit) {
        const nextItem = cars.pop();
        nextCursor = nextItem?.id;
      }

      return {
        cars,
        nextCursor,
      };
    }),

  // Buscar carro por ID
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const car = await ctx.db.car.findUnique({
        where: { id: input.id },
        include: {
          opportunities: {
            include: {
              client: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
          },
          _count: {
            select: {
              opportunities: true,
            },
          },
        },
      });

      if (!car) {
        throw new Error("Carro não encontrado");
      }

      return car;
    }),

  // Buscar carros por marca
  getByBrand: publicProcedure
    .input(z.object({ brand: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.car.findMany({
        where: {
          brand: {
            contains: input.brand,
            mode: "insensitive",
          },
        },
        orderBy: [
          { model: "asc" },
          { year: "desc" },
        ],
        include: {
          _count: {
            select: {
              opportunities: true,
            },
          },
        },
      });
    }),

  // Buscar todas as marcas únicas
  getBrands: publicProcedure.query(async ({ ctx }) => {
    const cars = await ctx.db.car.findMany({
      select: {
        brand: true,
      },
      distinct: ["brand"],
      orderBy: {
        brand: "asc",
      },
    });

    return cars.map((car) => car.brand);
  }),

  // Buscar modelos por marca
  getModelsByBrand: publicProcedure
    .input(z.object({ brand: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.car.findMany({
        where: {
          brand: input.brand,
        },
        select: {
          id: true,
          model: true,
          version: true,
          year: true,
        },
        orderBy: [
          { model: "asc" },
          { year: "desc" },
        ],
      });
    }),

  // Buscar carros (search/autocomplete)
  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(20).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.car.findMany({
        where: {
          OR: [
            { brand: { contains: input.query, mode: "insensitive" } },
            { model: { contains: input.query, mode: "insensitive" } },
            { version: { contains: input.query, mode: "insensitive" } },
          ],
        },
        take: input.limit,
        orderBy: [
          { brand: "asc" },
          { model: "asc" },
        ],
        select: {
          id: true,
          brand: true,
          model: true,
          version: true,
          year: true,
        },
      });
    }),

  // Atualizar carro
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        brand: z.string().min(1).optional(),
        model: z.string().min(1).optional(),
        version: z.string().nullable().optional(),
        year: z.number().min(1900).max(2100).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const car = await ctx.db.car.findUnique({
        where: { id: input.id },
      });

      if (!car) {
        throw new Error("Carro não encontrado");
      }

      const { id, ...updateData } = input;

      // Verificar se a atualização não cria duplicata
      if (updateData.brand || updateData.model || updateData.version !== undefined || updateData.year !== undefined) {
        const existingCar = await ctx.db.car.findFirst({
          where: {
            id: { not: id },
            brand: updateData.brand ?? car.brand,
            model: updateData.model ?? car.model,
            version: updateData.version !== undefined ? updateData.version : car.version,
            year: updateData.year !== undefined ? updateData.year : car.year,
          },
        });

        if (existingCar) {
          throw new Error("Já existe um carro com estas características");
        }
      }

      return ctx.db.car.update({
        where: { id },
        data: updateData,
        include: {
          _count: {
            select: {
              opportunities: true,
            },
          },
        },
      });
    }),

  // Deletar carro
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const car = await ctx.db.car.findUnique({
        where: { id: input.id },
        include: {
          _count: {
            select: {
              opportunities: true,
            },
          },
        },
      });

      if (!car) {
        throw new Error("Carro não encontrado");
      }

      // Verificar se há oportunidades vinculadas
      if (car._count.opportunities > 0) {
        throw new Error(
          `Não é possível deletar este carro. Existem ${car._count.opportunities} oportunidade(s) vinculada(s).`
        );
      }

      return ctx.db.car.delete({
        where: { id: input.id },
      });
    }),

  // Estatísticas de carros
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const totalCars = await ctx.db.car.count();

    const carsByBrand = await ctx.db.car.groupBy({
      by: ["brand"],
      _count: {
        brand: true,
      },
      orderBy: {
        _count: {
          brand: "desc",
        },
      },
      take: 10,
    });

    const mostUsedCars = await ctx.db.car.findMany({
      take: 10,
      include: {
        _count: {
          select: {
            opportunities: true,
          },
        },
      },
      orderBy: {
        opportunities: {
          _count: "desc",
        },
      },
    });

    return {
      totalCars,
      carsByBrand: carsByBrand.map((item) => ({
        brand: item.brand,
        count: item._count.brand,
      })),
      mostUsedCars: mostUsedCars.map((car) => ({
        id: car.id,
        brand: car.brand,
        model: car.model,
        version: car.version,
        year: car.year,
        opportunitiesCount: car._count.opportunities,
      })),
    };
  }),
});