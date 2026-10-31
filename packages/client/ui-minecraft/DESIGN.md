# Minecraft UI Design Contract

<!-- impeccable:design-schema 1 -->

## Direction

The Minecraft manual workspace is a player friendly launch and operations panel. Its direction is a **layered operations cockpit**: clear page hierarchy, deliberate breathing room, distinct section surfaces, and compact actionable rows. The current shared workbench remains the outer frame; Minecraft adds depth inside it through existing surface, border, and shadow tokens. Avoid the previous row-only flat treatment.

The signature element is the **real node-to-instance relationship** and the fastest available next action. An empty overview keeps the actual three-step deployment path (choose server, choose a ready device, review configuration and EULA). With an existing server, the relationship connects only its registered node and instance. This gives the screen a Minecraft-specific shape without implying a fake world, network route, or performance measurement.

## Product priorities

1. Make first deployment easy to find and understand.
2. Show a real existing server's state and the next available operation near the top.
3. Keep nodes, instances, tasks, configuration, backups, and console controls easy to scan for ongoing operations.
4. Treat unknown, disconnected, stale, denied, empty, and failed states as first class visible states.

## Layout and hierarchy

- Keep the shared LFAA navigation and familiar section controls recognizable; open Minecraft on its title and available server action.
- Order the overview as current server or the real first-deployment path, a four-card whole-node resource strip, three live operational summaries, then open sections for running devices and recent tasks.
- Treat the deployment flow as a real sequence rather than a decorative banner. Put the primary "开始开服" action in the title row and keep the existing wizard's required review steps intact.
- Keep the live node-to-instance relationship beside the real server when one exists. Do not draw a route when there is no instance.
- On the Minecraft overview server card, place the real lifecycle, terminal, and management actions at the upper right beside the instance identity. Put a quiet core identity at the lower right under those actions, using the selected instance's actual core name and Minecraft version; use the unmodified Paper mark only for Paper and a neutral core glyph for other cores. Keep the node-to-instance relationship on its own row. In narrow containers, reflow the actions and core identity without clipping.
- Keep configuration and operational detail secondary to the next useful action. The `server.properties` editor uses open, unframed groups: headings and item counts establish hierarchy, generous spacing and a quiet rule separate groups, and the controls remain the only filled surfaces. Do not wrap each configuration category in another card. Other operational sections may use shared surface tokens where a contained task needs them.
- Keep row actions aligned with their content at desktop widths. Under narrow container widths, reflow them into a clear, full-width or wrapped action area without clipping or shrinking touch controls.
- Remove repetitive explanatory copy from operational views. Retain text that states a real limit, required permission, destructive effect, or license obligation.
- Use Grid or Flexbox for page layouts. Let content wrap and stack by the available workspace width and height. Do not depend on global window width, `inline-block`, or clipped horizontal layouts.
- Dialogs remain bounded by their owning workspace and scroll inside short viewports.

## Color, type, and effects

- Do not assign a new fixed palette. Consume shared theme/surface/text/border/status tokens, `--settings-accent`, selected appearance fonts and type scales.
- Status color must correspond to real state: running/ready, stopped, in progress, error, offline, or unknown. Do not style a decorative route as a connectivity or health measurement.
- Wallpaper is supplied by `appearance.backgrounds.minecraft`; surfaces respect the mapped per-area overlay, opacity, and blur. No bundled background or forced theme.
- Use the configured code font and code size for IDs, ports, Java paths, and console data where the current interface already uses code values.
- Give real surfaces visible depth with the shared surface and shadow tokens; keep decorative glow limited to the selected, active, or primary state and use the user's accent token.
- Use `lfaa-card-motion` for purposeful list entrance and card hover feedback so `general.cardMotionEffect` remains the single control. Do not add continuous ornamental loops. Reduced-motion settings suppress spatial/entrance motion while preserving visible state and action feedback.
- Every new CSS custom property needs an adjacent Chinese comment describing its scoped area and specific color/alpha or effect strength.

## Components and scope

- `packages/client/ui-minecraft` is the sole owner of its app-level screen and visual rules. Keep selectors scoped to `.minecraft-workspace` and named child regions.
- Preserve current Ant Design and CSS dependencies. Do not change the shared Workbench shell, shared App routing, Minecraft API, settings service, permission owner, or domain behavior to achieve appearance changes.
- Preserve the real deployment wizard, explicit EULA step, role/node/state/capability gating, service actions, task results, logs, and backup behavior. The global overview resource strip is whole-node CPU/memory/disk/network only; keep it distinct from per-instance TPS/player availability and never imply process-level metrics.
- Java Environment and public Connectivity routes keep their existing owning apps; Minecraft only retains its existing navigation into them.
- The instance configuration center edits every key in the node's real `server.properties` snapshot. Keep status and operations in the existing side rail, keep the editor in the central work area, and send only changed keys through the authenticated Minecraft task owner.

## Responsive and input behavior

- Ensure desktop, tablet, phone, narrow embedded column, and short-height viewports keep the primary action, status, navigation, and field labels readable and reachable. Base layout decisions on the Minecraft content container, not just the window width.
- Lists and logs may scroll within their content regions; top level pages must retain a usable page scroll when height is short.
- Keyboard focus remains visible; text has sufficient contrast against the user's theme/background. Touch targets must remain usable without hover.

## Motion thesis

- Focal relationship: entry/hover feedback makes an actionable server, task, node, or workflow item feel like a real selectable surface.
- Continuity: selected filters, tabs, and status changes retain their existing state and only use the shared motion effect where it explains the change.
- Budget: no new animation loop, timer, observer, motion library, or preference. Lists use the shared bounded stagger; hover remains disabled on devices that do not support hover; reduced-motion mode keeps the final state visible.
