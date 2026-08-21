# Role and permission matrix

This matrix is the authorization contract for Bagihasil. API authorization is authoritative; hidden navigation links are not proof of access control.

## Roles

| Capability | ADMIN | VIEWER | INVESTOR |
|---|---:|---:|---:|
| Admin dashboard data | Read/write | Read only | No; investor-scoped dashboard only |
| Users | Read/write | Denied | Denied |
| Investors | Read/write all | Read all | Read own record only |
| Units | Read/write all | Read all | Read own units only |
| Transactions | Read/write all | Read all | Read own transactions only |
| Activity logs | Read | Read | Denied |
| All-investor report | Read | Read | Denied |
| Investor/transaction report | Read all | Read all | Read own only |
| Costs, finalization, profit sharing, payments | Write | Denied | Denied |
| Imports, uploads, AI parsers | Write | Denied | Denied |

## Required denial semantics

- Missing authentication returns `401`.
- Authenticated but disallowed role returns `403` before request-body parsing or database writes.
- INVESTOR tenant filters always come from the authenticated user-to-investor relation; query parameters cannot broaden scope.
- Cross-investor transaction and report reads return `403`.
- Attempted forbidden writes leave zero matching test fixtures.

## Automated evidence

`e2e/specs/auth-roles.spec.ts` verifies:

- authenticated role identity;
- middleware confinement of investor pages;
- VIEWER denial on representative mutations;
- INVESTOR denial on financial mutations;
- own-only investor, unit, and transaction collections;
- cross-investor transaction and report denial.

The official E2E runner—not the Playwright spec itself—performs final cleanup and verifies zero remaining users, investors, units, and transactions.

The official runner is `npm run test:e2e:auth`. It uses only `.env.test.local`, the fixed loopback origin `http://localhost:3100`, and a database identity independently verified as E2E before writes are permitted.
