# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Minecraft players who want to open and operate a server for themselves and others. They need a quick path to create a real server and clear controls for its ongoing operation.

## Product Purpose

The LFAA Minecraft app helps players provision a server on an available Daemon node, then see its real status and manage the instance, tasks, and server console. Success means the player can complete the real deployment flow and understand whether the server is ready to operate.

## Positioning

The app drives real Minecraft deployment and instance operations through LFAA's authenticated control plane and Daemon execution path. It is not a hosted-server marketplace and must not present unavailable monitoring or execution capabilities as live.

## Operating Context

Players use the Minecraft workspace to start a deployment, inspect available nodes, manage instances, review deployment and task results, and read or operate a running server's console when the node supports it. Server actions may affect a running instance and continue to use the existing role, permission, and state checks.

## Capabilities and Constraints

- Existing Settings provide server defaults and appearance preferences; the interface consumes those values without replacing account preferences.
- Deployment, instance lifecycle, task state, logs, and node health come from their existing authenticated domain owners.
- A displayed server action is available only when the existing role, node, instance, and capability conditions permit it.
- The current app does not provide CPU, TPS, or memory sampling; it must say so rather than imply that those metrics are measured.
- EULA acceptance and any other required license action must remain explicit and use the existing permission flow.

## Brand Commitments

The user asks for a player-oriented server launch and operations panel that feels simple, elegant, and easy to operate. First deployment must be easy to find; an existing server should expose its real, permission-checked start action directly. The product name is Minecraft within LFAA.

## Evidence on Hand

The existing UI and package contract cover the real deployment wizard, nodes, instances, tasks, server configuration, backups, and interactive console. No product photography, player testimonials, public hosting claims, or performance-sampling data are supplied.

## Product Principles

- Make the real server-creation path easy to find and complete.
- Put current server readiness and its next useful action first.
- Keep ongoing operation understandable to players while exposing real advanced controls.
- Report only data and capabilities returned by the owning service.
- Preserve user appearance preferences and existing authorization checks.
