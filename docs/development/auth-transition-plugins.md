# Authentication Transition Plugin Contract

LFAA authentication transitions are replaceable Client extension points. The default implementation is provided by the root Renderer: it mounts and warms up a hidden Workbench behind the authentication overlay, then plays the built-in wallpaper lens and login-card absorption animation. As the event horizon completes, the Workbench becomes visible behind the overlay while remaining `inert` and `aria-hidden`; the overlay fades out with `opacity` over 240ms before the Renderer releases the interaction gate and displays reminders. The card uses an ease-in/ease-out `transform` curve, and the full-screen wallpaper is not scaled. The default path does not capture a page-wide snapshot or synchronously mount the Workbench when animation starts. Installed and assembled DSH Client plugins may contribute `auth.transition`; users select the active source in Settings.

## Slot and Inputs

- Name: `auth.transition`
- Type: `list`, scope: `root`
- Registration ID: the plugin assigns a stable, unique ID and provides a display label through `options.label`.
- `owner.phase`: `preparing` means authentication succeeded but settings and Workbench dependencies are still preparing; `entering` means the destination scene is ready and the transition is running. A custom plugin remains mounted until `ViewTransition.finished`; the default animation also fades out the overlay after its main animation before releasing the Workbench interaction gate. Reminders appear only after the full handoff.
- `owner.reducedMotion`: the final decision for the current transition based on the user's reduced-motion setting. When `true`, the plugin must not start motion.

Components receive `owner` through the DSH Slot. During `entering`, custom plugins can provide CSS for `::view-transition-group(lfaa-auth-scene)` and `::view-transition-old(lfaa-auth-scene)`. After `ViewTransition.ready`, the Renderer hides the real Workbench underneath and hides the new-scene snapshot until `finished`; only then does it reveal the page and reminders and release the animation contribution. Plugins must not override this constraint or reveal Workbench content early. The built-in animation creates no View Transition snapshot. The Workbench stays `visibility:hidden`, `aria-hidden`, and `inert` during its initial mount and the main animation; in the final 240ms it appears behind and cross-fades through the login overlay while remaining non-interactive. The Renderer removes the overlay and releases the Workbench gate only after that fade completes. If no plugin is selected or the selected plugin is unavailable, the built-in animation is used; an old selection remains stored so the user can choose again later.

## Lifecycle Example

The example shows how to register a contribution. The component renders only when the user has selected its ID.

```tsx
const slotName = "auth.transition";
const contributorId = "example-auth-scene/transition";

function TransitionContribution({ owner }: {
  owner: { phase: "preparing" | "entering"; reducedMotion: boolean };
}) {
  if (owner.phase !== "entering" || owner.reducedMotion) return null;
  return <style>{`
    ::view-transition-group(lfaa-auth-scene) {
      animation-duration: 1500ms;
      animation-timing-function: cubic-bezier(.55, .05, .2, 1);
    }
    ::view-transition-old(lfaa-auth-scene) { animation: example-auth-old 1500ms both; }
    @keyframes example-auth-old {
      0%, 14% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
      82% { opacity: .72; transform: translate3d(0, -1vh, 0) scale(.945); }
      100% { opacity: 0; transform: translate3d(0, -1.6vh, 0) scale(.9); }
    }
  `}</style>;
}

ctx.effect(() => ctx.slots.inject(slotName, () => ctx.slots.register(
  { name: slotName, id: contributorId, label: "Example · Enter Workbench" },
  TransitionContribution
)));
```

Production plugins must follow DSH's React, TypeScript, Slot, and lifecycle contracts. This example only shows the data LFAA passes to the contribution. Do not add user credentials or private LFAA state to the component owner.

## Settings and Fallback

- Setting path: `appearance.advanced.authTransitionPluginId`, shared default `builtin`.
- Reduced motion reuses `appearance.advanced.reducedMotion`: `on` skips animation, `system` follows the operating system, and `off` allows animation.
- When an old setting has no transition ID, only `builtin` is added. Existing theme, overlay, font, contrast, and other preferences stay unchanged.
- A new animation starts only after successful password, passkey, or first-time initialization authentication. Wrong passwords, failed recovery, and session restoration do not start it.
- The new Workbench scene and credential/setup reminders appear only after the selected transition fully completes. User plugins supply visuals only; they do not replace authentication, identity verification, or Permission Owner.
