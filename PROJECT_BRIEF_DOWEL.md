# PROJECT BRIEF — Dowel, a modular shelving configurator

> **How to use this file.** This is the complete specification. Read it fully before writing any code.
> Work through the phases in order. **Stop at every GATE** and report to me before continuing.
>
> This is the second project in a portfolio. The first, Lintel Engineering, established the standard:
> measured results, enforced budgets, and a written record of every non-obvious decision. This one is
> deliberately smaller — two to three days, not eight phases — but held to the same standard.

---

## 0. Before you write a single line

Ask me these and wait. Do not assume.

1. **Brand name** — the brief uses `Dowel`. I will check it is not an existing furniture brand. Confirm or I will give you another.
2. **Database** — Neon or Supabase. Both are free Postgres; pick whichever you can provision faster and tell me which.
3. **Deploy target** — Vercel, same account as the previous project.
4. Node version and package manager, same as last time unless I say otherwise.

Then restate the plan in ten lines and start Phase 1.

---

## 1. What this is

A 3D configurator for a modular shelving system. The visitor assembles a unit from modules on a grid, changes its dimensions and finish, watches the price update, and shares the result as a link that restores the exact build.

It exists to demonstrate three things the previous project did not:

1. **A GraphQL API with a typed client**, schema-first, with generated types rather than hand-written ones.
2. **Server-authoritative domain logic.** The client never computes a price and never decides whether a configuration is legal. It sends a configuration; the server validates it against compatibility rules and returns the price. A configurator that prices on the client is a demo; one that prices on the server is a product.
3. **Real-time 3D that does not cost performance.** Procedural assembly and instancing, not a spinning GLB.

### Success criteria

| Criterion | Target |
| --- | --- |
| Lighthouse Performance, landing route before any 3D interaction | ≥ 95 |
| Lighthouse Accessibility | 100 |
| First-load JS, landing route, gzipped | < 150 KB |
| The 3D chunk | lazy, **not** in the initial bundle — verify in the build output |
| Frame rate, desktop | 60 fps while dragging and resizing |
| Frame rate, throttled mobile profile (4× CPU slowdown) | ≥ 30 fps |
| Draw calls at maximum configuration | < 30 — instancing, not one mesh per module |
| TypeScript errors under `strict` | 0 |
| `any` in source | 0 |
| GraphQL types | generated, never hand-written |
| Price computed on the client | never |
| CI | green, including a check against the deployed URL |

---

## 2. Non-negotiable constraints

- **One Next.js application.** The GraphQL server is a route handler in the same app. No separate service, no separate deploy, no paid hosting.
- **TypeScript strict**, `noUncheckedIndexedAccess`. No `any`, no `@ts-ignore`.
- **The server is the authority** on pricing and on whether a configuration is valid. Assume the client is hostile: a mutation carrying an impossible configuration must be rejected by the resolver, not by the UI.
- **No component library** for the interface chrome. Same reasoning as last time.
- **3D assets are CC0 only**, credited in `CREDITS.md`. If you generate the geometry in code instead of loading a model, say so — that is a legitimate and often better answer here.
- **Every phase ends in a commit** with a Conventional Commits message, on a branch, merged by PR.

---

## 3. The product

**Dowel** sells a modular shelving system. A unit is assembled on a grid from three module types:

| Module | Occupies | Notes |
| --- | --- | --- |
| Open shelf | 1 cell | the default |
| Drawer | 1 cell | cannot sit in the top row |
| Door | 2 cells, vertical | cannot span the top edge |

A unit has a width (2–6 columns), a height (2–5 rows), and one of three finishes: oak, charcoal, and white. Every cell holds exactly one module or is left empty. The frame is implied by the grid.

**Compatibility rules** (these are the reason the server exists):

1. A drawer may not occupy a cell in the top row.
2. A door occupies two vertically adjacent cells and both must be free.
3. A unit wider than 4 columns requires a centre support, which consumes the middle column of the bottom row.
4. A unit may not be entirely empty.

**Pricing** is the frame base price, plus a per-cell price, plus a per-module price that varies by module type, with a finish multiplier. The exact numbers are yours — put them in one place, make them data rather than literals, and make the server the only thing that reads them.

Write real copy for the handful of strings the interface needs. The rules from the previous brief still apply: no superlatives, no Lorem ipsum, sentence case headings, microcopy written deliberately. There is no marketing site here — a short header, the configurator, and a short footer with a line stating that Dowel is a fictional company and this is a demonstration project.

