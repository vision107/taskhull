# AGENTS.md

Guidelines for AI agents (Cursor, Claude, Copilot) working with this codebase.

## Essential Commands

```bash
npm run dev           # Start development server
npm run build         # Build for production
npm run db:migrate    # Run database migrations
npm run db:studio     # Open Drizzle Studio (DB GUI)
npm run db:generate   # Generate new migration
npm run docker:up     # Start PostgreSQL
npm run docker:down   # Stop PostgreSQL
npm run stripe:listen # Forward Stripe webhooks locally
npm run email:dev     # Preview email templates (port 3001)
npm run mcp:build     # Compile the local MCP server
npm run mcp:start     # Start the MCP server over stdio
npm run test          # Run unit tests
npm run e2e           # Run E2E tests
npm run lint          # Run Oxlint
npm run check:write   # Fix lint issues and format with Oxfmt
npm run typecheck     # Type check
npm run deps:check    # Check for dependency updates
npm run deps:update   # Update package.json versions
```

## Code Style

### Core Principles

- Write concise, type-safe TypeScript
- Follow existing patterns in the codebase
- Use early returns, avoid nested conditionals
- Never use `any` - use `unknown` or proper types
- Use `const` by default, `let` only when needed

### Naming Conventions

- **Files**: `kebab-case.tsx` / `kebab-case.ts`
- **Components**: `PascalCase`
- **Functions/Variables**: `camelCase`
- **Types/Interfaces**: `PascalCase`
- **Schemas**: `[domain]-schemas.ts`
- **Routers**: `[scope]-[feature].ts`

### Component Structure

```typescript
interface MyComponentProps {
  required: string;
  optional?: number;
  className?: string;
}

export function MyComponent({ required, optional, className }: MyComponentProps) {
  // 1. Hooks
  const router = useRouter();
  const { data } = trpc.example.useQuery();

  // 2. Derived state
  const isValid = Boolean(required);

  // 3. Event handlers
  const handleClick = () => { ... };

  // 4. Early returns
  if (!data) return <Skeleton />;

  // 5. Render
  return (
    <div className={cn("base-styles", className)}>
      {/* content */}
    </div>
  );
}
```

## Project Patterns

### New Feature Workflow

1. **Database schema** → `lib/db/schema/tables.ts`
2. **Zod validation** → `schemas/[domain]-schemas.ts`
3. **tRPC router** → `trpc/routers/[scope]/[feature].ts`
4. **React component** → `components/[domain]/[component].tsx`

### Database Queries (Drizzle ORM)

```typescript
// Simple query
const user = await db.query.userTable.findFirst({
	where: eq(userTable.id, userId),
	with: { organizations: true },
});

// Complex query
const leads = await db
	.select()
	.from(leadTable)
	.where(
		and(eq(leadTable.organizationId, orgId), eq(leadTable.status, "qualified")),
	)
	.orderBy(desc(leadTable.createdAt))
	.limit(10);
```

### tRPC Procedures

```typescript
// Available procedures
import {
	publicProcedure, // No auth required
	protectedProcedure, // Requires login
	protectedAdminProcedure, // Requires admin role
	protectedOrganizationProcedure, // Requires org membership
} from "@/trpc/init";

// Example router
export const myRouter = createTRPCRouter({
	getAll: protectedOrganizationProcedure.query(async ({ ctx }) => {
		// ctx.user, ctx.organization, ctx.membership available
		return db.query.myTable.findMany({
			where: eq(myTable.organizationId, ctx.organization.id),
		});
	}),

	create: protectedOrganizationProcedure
		.input(createSchema)
		.mutation(async ({ ctx, input }) => {
			// Always check roles for sensitive actions
			if (ctx.membership.role !== "owner" && ctx.membership.role !== "admin") {
				throw new TRPCError({ code: "FORBIDDEN" });
			}
			// ...
		}),
});
```

### Authentication

```typescript
// Client-side
import { useSession } from "@/hooks/use-session";
const { user, isPending } = useSession();

// Server-side
import { getSession } from "@/lib/auth/server";
const session = await getSession();

// Organization context
import { useActiveOrganization } from "@/components/active-organization-provider";
const { organization } = useActiveOrganization();
```

### Forms (React Hook Form + Zod)

```typescript
import { useZodForm } from "@/hooks/use-zod-form";

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

function MyForm() {
  const form = useZodForm({ schema, defaultValues: { name: "", email: "" } });

  const onSubmit = form.handleSubmit(async (data) => {
    await mutation.mutateAsync(data);
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit}>
        <FormField name="name" control={form.control} render={...} />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving..." : "Save"}
        </Button>
      </form>
    </Form>
  );
}
```

### Modals & Dialogs

We use `@ebay/nice-modal-react` for modal management to provide a clean, declarative API for showing modals without manually managing `isOpen` state in every component.

