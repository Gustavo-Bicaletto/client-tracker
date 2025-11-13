import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { Stage, Urgency } from "@prisma/client";

export const opportunityRouter = createTRPCRouter({
  // Criar nova oportunidade
  create: protectedProcedure
    .input(
      z.object({
        clientId: z.number(),
        carLabel: z.string().min(1, "Etiqueta do carro é obrigatória"),
        carModelId: z.number().optional().nullable(),
        stage: z.nativeEnum(Stage).default(Stage.LEAD),
        urgency: z.nativeEnum(Urgency).default(Urgency.NORMAL),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verificar se o cliente existe e pertence ao usuário
      const client = await ctx.db.client.findFirst({
        where: {
          id: input.clientId,
          createdById: ctx.session.user.id,
        },
      });

      if (!client) {
        throw new Error("Cliente não encontrado ou sem permissão");
      }

      // Se carModelId foi fornecido, verificar se existe
      if (input.carModelId) {
        const car = await ctx.db.car.findUnique({
          where: { id: input.carModelId },
        });

        if (!car) {
          throw new Error("Modelo de carro não encontrado");
        }
      }

      return ctx.db.opportunity.create({
        data: {
          clientId: input.clientId,
          carLabel: input.carLabel,
          carModelId: input.carModelId,
          stage: input.stage,
          urgency: input.urgency,
        },
        include: {
          client: true,
          carModel: true,
        },
      });
    }),

  // Buscar todas as oportunidades com filtros
  getAll: protectedProcedure
    .input(
      z.object({
        stage: z.nativeEnum(Stage).optional(),
        urgency: z.nativeEnum(Urgency).optional(),
        clientId: z.number().optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { stage, urgency, clientId, limit, cursor } = input;

      const opportunities = await ctx.db.opportunity.findMany({
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        where: {
          client: {
            createdById: ctx.session.user.id,
          },
          ...(stage && { stage }),
          ...(urgency && { urgency }),
          ...(clientId && { clientId }),
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              urgency: true,
            },
          },
          carModel: true,
          notes: {
            orderBy: { createdAt: "desc" },
            take: 3,
          },
          _count: {
            select: {
              notes: true,
            },
          },
        },
        orderBy: [
          { urgency: "desc" },
          { updatedAt: "desc" },
        ],
      });

      let nextCursor: number | undefined = undefined;
      if (opportunities.length > limit) {
        const nextItem = opportunities.pop();
        nextCursor = nextItem?.id;
      }

      return {
        opportunities,
        nextCursor,
      };
    }),

  // Buscar oportunidade por ID
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const opportunity = await ctx.db.opportunity.findFirst({
        where: {
          id: input.id,
          client: {
            createdById: ctx.session.user.id,
          },
        },
        include: {
          client: true,
          carModel: true,
          notes: {
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!opportunity) {
        throw new Error("Oportunidade não encontrada");
      }

      return opportunity;
    }),

  // Buscar oportunidades por cliente
  getByClient: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ ctx, input }) => {
      // Verificar se o cliente pertence ao usuário
      const client = await ctx.db.client.findFirst({
        where: {
          id: input.clientId,
          createdById: ctx.session.user.id,
        },
      });

      if (!client) {
        throw new Error("Cliente não encontrado ou sem permissão");
      }

      return ctx.db.opportunity.findMany({
        where: { clientId: input.clientId },
        include: {
          carModel: true,
          notes: {
            orderBy: { createdAt: "desc" },
            take: 3,
          },
          _count: {
            select: {
              notes: true,
            },
          },
        },
        orderBy: [
          { urgency: "desc" },
          { updatedAt: "desc" },
        ],
      });
    }),

  // Atualizar oportunidade
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        carLabel: z.string().min(1).optional(),
        carModelId: z.number().nullable().optional(),
        stage: z.nativeEnum(Stage).optional(),
        urgency: z.nativeEnum(Urgency).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verificar se a oportunidade existe e o usuário tem permissão
      const opportunity = await ctx.db.opportunity.findFirst({
        where: {
          id: input.id,
          client: {
            createdById: ctx.session.user.id,
          },
        },
      });

      if (!opportunity) {
        throw new Error("Oportunidade não encontrada ou sem permissão");
      }

      // Se carModelId foi fornecido, verificar se existe
      if (input.carModelId !== undefined && input.carModelId !== null) {
        const car = await ctx.db.car.findUnique({
          where: { id: input.carModelId },
        });

        if (!car) {
          throw new Error("Modelo de carro não encontrado");
        }
      }

      const { id, ...updateData } = input;

      return ctx.db.opportunity.update({
        where: { id },
        data: updateData,
        include: {
          client: true,
          carModel: true,
          notes: {
            orderBy: { createdAt: "desc" },
          },
        },
      });
    }),

  // Atualizar apenas o stage (útil para Kanban boards)
  updateStage: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        stage: z.nativeEnum(Stage),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const opportunity = await ctx.db.opportunity.findFirst({
        where: {
          id: input.id,
          client: {
            createdById: ctx.session.user.id,
          },
        },
      });

      if (!opportunity) {
        throw new Error("Oportunidade não encontrada ou sem permissão");
      }

      return ctx.db.opportunity.update({
        where: { id: input.id },
        data: { stage: input.stage },
        include: {
          client: {
            select: {
              id: true,
              name: true,
            },
          },
          carModel: true,
        },
      });
    }),

  // Deletar oportunidade
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const opportunity = await ctx.db.opportunity.findFirst({
        where: {
          id: input.id,
          client: {
            createdById: ctx.session.user.id,
          },
        },
      });

      if (!opportunity) {
        throw new Error("Oportunidade não encontrada ou sem permissão");
      }

      // Deletar notas associadas primeiro (cascata)
      await ctx.db.notes.deleteMany({
        where: { opportunityId: input.id },
      });

      return ctx.db.opportunity.delete({
        where: { id: input.id },
      });
    }),

  // Estatísticas de oportunidades
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const opportunities = await ctx.db.opportunity.findMany({
      where: {
        client: {
          createdById: ctx.session.user.id,
        },
      },
      select: {
        stage: true,
        urgency: true,
      },
    });

    const stats = {
      total: opportunities.length,
      byStage: {} as Record<Stage, number>,
      byUrgency: {} as Record<Urgency, number>,
    };

    // Inicializar contadores
    Object.values(Stage).forEach((stage) => {
      stats.byStage[stage] = 0;
    });

    Object.values(Urgency).forEach((urgency) => {
      stats.byUrgency[urgency] = 0;
    });

    // Contar
    opportunities.forEach((opp) => {
      stats.byStage[opp.stage]++;
      stats.byUrgency[opp.urgency]++;
    });

    return stats;
  }),
});