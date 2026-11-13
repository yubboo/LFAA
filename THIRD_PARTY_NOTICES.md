# Third-party notices

This file records third-party code and product references used by LFAA. Preserve the listed copyright and license notices in any distribution that includes the corresponding material.

## Ekko Studio capability reference

- Project: [Ekko Studio](https://github.com/EKKOLearnAI/ekko-studio), by EKKOLearnAI.
- Local reference commit: `1242ac63556491c92ba6dd49d89fd19c91a6bdd5` (reviewed 2026-10-16).
- Repository license at that revision: [Business Source License 1.1](https://github.com/EKKOLearnAI/ekko-studio/blob/1242ac63556491c92ba6dd49d89fd19c91a6bdd5/LICENSE), with a non-commercial Additional Use Grant and a stated change date of 2029-05-10.
- Referenced behavior: multi-runtime workspaces, coding-agent dispatch, foreground/background delegation, shared task progress, deliverable skills and customizable templates.

The user selected commercial use with LFAA-authored implementations. This entry records a product reference; it does not claim that Ekko Studio source, UI assets, prompts, runtimes, or Skills were incorporated or commercially licensed. LFAA retains its own Agent Loop, Session, Settings, permission, and execution Owners. Record any later third-party integration with its own source, version, and license; a Skill license alone does not establish the provenance of every file in that directory.

Capability mapping and implementation status: [fusion register](docs/development/ekko-capability-fusion.md).

## DeepSeek Harness Core reference

- Project: [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
- Referenced area: `packages/core` (Agent, Agent Loop, Session, Tools, Scope, System Prompt, default-model selection, and tool presentation)
- Reference version: `0.2.0-rc.2`, commit `639ed015397290b3745d163aafe02ffee4aa3f84`
- Copyright: Copyright (c) 2026 DeepSeek
- License: MIT

LFAA adapters use its existing Settings, Session, permission, Tool, domain-service, and Daemon Owners. This is a reference to upstream package responsibilities and behavior; no upstream source files are claimed as LFAA work. PTC execution is not included because LFAA lacks the required isolated runtime.

The upstream MIT notice is reproduced here for attribution and license traceability:

> MIT License
>
> Copyright (c) 2026 DeepSeek
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> SOFTWARE.

## Cua Driver SDK

- Package: [`@trycua/cua-driver`](https://www.npmjs.com/package/@trycua/cua-driver), version `0.32.0`, MIT.
- Windows runtime: [`@trycua/cua-driver-win32-x64-msvc`](https://www.npmjs.com/package/@trycua/cua-driver-win32-x64-msvc), version `0.32.0`, package metadata declares `MIT AND MPL-2.0`.
- The upstream `node-runtime-NOTICE.md` states that `cua_driver_node_runtime.node` is a compatibility build derived from `uniffi-bindgen-react-native` `0.31.0-3` under MPL-2.0; the Cua repository release matching the package provides its source and deterministic build transformations: [Cua repository](https://github.com/trycua/cua).
- MPL-2.0 text: [Mozilla Public License 2.0](https://www.mozilla.org/MPL/2.0/).

LFAA uses these locked dependencies; their source is not copied into the computer-use adapter. Distributions that include the Windows native runtime must retain its upstream notices and applicable license material.

## EasyTier network runtime

- Project: [EasyTier](https://github.com/EasyTier/EasyTier)
- Runtime release: v2.6.4, Windows x86_64 official release ZIP, downloaded by an administrator-triggered Connectivity App task; it is not bundled into the LFAA source tree.
- License: LGPL-3.0. The verified official release files are retained in the node's managed runtime directory, including upstream license and notice files.
- Official source and release: [EasyTier v2.6.4 release](https://github.com/EasyTier/EasyTier/releases/tag/v2.6.4), [EasyTier license](https://github.com/EasyTier/EasyTier/blob/main/LICENSE).

LFAA runs this independent runtime as an external process; it does not include MCTier code, interface assets, or text. The download URL, version, SHA-256, and byte count are recorded in `packages/network/game-connectivity/src/easytier-release.mjs`; the Daemon rejects mismatched files. EasyTier remains unstarted until structured instance-management operations are implemented.
