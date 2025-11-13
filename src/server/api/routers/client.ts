import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { Urgency } from "@prisma/client";
import { TRPCError } from "@trpc/server";

// Helper: Base where clause para filtrar por usuário
const getUserClientsWhere = (userId: string) => ({
  createdById: userId,
});

// Helper: Verificar permissão de cliente
async function verifyClientAccess(
  db: any,
  clientId: number,
  userId: string
) {
  const client = await db.client.findFirst({
    where: {
      id: clientId,
      createdById: userId,
    },
  });

  if (!client) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Cliente não encontrado ou sem permissão",
    });
  }

  return client;
}

export const clientRouter = createTRPCRouter({
  // Criar cliente
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Nome é obrigatório"),
        email: z.string().email("Email inválido").optional().nullable(),
        phone: z.string().optional().nullable(),
        urgency: z.nativeEnum(Urgency).default(Urgency.NORMAL),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verificar se já existe cliente com mesmo email (se fornecido)
      if (input.email) {
        const existing = await ctx.db.client.findFirst({
          where: {
            email: input.email,
            createdById: ctx.session.user.id,
          },
        });

        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Já existe um cliente com este email",
          });
        }
      }

      return ctx.db.client.create({
        data: {
          name: input.name,
          email: input.email,
          phone: input.phone,
          urgency: input.urgency,
          createdById: ctx.session.user.id,
        },
      });
    }),

  // Listar todos os clientes
  getAll: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        cursor: z.number().optional(),
        urgency: z.nativeEnum(Urgency).optional(),
        searchTerm: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor, urgency, searchTerm } = input;

      const where = {
        ...getUserClientsWhere(ctx.session.user.id),
        ...(urgency && { urgency }),
        ...(searchTerm && {
          OR: [
            { name: { contains: searchTerm, mode: "insensitive" as const } },
            { email: { contains: searchTerm, mode: "insensitive" as const } },
            { phone: { contains: searchTerm, mode: "insensitive" as const } },
          ],
        }),
      };

      const clients = await ctx.db.client.findMany({
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        where,
        orderBy: [
          { urgency: "desc" },
          { createdAt: "desc" },
        ],
        include: {
          _count: {
            select: {
              opportunities: true,
            },
          },
        },
      });

      let nextCursor: number | undefined;
      if (clients.length > limit) {
        nextCursor = clients.pop()?.id;
      }

      return { clients, nextCursor };
    }),

  // Buscar cliente por ID
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const client = await ctx.db.client.findFirst({
        where: {
          id: input.id,
          createdById: ctx.session.user.id,
        },
        include: {
          opportunities: {
            include: {
              carModel: true,
              _count: {
                select: {
                  notes: true,
                },
              },
            },
            orderBy: { updatedAt: "desc" },
          },
          _count: {
            select: {
              opportunities: true,
            },
          },
        },
      });

      if (!client) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cliente não encontrado",
        });
      }

      return client;
    }),

  // Buscar clientes por urgência
  getByUrgency: protectedProcedure
    .input(z.object({ urgency: z.nativeEnum(Urgency) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.client.findMany({
        where: {
          createdById: ctx.session.user.id,
          urgency: input.urgency,
        },
        include: {
          _count: {
            select: {
              opportunities: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  // Buscar clientes urgentes (HIGH urgency)
  getUrgent: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.client.findMany({
      where: {
        createdById: ctx.session.user.id,
        urgency: Urgency.HIGH,
      },
      include: {
        opportunities: {
          where: {
            stage: {
              notIn: ["CLOSED_WON", "CLOSED_LOST"],
            },
          },
          take: 3,
        },
        _count: {
          select: {
            opportunities: true,
          },
        },
      },
      orderBy: { updatedAt: "asc" },
    });
  }),

  // Buscar (search/autocomplete)
  search: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(20).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.client.findMany({
        where: {
          createdById: ctx.session.user.id,
          OR: [
            { name: { contains: input.query, mode: "insensitive" } },
            { email: { contains: input.query, mode: "insensitive" } },
            { phone: { contains: input.query, mode: "insensitive" } },
          ],
        },
        take: input.limit,
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          urgency: true,
        },
      });
    }),

  // Atualizar cliente
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        email: z.string().email().nullable().optional(),
        phone: z.string().nullable().optional(),
        urgency: z.nativeEnum(Urgency).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyClientAccess(ctx.db, input.id, ctx.session.user.id);

      // Se email está sendo atualizado, verificar duplicatas
      if (input.email !== undefined && input.email !== null) {
        const existing = await ctx.db.client.findFirst({
          where: {
            id: { not: input.id },
            email: input.email,
            createdById: ctx.session.user.id,
          },
        });

        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Já existe outro cliente com este email",
          });
        }
      }

      const { id, ...updateData } = input;

      return ctx.db.client.update({
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

  // Atualizar apenas urgência
  updateUrgency: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        urgency: z.nativeEnum(Urgency),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyClientAccess(ctx.db, input.id, ctx.session.user.id);

      return ctx.db.client.update({
        where: { id: input.id },
        data: { urgency: input.urgency },
      });
    }),

  // Deletar cliente
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const client = await ctx.db.client.findFirst({
        where: {
          id: input.id,
          createdById: ctx.session.user.id,
        },
        include: {
          _count: {
            select: {
              opportunities: true,
            },
          },
        },
      });

      if (!client) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cliente não encontrado",
        });
      }

      // Verificar se há oportunidades vinculadas
      if (client._count.opportunities > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Não é possível deletar este cliente. Existem ${client._count.opportunities} oportunidade(s) vinculada(s).`,
        });
      }

      await ctx.db.client.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  // Estatísticas de clientes
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const clients = await ctx.db.client.findMany({
      where: getUserClientsWhere(ctx.session.user.id),
      select: {
        urgency: true,
        _count: {
          select: {
            opportunities: true,
          },
        },
      },
    });

    const stats = {
      total: clients.length,
      byUrgency: {
        [Urgency.LOW]: 0,
        [Urgency.NORMAL]: 0,
        [Urgency.HIGH]: 0,
      },
      withOpportunities: 0,
      withoutOpportunities: 0,
      totalOpportunities: 0,
    };

    clients.forEach((client) => {
      stats.byUrgency[client.urgency]++;
      stats.totalOpportunities += client._count.opportunities;
      
      if (client._count.opportunities > 0) {
        stats.withOpportunities++;
      } else {
        stats.withoutOpportunities++;
      }
    });

    return stats;
  }),
});