---

## 4. Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js, App Router |
| Language | TypeScript, `strict` |
| Styling | Tailwind CSS, theme from CSS custom properties |
| 3D | React Three Fiber + drei |
| GraphQL server | GraphQL Yoga as a route handler at `app/api/graphql/route.ts` |
| GraphQL client | urql or Apollo Client — pick the lighter one for this surface and say why |
| Types | `graphql-codegen`, schema-first, types generated into the repo and checked in CI |
| ORM | Prisma |
| Database | Neon or Supabase Postgres |
| Unit tests | Vitest |
| Browser tests | Playwright |
| CI | GitHub Actions |
| Deploy | Vercel |

**On React Three Fiber:** it is the right choice for a React portfolio, but it is a wrapper, and a reviewer will want to know you understand what is underneath. So the instancing and the geometry assembly are written against the Three.js API directly rather than left to a helper. Be able to explain the scene graph you built.

---

## 5. The GraphQL API

Schema-first. Write the SDL, generate the types, implement the resolvers against them.

Roughly:

```graphql
type Query {
  catalogue: Catalogue!                      # module types, finishes, limits, prices
  configuration(id: ID!): Configuration      # restore a shared build
}

type Mutation {
  priceConfiguration(input: ConfigurationInput!): PricedConfiguration!
  saveConfiguration(input: ConfigurationInput!): Configuration!
}
```

Requirements:

- **`priceConfiguration` validates before it prices.** An invalid configuration returns the specific rule it broke, in a form the interface can render next to the offending cell — not a generic error string.
- **Validation lives in one module**, imported by both the resolver and its unit tests. The client may import it too, for instant feedback, but the server never trusts the result.
- **`saveConfiguration` persists** and returns a short id that becomes the share link. Validate again on save; a client can call the mutation directly.
- **Generated types are committed** and CI fails if they are stale — regenerate and diff.
- Errors are typed results where the failure is expected (an invalid configuration), and GraphQL errors only where something actually went wrong.

Unit-test the rules exhaustively before any 3D exists: every rule, its boundary, and a few configurations that are valid for non-obvious reasons.

---

## 6. The scene

### Assembly

The unit is built from geometry assembled in code, not from a downloaded model of a finished shelf. A model cannot change its own dimensions; generated geometry can. If you use CC0 assets at all it should be for an environment map or a texture, credited.

- **Instance the repeated parts.** One `InstancedMesh` per part type across the whole unit, not one mesh per module. Draw calls at maximum configuration are a success criterion, so measure them and report the number.
- Modules snap to the grid. Adding, removing and changing a module updates instance matrices rather than rebuilding the scene graph.
- Changing width or height animates rather than cutting, briefly and with `prefers-reduced-motion` honoured.

### Looking right

This is where web 3D usually betrays itself. Default lighting plus a grey background reads as a tutorial.

- An **HDRI environment map** for reflections and ambient light, not a pile of point lights.
- **Soft contact shadows** under the unit, so it sits on something rather than floating.
- **ACES filmic tone mapping**, correct colour space, and physically plausible material values — roughness and metalness that mean something for wood and powder-coated steel.
- A considered camera: a default three-quarter view, constrained orbit, and two or three preset angles. Do not let the user orbit under the floor.
- The background belongs to the page, not to the canvas. No gradient mesh behind the model.

### Not costing performance

- The canvas and everything it imports load **lazily**, behind an interaction or an intersection observer. Verify it is absent from the initial bundle by reading the build output, not by assuming.
- A written loading state. Not a blank area, not a spinner alone.
- Dispose geometries, materials and textures on unmount. Mount and unmount the configurator twenty times and show me that memory returns.
- Measure frame rate under a 4× CPU slowdown and report the number. "It feels smooth" is not a measurement.

---

## 7. Accessibility

A 3D canvas is not an excuse.

- **Every configuration action is reachable without the canvas.** The grid has a real control surface — a list or table of cells with proper controls — and the canvas is a view of it. Someone using a keyboard or a screen reader can build and price a unit completely.
- The canvas has a meaningful text alternative that describes the current configuration and updates as it changes.
- Price changes and validation failures are announced through a live region.
- Visible focus, logical order, `prefers-reduced-motion` honoured.
- axe on the page in both states, zero violations.

