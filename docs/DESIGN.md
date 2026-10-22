# Design

Permit Control is one installed application with three compositions. Field portrait on rugged Windows tablets is the primary operating mode. Field landscape is a separate touch composition. Desktop and leadership screens are the expanded composition. All three share domain rules, SQLite, synchronization, routes, and permit workflow. Layout may change. Business logic does not fork. Rotation changes presentation only.

The visual language stays industrial: charcoal surfaces, an LCY red structural accent, semantic green, amber, and red, square geometry, and IBM Plex. Do not introduce rounded generic application styling, generic blue, purple, gradients, or glassmorphism.

Composition comes from width, orientation, and coarse versus fine pointer. It does not read a device model name.

- Field portrait: upright orientation, or a window at most 840px wide. One column, bottom navigation, large controls.
- Field landscape: a coarse pointer in landscape, or a fine pointer narrower than 1440px. Still touch. The extra width holds a summary, a second selection column, or a detail panel. It is not a stretched portrait form and it is not the desktop density.
- Desktop: a fine pointer at 1440px or wider. Persistent sidebar, higher density, several sections visible together.

## Portrait field experience

Portrait layout prioritizes touch, readability, simple navigation, large controls, and clear safety states. Data entry stays sparse. Nothing depends on hover. Targets do not require precise taps.

At field portrait:

- Remove the persistent desktop sidebar.
- Use a compact operations bar and a bottom bar: Home, Permits, New, More.
- Use one column for data entry.
- Do not scroll the page horizontally.
- Do not compress a desktop layout until it fits.
- Do not leave a wide data table unchanged and call it a field screen.

The Windows touch keyboard must leave the active field and the workflow actions reachable. The shell follows the visible viewport height. Focusing a field scrolls it into view. Rotation does not save, reload, or change the workflow step.

## Touch

Primary controls are at least 48px tall. Field actions such as Back, Continue, Save, and Suspend are about 52–56px tall, with space between neighbors. Checklist choices are the whole labeled row. A selected row shows a mark and the word SELECTED, not a color change alone.

## Forms

Portrait fields use a visible label above a large control. Placeholder text is never the only label. Prefer a structured choice over free text when the choice exists.

## Permit workflow

The six steps stay Scope, Hazards, Controls, Permit Details, Review, and Authorization. Desktop screens keep the horizontal step row. Field portrait and field landscape show the current step as `2 OF 6` and `HAZARDS`, with a compact progress mark. Portrait uses one column and a Back, Save Draft, and Continue footer. Landscape keeps those touch sizes and places a draft summary beside the form, with hazards and controls in two columns. All six full labels are not squeezed into one row on a tablet.

## Local save

Field users can see that work is stored on the device without seeing SQLite, paths, or sync internals.

- `SAVED LOCALLY · PENDING SYNC` after a local save while Plant Link is reachable. Pending is normal. The plant record has not accepted the permit.
- `SAVED LOCALLY · PLANT LINK OFFLINE` when that save is on the device and Plant Link is unreachable.
- `SYNCHRONIZED` only after the plant record has accepted the work.

Plant Link being unavailable does not mean the draft is unsaved. Plant Link being ready does not mean the draft was uploaded. `SYNCHRONIZED` appears only after the server has accepted `PERMIT_CREATED` and the permit number is stored on the device. The permit stays `DRAFT`. Drafts shows `DRAFT`, `SAVED LOCALLY`, and either `PENDING SYNC`, `NEEDS ATTENTION`, or `SYNCHRONIZED`.

## Plant Link

Loss of `permit-control.local` is normal field operation. Show it as Plant Link offline with local data available and the real outbox count, for example `3 CHANGES PENDING`. Do not treat that state as a critical alarm.

Local SQLite failure is a serious condition. It uses a stronger treatment than Plant Link offline, and it does not invent a pending count.

## Safety

Suspend stays a direct action on the permit, not an item buried in menus. The control is large, and the action is named, not signaled by red alone. Suspended and expired permits state `WORK NOT AUTHORIZED`. Lifecycle actions ask for confirmation before they run.

## Readings

Future atmospheric and other numeric entry uses large dedicated controls in portrait. The entry control uses a numeric input mode and the `.reading-entry` field size. Do not turn a paper-form table into the entry surface. History may stay compact. That entry surface is not implemented yet.

## What this pass establishes

The shell, New Permit, Drafts, Permit Detail, and the portrait Command Center follow the three compositions. Desktop keeps the sidebar and the denser register. This is not a separate tablet product and not a change to permit, sync, or Plant Link behavior.
