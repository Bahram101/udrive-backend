
uDrive Backend
Project

uDrive service for mini town.

Stack
Next.js 16
TypeScript
Prisma ORM
PostgreSQL
Docker
Socket.IO

Architecture
Next.js App Router
API Routes for backend endpoints
Prisma ORM for database access
PostgreSQL database
Docker Compose for local development

Code Rules
Use TypeScript everywhere
Use App Router only
Do not use Server Actions
Use API Routes
Use Prisma singleton pattern
Use React Server Components by default
Use Client Components only when necessary

Database

Main entities:

User
Driver
Order

Order Statuses
NEW
ACCEPTED
ARRIVED
STARTED
COMPLETED
CANCELLED

Roles
CLIENT
DRIVER
ADMIN

Всегда работай с agy