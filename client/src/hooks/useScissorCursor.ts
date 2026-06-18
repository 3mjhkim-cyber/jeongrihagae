import { useEffect } from "react";

export function useScissorCursor() {
  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return;

    // Create cursor element
    const cursor = document.createElement("div");
    cursor.id = "scissor-cursor";
    cursor.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 99999;
      left: 0;
      top: 0;
      width: 36px;
      height: 36px;
    `;

    cursor.innerHTML = `
      <svg width="36" height="36" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g id="bladeTop" style="transform-origin: 22px 26px; transform: rotate(-14deg);">
          <line x1="22" y1="26" x2="38" y2="6" stroke="#3B5BDB" stroke-width="2.5" stroke-linecap="round"/>
          <circle cx="12" cy="36" r="5" stroke="#3B5BDB" stroke-width="2.5"/>
          <circle cx="12" cy="36" r="2" fill="#3B5BDB"/>
          <line x1="22" y1="26" x2="12" y2="36" stroke="#3B5BDB" stroke-width="2.5" stroke-linecap="round"/>
        </g>
        <g id="bladeBottom" style="transform-origin: 22px 26px; transform: rotate(14deg);">
          <line x1="22" y1="26" x2="6" y2="6" stroke="#3B5BDB" stroke-width="2.5" stroke-linecap="round"/>
          <circle cx="32" cy="36" r="5" stroke="#3B5BDB" stroke-width="2.5"/>
          <circle cx="32" cy="36" r="2" fill="#3B5BDB"/>
          <line x1="22" y1="26" x2="32" y2="36" stroke="#3B5BDB" stroke-width="2.5" stroke-linecap="round"/>
        </g>
      </svg>
    `;

    document.body.appendChild(cursor);

    const bladeTop = cursor.querySelector<SVGGElement>("#bladeTop");
    const bladeBottom = cursor.querySelector<SVGGElement>("#bladeBottom");

    let animating = false;

    const onMouseMove = (e: MouseEvent) => {
      cursor.style.left = `${e.clientX - 22}px`;
      cursor.style.top = `${e.clientY - 8}px`;
    };

    const onMouseDown = () => {
      if (animating || !bladeTop || !bladeBottom) return;
      animating = true;

      const duration = 300;
      const start = performance.now();

      const animate = (now: number) => {
        const t = Math.min((now - start) / duration, 1);
        // sin curve: 0 → π gives 0→1→0 arc
        const progress = Math.sin(t * Math.PI);
        const topAngle = -14 + 14 * progress; // -14 → 0 → -14
        const bottomAngle = 14 - 14 * progress; // 14 → 0 → 14

        bladeTop.style.transform = `rotate(${topAngle}deg)`;
        bladeBottom.style.transform = `rotate(${bottomAngle}deg)`;

        if (t < 1) {
          requestAnimationFrame(animate);
        } else {
          bladeTop.style.transform = "rotate(-14deg)";
          bladeBottom.style.transform = "rotate(14deg)";
          animating = false;
        }
      };

      requestAnimationFrame(animate);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mousedown", onMouseDown);

    // Hide default cursor globally
    const style = document.createElement("style");
    style.id = "scissor-cursor-style";
    style.textContent = "*, *::before, *::after { cursor: none !important; }";
    document.head.appendChild(style);

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mousedown", onMouseDown);
      cursor.remove();
      style.remove();
    };
  }, []);
}
