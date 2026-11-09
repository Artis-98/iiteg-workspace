import { useEffect } from "react";

/** Keeps the app pinned to the *visible* viewport.
 *
 *  Two things happen on iOS when a field is focused: the visual viewport
 *  shrinks for the keyboard, and the document is scrolled to reveal the field.
 *  Sizing to the first without cancelling the second is what threw the page off
 *  the top of the screen — the shell got shorter, which gave the document room
 *  to scroll, and iOS took it.
 *
 *  So publish both numbers. `--app-h` is the height that is actually visible,
 *  `--app-top` is however far iOS has shifted the visual viewport, which the
 *  shell translates by to cancel the shift out. */
export function useAppHeight() {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;

    // Scoped scroll lock: only the shell's own panes scroll while it is mounted.
    root.classList.add("ws-locked");

    const apply = () => {
      const h = Math.round(vv?.height ?? window.innerHeight);
      const top = Math.round(vv?.offsetTop ?? 0);
      root.style.setProperty("--app-h", `${h}px`);
      root.style.setProperty("--app-top", `${top}px`);
      // The shell is fixed, so any document scroll is iOS's doing, not ours.
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    };

    apply();
    vv?.addEventListener("resize", apply);
    vv?.addEventListener("scroll", apply);
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    window.addEventListener("scroll", apply, { passive: true });

    return () => {
      root.classList.remove("ws-locked");
      root.style.removeProperty("--app-top");
      vv?.removeEventListener("resize", apply);
      vv?.removeEventListener("scroll", apply);
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
      window.removeEventListener("scroll", apply);
    };
  }, []);
}
