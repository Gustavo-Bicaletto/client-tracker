"use client";

import { useState } from "react";
import { api } from "~/trpc/react";

export default function ClientsManager() {
  const utils = api.useUtils();
  const { data: clients } = api.clients.list.useQuery();

  const createClient = api.clients.create.useMutation({
    onSuccess: async () => {
      await utils.clients.invalidate();
      setName("");
      setEmail("");
      setPhone("");
    },
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  return (
    <div className="space-y-8">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          createClient.mutate({ name, email, phone });
        }}
        className="flex flex-col gap-4"
      >
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do cliente"
          className="rounded-lg border border-gray-300 px-4 py-2"
          required
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="rounded-lg border border-gray-300 px-4 py-2"
        />
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Telefone"
          className="rounded-lg border border-gray-300 px-4 py-2"
        />
        <button
          type="submit"
          className="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
          disabled={createClient.isPending}
        >
          {createClient.isPending ? "Adicionando..." : "Adicionar Cliente"}
        </button>
      </form>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Lista de Clientes</h2>
        {clients?.map((client) => (
          <div
            key={client.id}
            className="rounded-lg border border-gray-200 p-4 shadow-sm"
          >
            <h3 className="font-medium">{client.name}</h3>
            {client.email && (
              <p className="text-sm text-gray-600">Email: {client.email}</p>
            )}
            {client.phone && (
              <p className="text-sm text-gray-600">Telefone: {client.phone}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}