# Minecraft UI Design Contract

<!-- impeccable:design-schema 1 -->

## Direction

The Minecraft manual workspace is a player friendly launch and operations panel. Its visual basis is **true-black-flat** (Taste seed `1725674016`), adapted to the account's live Appearance tokens so it remains correct in light and dark themes. Elevation comes from neighboring surface tones; the workspace has no second frame, resting shadows, gradients, or ornamental art.

The signature element is a **real launch path**: the empty overview describes the current three-step deployment flow (choose server, choose a ready device, review configuration and EULA) and reports real Daemon readiness. With an existing server, the diagram connects only its registered node and instance. This gives the screen a Minecraft-specific shape without implying a fake world, network route, or performance measurement.

## Product priorities

1. Make first deployment easy to find and understand.
2. Show a real existing server's state and the next available operation near the top.
3. Keep nodes, instances, tasks, configuration, backups, and console controls easy to scan for ongoing operations.
4. Treat unknown, disconnected, stale, denied, empty, and failed states as first class visible states.

## Layout and hierarchy

- Keep the shared LFAA navigation and familiar section controls recognizable; open Minecraft on its title and available server action.
- Order the overview as current server or the real first-deployment path, three live operational summaries, then open sections for running devices and recent tasks.
- Treat the deployment flow as a real sequence rather than a decorative banner. Put the primary "开始开服" action in the title row and keep the existing wizard's required review steps intact.
- Keep the live node-to-instance relationship beside the real server when one exists. Do not draw a route when there is no instance.
- Keep configuration and operational detail secondary to the next useful action. Group related facts and controls in distinct named sections.
- Use Grid or Flexbox for page layouts. Let content wrap and stack by the available workspace width and height. Do not depend on global window width, `inline-block`, or clipped horizontal layouts.
- Dialogs remain bounded by their owning workspace and scroll inside short viewports.

## Color, type, and effects

- Do not assign a new fixed palette. Consume shared theme/surface/text/border/status tokens, `--settings-accent`, selected appearance fonts and type scales.
- Status color must correspond to real state: running/ready, stopped, in progress, error, offline, or unknown. Do not style a decorative route as a connectivity or health measurement.
- Wallpaper is supplied by `appearance.backgrounds.minecraft`; surfaces respect the mapped per-area overlay, opacity, and blur. No bundled background or forced theme.
- Use the configured code font and code size for IDs, ports, Java paths, and console data where the current interface already uses code values.
- Existing card motion stays registered with `lfaa-card-motion` and follows `general.cardMotionEffect` plus reduced-motion settings. This redesign adds no new animation choreography.
- Every new CSS custom property needs an adjacent Chinese comment describing its scoped area and specific color/alpha or effect strength.

## Components and scope

- `packages/client/ui-minecraft` is the sole owner of its app-level screen and visual rules. Keep selectors scoped to `.minecraft-workspace` and named child regions.
- Preserve current Ant Design and CSS dependencies. Do not change the shared Workbench shell, shared App routing, Minecraft API, settings service, permission owner, or domain behavior to achieve appearance changes.
- Preserve the real deployment wizard, explicit EULA step, role/node/state/capability gating, service actions, task results, logs, backup behavior, and honest gaps in CPU/TPS/player sampling.
- Java Environment and public Connectivity routes keep their existing owning apps; Minecraft only retains its existing navigation into them.

## Responsive and input behavior

- Ensure desktop, tablet, phone, narrow embedded column, and short-height viewports keep the primary action, status, navigation, and field labels readable and reachable.
- Lists and logs may scroll within their content regions; top level pages must retain a usable page scroll when height is short.
- Keyboard focus remains visible; text has sufficient contrast against the user's theme/background. Touch targets must remain usable without hover.
