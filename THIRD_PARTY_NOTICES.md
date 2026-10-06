# Third-party notices

## DeepSeek Harness Core reference

- Project: [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
- Referenced area: `packages/core` (Agent, Agent Loop, Session, Tools, Scope, System Prompt, default-model selection, and tool presentation)
- Reference version: `0.2.0-rc.2`, commit `639ed015397290b3745d163aafe02ffee4aa3f84`
- Copyright: Copyright (c) 2026 DeepSeek
- License: MIT

The LFAA Core adapters are implemented for LFAA's existing Settings, Session, permission, tool, domain-service, and Daemon Owners. This change references the upstream package responsibilities and behavior; it does not copy upstream source files. LFAA-authored implementation files are not claimed as DeepSeek work. PTC execution is not included because LFAA does not currently have the required isolated runtime.

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

LFAA consumes these locked packages as dependencies and does not copy their source into the computer-use adapter. A packaged distribution that includes the Windows native runtime must retain the upstream notices and applicable license material.

## EasyTier network runtime

- Project: [EasyTier](https://github.com/EasyTier/EasyTier)
- Runtime release: v2.6.4, Windows x86_64 official release ZIP, downloaded by an administrator-triggered Connectivity App task; it is not bundled into the LFAA source tree.
- License: LGPL-3.0. The verified official release files are retained in the node's managed runtime directory, including upstream license and notice files.
- Official source and release: [EasyTier v2.6.4 release](https://github.com/EasyTier/EasyTier/releases/tag/v2.6.4), [EasyTier license](https://github.com/EasyTier/EasyTier/blob/main/LICENSE).

LFAA currently uses this independent runtime as an external process artifact. No MCTier code, interface assets, or text are included. The download URL, version, expected SHA-256 digest, and byte count are recorded in `packages/network/game-connectivity/src/easytier-release.mjs`; the Daemon rejects any asset that does not match that fixed manifest. EasyTier remains unstarted until a later stage implements its structured instance-management operations.
