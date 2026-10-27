let stage: HTMLElement | null = null;

export function bindStage(element: HTMLElement | null) {
  stage = element;
}

export function readStageScroll(): number {
  return stage?.scrollTop ?? 0;
}

/** Apply a saved list position once content has height. Two frames, then stop. */
export function restoreStageScroll(element: HTMLElement, position: number) {
  let frames = 0;
  const apply = () => {
    if (frames > 1) return;
    frames += 1;
    element.scrollTop = position;
    if (frames === 1 && position > 0 && element.scrollTop + 8 < position) requestAnimationFrame(apply);
  };
  requestAnimationFrame(apply);
}
