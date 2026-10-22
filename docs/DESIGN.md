# Design

Permit Control is one installed application with two presentation modes. Portrait use on Getac rugged field tablets is a primary operating mode, alongside desktop and leadership screens. The modes share domain rules, SQLite, synchronization, and permit workflow. Layout may change. Business logic does not fork.

The visual language stays industrial: charcoal surfaces, an LCY red structural accent, semantic green, amber, and red, square geometry, and IBM Plex. Do not introduce rounded generic application styling.

## Portrait field experience

Portrait layout prioritizes touch, readability, simple navigation, large controls, and clear safety states. Data entry stays sparse. Nothing depends on hover. Targets do not require precise taps.

At portrait-tablet widths:

- Hide the persistent desktop sidebar and open navigation with a touch control.
- Use one column for data entry.
- Do not scroll horizontally.
- Do not compress a desktop layout until it fits.
- Do not leave a wide data table unchanged and call it a field screen.

The field presentation applies when the viewport is at most 900px wide, and when the viewport is portrait and at most 1280px wide. Wider landscape screens keep the desktop presentation.

## Touch

Primary controls are at least 48px tall. Field actions such as Back, Continue, Save, and Suspend are about 52–56px tall, with space between neighbors. Checklist choices are the whole labeled row. A selected row shows a mark and the word SELECTED, not a color change alone.

## Forms

Portrait fields use a visible label above a large control. Placeholder text is never the only label. Prefer a structured choice over free text when the choice exists.

## Permit workflow

The six steps stay Scope, Hazards, Controls, Permit Details, Review, and Authorization. Desktop screens may keep the horizontal step row. Portrait screens show the current step as `2 OF 6` and `HAZARDS`, with a compact progress mark, and large Back and Continue actions in a persistent footer. All six full labels are not squeezed into one row.

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

Future atmospheric and other numeric entry uses large dedicated controls in portrait. Do not turn a paper-form table into the entry surface. History may stay compact. Entry must be built for touch. That entry surface is not implemented yet.

## What this pass establishes

New Permit, Drafts, workflow navigation, and the local-save line follow the field pattern. The rest of the shell keeps the existing desktop screens and gains the portrait navigation and Plant Link treatment. This is not a separate tablet product and not a full visual redesign.