---

## 8. Testing

Smaller than the previous project. Meaningful, not numerous.

**Unit (Vitest)** — the compatibility rules exhaustively, the pricing function against a table of known configurations, and the id encoding for share links.

**Integration** — the resolvers, called directly: a valid configuration prices correctly; each rule is rejected with the right code; a save round-trips.

**Browser (Playwright)** — build a unit through the non-canvas controls and assert the price; share a configuration, open the link in a fresh context and assert the same build is restored; axe on both states; an invalid attempt shows the rule.

**Deployed check** — the same practice as last time: a script that runs against the live URL and asserts the page hydrates, the API answers, and a configuration can be priced. Local verification is not verification.

---

## 9. CI

One workflow: type check, lint, generated-types freshness, unit, integration, build, bundle budget, Playwright, and the deployed check. It fails the build on a budget breach, the same as before.

---

## 10. Repository

`README.md` carries: one line on what it is; the live link; a short recording or a screenshot; the stack with reasons; the schema; the measured numbers including draw calls and frame rate; what is server-authoritative and why; how to run it; and a decisions section. State plainly that Dowel is fictional.

`DECISIONS.md` gets an entry per non-obvious choice, dated, as before.

---

## 11. Execution plan

### Phase 1 — Foundation
Next.js, TypeScript strict, Tailwind, Prisma against the database, GraphQL Yoga answering an introspection query, codegen wired, Vitest and Playwright configured, CI green on an empty project.

**GATE 1:** CI green. Report first-load JS and confirm nothing 3D is in the bundle yet.

### Phase 2 — Domain and API, with no interface at all
The schema, the rules module, pricing, resolvers, persistence, generated types. Tested exhaustively.

**GATE 2:** Show me the SDL and the output of four operations run against the local endpoint — a valid price, two different rule violations, and a save-then-restore. Raw responses, not a description.

### Phase 3 — The scene
Geometry assembly, instancing, grid snapping, materials, lighting, camera. Static configuration, no controls yet.

**GATE 3:** Screenshots at three configurations — minimum, maximum, and one with doors and drawers. Report draw calls and frame rate under 4× CPU slowdown.

### Phase 4 — The configurator
Controls, the accessible non-canvas surface, live pricing from the server, validation feedback, save and share.

**GATE 4:** Deploy. Give me the live URL and a share link. I will open it on a phone.

### Phase 5 — Performance, accessibility, README
Bundle analysis, lazy-loading verified in the build output, disposal verified, axe, Lighthouse, the deployed check in CI, README and CREDITS.

**GATE 5:** The measured table, green CI, and the README.

---

## 12. Anti-patterns — do not do any of these

The 3D ones first, because they are what make web 3D look amateur:

- A model that rotates on its own. Nothing moves unless the user moved it.
- Unconstrained `OrbitControls` — the camera ending up inside the shelf or under the floor.
- Default lighting: an ambient light plus a directional light, no environment, no tone mapping.
- An object with no shadow, floating on a flat background.
- A gradient or starfield inside the canvas.
- A blank rectangle while the scene loads.
- One mesh per module.
- A frame rate measured only on your own machine.
- A "Built with Three.js" badge, or any badge.

And the general ones, unchanged from the last brief:

- Lorem ipsum, placeholder links, dead controls, emoji in UI or commits.
- Prices or validation computed on the client and trusted.
- Hand-written GraphQL types.
- `any`, `@ts-ignore`, non-null assertions used to silence the compiler.
- `console.log` in source.
- Tests that assert something rendered without asserting what.
- Commits named `update`, `fix`, `final`.

---

## 13. How to work with me

Same as before, and these in particular, because they are what the last project was actually worth:

- **Stop at every gate.** Five phases, five reports.
- **Name your instrument.** When you report a measurement, say what measured it. The last project produced four defects that survived a passing check because the instrument was wrong, not the system — a string replacement that silently failed, `curl` reading the shell of a client-rendered page, a performance delta that was a font subset, and a CI pipeline that looked green because it never ran. Expect a fifth here and look for it.
- **Fail loudly.** A failed edit aborts rather than writing a no-op. A guard that trips says what tripped it.
- **Verify on the deployed site**, not on localhost.
- When a requirement here is wrong for the architecture, say so before implementing, with the measurement that shows it.
- Keep `DECISIONS.md` current as you go, not at the end.
