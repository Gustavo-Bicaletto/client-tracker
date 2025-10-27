import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

export const clientRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.client.findMany({
      where: { createdBy: { id: ctx.session.user.id } },
      orderBy: { createdAt: "desc" },
    });
  }),

  get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    return ctx.db.client.findFirst({
      where: { id: input.id, createdBy: { id: ctx.session.user.id } },
    });
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1), email: z.string().email().optional(), phone: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.client.create({
        data: {
          name: input.name,
          email: input.email ?? null,
          phone: input.phone ?? null,
          createdBy: { connect: { id: ctx.session.user.id } },
        },
      });
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), name: z.string().min(1).optional(), email: z.string().email().optional(), phone: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.client.findFirst({ where: { id: input.id, createdBy: { id: ctx.session.user.id } } });
      if (!existing) throw new Error("Client not found");

      return ctx.db.client.update({
        where: { id: input.id },
        data: {
          name: input.name ?? existing.name,
          email: input.email ?? existing.email,
          phone: input.phone ?? existing.phone,
        },
      });
    }),

  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const existing = await ctx.db.client.findFirst({ where: { id: input.id, createdBy: { id: ctx.session.user.id } } });
    if (!existing) throw new Error("Client not found");

    await ctx.db.client.delete({ where: { id: input.id } });
    return { success: true };
  }),
});
