// Ref callback for fields opened from a menu: `autoFocus` fires while the menu
// still holds focus and is lost when it closes, so focus on the next tick.
export function focusAfterMenu(el: HTMLInputElement | HTMLTextAreaElement | null) {
  if (!el) return;
  setTimeout(() => {
    el.focus();
    if (el instanceof HTMLInputElement) el.select();
  }, 0);
}
