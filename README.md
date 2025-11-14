# Client Tracker

**Client Tracker** é um CRM simples e intuitivo voltado para **vendas de veículos**.  
Permite gerenciar **clientes**, seus **meios de contato**, **carros de interesse** e o **funil de vendas (oportunidades)** — com follow-ups, histórico de interações e controle de urgência.

---

## Propósito

- Centralizar informações de clientes e contatos.  
- Acompanhar interesse em veículos (**N:N via Oportunidade**).  
- Controlar estágio da negociação, urgência, orçamento e próximos passos.  
- Registrar interações (ligações, WhatsApp, notas, test drive).  

---

## Tecnologias

- **Frontend:** React / Next.js + TypeScript  
- **Backend:** tRPC (API tipada com Prisma ORM)  
- **Banco de dados:** PostgreSQL ou SQLite  
- **Estilo:** Tailwind CSS v4  
- **Autenticação:** NextAuth (opcional)

---

## Como usar (modo rápido)

### Pré-requisitos
- Node.js **v18+**  
- Uma variável **DATABASE_URL** válida no `.env`

---

### Instalar dependências
```bash
npm install
