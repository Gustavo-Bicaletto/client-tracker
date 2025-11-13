"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Urgency } from "@prisma/client";

export default function ClientsManager() {
  const utils = api.useUtils();

  // Listagem com paginação
  const clients = api.client.getAll.useInfiniteQuery(
    { limit: 10 },
    { getNextPageParam: (last) => last.nextCursor }
  );

  // Criar cliente
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const createClient = api.client.create.useMutation({
    onSuccess: () => {
      void utils.client.getAll.invalidate();
      setName("");
      setEmail("");
    },
  });

  // Criar oportunidade para um cliente
  const createOpp = api.opportunity.create.useMutation({
    onSuccess: () => void utils.opportunity.getByClient.invalidate(),
  });

  // Criar nota
  const createNote = api.notes.create.useMutation({
    onSuccess: () => void utils.opportunity.getByClient.invalidate(),
  });

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Criar Cliente</h2>
        <div className="flex gap-2">
          <input
            className="border px-2 py-1"
            placeholder="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="border px-2 py-1"
            placeholder="Email (opcional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            className="rounded bg-blue-600 px-3 py-1 text-white disabled:opacity-50"
            disabled={!name || createClient.isLoading}
            onClick={() =>
              createClient.mutate({
                name,
                email: email || null,
                phone: null,
                urgency: Urgency.NORMAL,
              })
            }
          >
            {createClient.isLoading ? "Criando..." : "Criar"}
          </button>
        </div>
        {createClient.error && (
          <p className="text-sm text-red-600">{createClient.error.message}</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Clientes</h2>
        <ul className="space-y-2">
          {clients.data?.pages
            .flatMap((p) => p.clients)
            .map((c) => (
              <li key={c.id} className="rounded border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <strong>{c.name}</strong>{" "}
                    <span className="text-sm text-gray-500">
                      {c.email ?? "sem email"}
                    </span>
                    <div className="text-xs text-gray-500">
                      urgência: {c.urgency} • oportunidades: {c._count.opportunities}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="rounded bg-emerald-600 px-3 py-1 text-white"
                      onClick={() =>
                        createOpp.mutate({
                          clientId: c.id,
                          carLabel: "Novo interesse",
                          carModelId: null,
                          stage: "LEAD",
                          urgency: "NORMAL",
                        })
                      }
                    >
                      Criar oportunidade
                    </button>
                    <button
                      className="rounded bg-indigo-600 px-3 py-1 text-white"
                      onClick={() =>
                        createNote.mutate({
                          opportunityId: c.id, // ajuste se necessário: use o id de uma oportunidade real
                          title: "Contato inicial",
                          content: "Ligar para entender necessidades.",
                        })
                      }
                    >
                      Adicionar nota (exemplo)
                    </button>
                  </div>
                </div>
              </li>
            ))}
        </ul>

        <div>
          <button
            className="rounded border px-3 py-1 disabled:opacity-50"
            disabled={!clients.hasNextPage || clients.isFetchingNextPage}
            onClick={() => clients.fetchNextPage()}
          >
            {clients.isFetchingNextPage ? "Carregando..." : "Carregar mais"}
          </button>
        </div>
      </section>
    </div>
  );
}