```typescript
// 1. Show a standard confirmation modal
import NiceModal from "@ebay/nice-modal-react";
import { ConfirmationModal } from "@/components/confirmation-modal";

NiceModal.show(ConfirmationModal, {
  title: "Are you sure?",
  message: "This action cannot be undone.",
  confirmLabel: "Delete",
  destructive: true,
  onConfirm: async () => {
    await mutation.mutateAsync({ id });
  },
});

// 2. Custom modals
// 1. Define: components/my-modal.tsx
export const MyModal = NiceModal.create(({ name }: { name: string }) => {
  const modal = useEnhancedModal(); // Use this for standard backdrop/close logic
  return (
    <Dialog
      open={modal.visible}
      onOpenChange={modal.handleOpenChange}
      onOpenChangeComplete={modal.handleOpenChangeComplete}
    >
      <DialogContent>{/* ... */}</DialogContent>
    </Dialog>
  );
});

// 2. Show:
NiceModal.show(MyModal, { name: "Example" });
```

### Error Handling

```typescript
// tRPC mutations
try {
	await mutation.mutateAsync(data);
	toast.success("Saved successfully");
} catch (error) {
	logger.error({ error }, "Operation failed");
	toast.error("Something went wrong. Please try again.");
}

// tRPC procedures
if (!item) {
	throw new TRPCError({
		code: "NOT_FOUND",
		message: "Item not found",
	});
}
```

### Logging

```typescript
import { logger } from "@/lib/logger";

// Use structured logging - object FIRST, message SECOND
logger.info({ userId, action }, "User performed action");
logger.error({ error, context }, "Operation failed");

// Never use console.log in production code
```

## Role System

See [ROLES.md](./ROLES.md) for full documentation.

**Two-tier system:**

1. **Platform Role** (`user.role`): `user` | `admin` - Controls admin panel access
2. **Organization Role** (`member.role`): `owner` | `admin` | `member` - Per-org permissions

```typescript
// Platform admin check
if (ctx.user.role !== "admin") { ... }

// Organization admin check
if (ctx.membership.role !== "owner" && ctx.membership.role !== "admin") { ... }
```

## Multi-Tenant Data

**ALWAYS filter by organization** for tenant data:

```typescript
// ✅ CORRECT
const leads = await db.query.leadTable.findMany({
	where: eq(leadTable.organizationId, ctx.organization.id),
});

// ❌ WRONG - Data leak across tenants
const leads = await db.query.leadTable.findMany();
```

## UI Components

Use existing components from `@/components/ui/`:

When the local MCP server is connected, use its `list_components` and
`read_component` tools before creating a component to discover reusable UI and
feature components.

- `Button`, `Input`, `Textarea`, `Select`
- `Card`, `Dialog`, `Sheet`, `Drawer`
- `Form`, `FormField`, `FormItem`, `FormLabel`, `FormMessage`
- `DataTable` for lists
- `Skeleton` for loading states
- `toast` from `sonner` for notifications

```typescript
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
```

## Billing Checks

```typescript
import {
	requirePaidPlan,
	getOrganizationPlanLimits,
} from "@/lib/billing/guards";

// In tRPC procedure
await requirePaidPlan(ctx.organization.id);

// Check limits
const limits = await getOrganizationPlanLimits(ctx.organization.id);
if (memberCount >= limits.maxMembers) {
	throw new TRPCError({ code: "FORBIDDEN", message: "Member limit reached" });
}
```

## Git Conventions

### Commit Messages

Follow Conventional Commits:

```
feat: add lead export feature
fix: resolve billing calculation error
chore: update dependencies
docs: improve quickstart guide
```

### Before Committing

1. Run `npm run lint` - fix any errors
2. Run `npm run typecheck` - ensure no type errors
3. Run `npm run test` - ensure tests pass

### Never

- Commit `.env` files
- Use `--no-verify` to skip hooks
- Push directly to main

## Key Files

| File                       | Purpose                        |
| -------------------------- | ------------------------------ |
| `config/app.config.ts`     | App name, description, contact |
| `config/billing.config.ts` | Plans, pricing, limits         |
| `config/auth.config.ts`    | Auth settings                  |
| `lib/db/schema/tables.ts`  | Database tables                |
| `lib/db/schema/enums.ts`   | Database enums                 |
| `trpc/init.ts`             | tRPC procedures & middleware   |
| `trpc/routers/app.ts`      | Root router                    |

## Common Tasks

### Add a new database table

1. Define table in `lib/db/schema/tables.ts`
2. Add relations in `lib/db/schema/relations.ts`
3. Export from `lib/db/schema/index.ts`
4. Run `npm run db:generate`
5. Run `npm run db:migrate`

### Add a new tRPC endpoint

1. Create/update router in `trpc/routers/[scope]/`
2. Register in `trpc/routers/app.ts` if new router
3. Use from client: `trpc.[router].[procedure].useQuery/useMutation()`

### Add a new page

1. Create route in `app/(saas)/dashboard/...`
2. Use `protectedOrganizationProcedure` for data fetching
3. Add navigation link in sidebar if needed

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
