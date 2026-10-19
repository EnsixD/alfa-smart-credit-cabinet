let locks = 0;
let previousOverflow = "";
let previousPadding = "";

/** Preserve the content width when an overlay removes the document scrollbar. */
export function lockScroll() {
  if (locks++ === 0) {
    previousOverflow = document.body.style.overflow;
    previousPadding = document.body.style.paddingRight;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    const padding =
      parseFloat(getComputedStyle(document.body).paddingRight) || 0;
    document.body.style.paddingRight = `${padding + gap}px`;
    document.body.style.overflow = "hidden";
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--locks === 0) {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPadding;
    }
  };
}
