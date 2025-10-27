import { auth as getServerAuthSession } from "~/server/auth";
import ClientsManager from "./_components/clients";


export default async function Home() {
  const session = await getServerAuthSession();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
        {session ? (
          <div className="w-full max-w-2xl">
            <h1 className="mb-8 text-3xl font-bold">Gerenciamento de Clientes</h1>
            <ClientsManager />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <h1 className="text-2xl">Bem-vindo ao Sistema de Clientes</h1>
            <p>Faça login para gerenciar seus clientes</p>
          </div>
        )}
      </div>
    </main>
  );
}