# Execution control

[简体中文](execution-control.zh.md) · [Documentation](../README.md)

The [Chinese execution guide](execution-control.zh.md) retains detailed implementation and historical acceptance. Manual and AI operations share authorization, Jobs and the actual domain/Daemon executor. Model planning is not replaced by a fixed business script.

Account `permissions.mode`, Shell/environment preferences, AI budgets and Minecraft runtime settings remain authoritative. `aiRuntime.commandTimeoutSeconds` defaults to zero for unlimited execution; the scheduler fix does not change that preference. Minecraft EULA acceptance remains an independent human decision.

Daemon claims at most one Shell task and one maintenance task concurrently. Maintenance queues rotate; overlapping polls and claims after shutdown are prevented. Shutdown stops claims, cancels running commands, drains claimed tasks and then stops managed game processes before releasing runtime resources. This removes Shell-induced maintenance starvation, not all domain-level contention.

Electron spawns Node services with IPC and sends the existing `lfaa-shutdown` request. Exit code zero establishes successful service exit; timeout, disconnect or abnormal exit blocks update installation. The control plane stays available while the Daemon drains. Tauri's older direct child termination remains a documented compatibility limitation.

Authenticated leases, account ownership, output sequencing, cancellation and unknown-result handling remain in their existing owners. Unit and isolated process tests do not prove live Minecraft, Provider, desktop UI or installer acceptance.
