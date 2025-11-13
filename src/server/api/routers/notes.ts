import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";

// Helper: Verificar permissão de oportunidade (reutilizável)
async function verifyOpportunityAccess(
  db: PrismaClient,
  opportunityId: number,
  userId: string
) {
  const opportunity = await db.opportunity.findFirst({
    where: {
      id: opportunityId,
      client: {
        createdById: userId,
      },
    },
  });

  if (!opportunity) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Oportunidade não encontrada ou sem permissão",
    });
  }

  return opportunity;
}

// Helper: Verificar permissão de nota (reutilizável)
async function verifyNoteAccess(
  db: PrismaClient,
  noteId: number,
  userId: string
) {
  const note = await db.notes.findFirst({
    where: {
      id: noteId,
      opportunity: {
        client: {
          createdById: userId,
        },
      },
    },
  });

  if (!note) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Nota não encontrada ou sem permissão",
    });
  }

  return note;
}

// Base where clause para filtrar por usuário
const getUserNotesWhere = (userId: string) => ({
  opportunity: {
    client: {
      createdById: userId,
    },
  },
});

export const notesRouter = createTRPCRouter({
  // Criar nova nota
  create: protectedProcedure
    .input(
      z.object({
        opportunityId: z.number(),
        title: z.string().min(1, "Título é obrigatório"),
        content: z.string().min(1, "Conteúdo é obrigatório"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyOpportunityAccess(ctx.db, input.opportunityId, ctx.session.user.id);

      return ctx.db.notes.create({
        data: input,
        include: {
          opportunity: {
            select: {
              id: true,
              carLabel: true,
              stage: true,
              client: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });
    }),

  // Buscar notas de uma oportunidade
  getByOpportunity: protectedProcedure
    .input(
      z.object({
        opportunityId: z.number(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await verifyOpportunityAccess(ctx.db, input.opportunityId, ctx.session.user.id);

      const notes = await ctx.db.notes.findMany({
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        where: { opportunityId: input.opportunityId },
        orderBy: { createdAt: "desc" },
      });

      let nextCursor: number | undefined;
      if (notes.length > input.limit) {
        nextCursor = notes.pop()?.id;
      }

      return { notes, nextCursor };
    }),

  // Buscar nota por ID
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      return verifyNoteAccess(ctx.db, input.id, ctx.session.user.id);
    }),

  // Buscar todas as notas do usuário
  getAll: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        cursor: z.number().optional(),
        opportunityId: z.number().optional(),
        searchTerm: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const baseWhere = getUserNotesWhere(ctx.session.user.id);
      
      const where = {
        ...baseWhere,
        ...(input.opportunityId && {
          opportunity: {
            ...baseWhere.opportunity,
            id: input.opportunityId,
          },
        }),
        ...(input.searchTerm && {
          OR: [
            { title: { contains: input.searchTerm, mode: "insensitive" as const } },
            { content: { contains: input.searchTerm, mode: "insensitive" as const } },
          ],
        }),
      };

      const notes = await ctx.db.notes.findMany({
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        where,
        orderBy: { createdAt: "desc" },
        include: {
          opportunity: {
            select: {
              id: true,
              carLabel: true,
              stage: true,
              urgency: true,
              client: {
                select: { id: true, name: true },
              },
            },
          },
        },
      });

      let nextCursor: number | undefined;
      if (notes.length > input.limit) {
        nextCursor = notes.pop()?.id;
      }

      return { notes, nextCursor };
    }),

  // Atualizar nota
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).optional(),
        content: z.string().min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyNoteAccess(ctx.db, input.id, ctx.session.user.id);

      const { id, ...updateData } = input;

      return ctx.db.notes.update({
        where: { id },
        data: updateData,
      });
    }),

  // Deletar nota
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await verifyNoteAccess(ctx.db, input.id, ctx.session.user.id);

      return ctx.db.notes.delete({
        where: { id: input.id },
      });
    }),

  // Deletar múltiplas notas
  deleteMany: protectedProcedure
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      const notes = await ctx.db.notes.findMany({
        where: {
          id: { in: input.ids },
          ...getUserNotesWhere(ctx.session.user.id),
        },
        select: { id: true },
      });

      if (notes.length !== input.ids.length) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Algumas notas não foram encontradas ou você não tem permissão",
        });
      }

      const result = await ctx.db.notes.deleteMany({
        where: { id: { in: input.ids } },
      });

      return { count: result.count };
    }),

  // Buscar por termo (simplificado - usa getAll)
  search: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.notes.findMany({
        where: {
          ...getUserNotesWhere(ctx.session.user.id),
          OR: [
            { title: { contains: input.query, mode: "insensitive" } },
            { content: { contains: input.query, mode: "insensitive" } },
          ],
        },
        take: input.limit,
        orderBy: { updatedAt: "desc" },
        include: {
          opportunity: {
            select: {
              id: true,
              carLabel: true,
              stage: true,
              client: { select: { id: true, name: true } },
            },
          },
        },
      });
    }),

  // Estatísticas (simplificado)
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const baseWhere = getUserNotesWhere(ctx.session.user.id);
    const now = new Date();
    
    // Queries paralelas
    const [totalNotes, notesToday, notesThisWeek, notesThisMonth] = await Promise.all([
      ctx.db.notes.count({ where: baseWhere }),
      ctx.db.notes.count({
        where: {
          ...baseWhere,
          createdAt: { gte: new Date(now.setHours(0, 0, 0, 0)) },
        },
      }),
      ctx.db.notes.count({
        where: {
          ...baseWhere,
          createdAt: { gte: new Date(now.setDate(now.getDate() - 7)) },
        },
      }),
      ctx.db.notes.count({
        where: {
          ...baseWhere,
          createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
        },
      }),
    ]);

    return {
      totalNotes,
      notesToday,
      notesThisWeek,
      notesThisMonth,
    };
  }),
});