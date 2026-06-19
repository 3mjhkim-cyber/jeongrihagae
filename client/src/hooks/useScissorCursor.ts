import { useEffect } from "react";

export function useScissorCursor() {
  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const cursor = document.createElement("div");
    cursor.id = "paw-cursor";
    cursor.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 99999;
      left: 0;
      top: 0;
      width: 36px;
      height: 36px;
      transition: transform 0.1s ease;
    `;

    // Paw print SVG (main pad + 4 toe beans)
    cursor.innerHTML = `
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- toe beans -->
        <ellipse cx="8"  cy="11" rx="3.8" ry="3"   fill="#3B5BDB" opacity="0.85"/>
        <ellipse cx="16" cy="8"  rx="3.8" ry="3"   fill="#3B5BDB" opacity="0.85"/>
        <ellipse cx="24" cy="9"  rx="3.8" ry="3"   fill="#3B5BDB" opacity="0.85"/>
        <ellipse cx="30" cy="14" rx="3"   ry="3.8" fill="#3B5BDB" opacity="0.85"/>
        <!-- main pad -->
        <path d="M7 22 Q6 14 14 16 Q18 17 22 16 Q30 14 29 22 Q28 30 18 31 Q8 30 7 22Z" fill="#3B5BDB"/>
      </svg>
    `;

    document.body.appendChild(cursor);

    const onMouseMove = (e: MouseEvent) => {
      cursor.style.left = `${e.clientX - 18}px`;
      cursor.style.top = `${e.clientY - 18}px`;
    };

    const onMouseDown = () => {
      cursor.style.transform = "scale(0.78)";
    };

    const onMouseUp = () => {
      cursor.style.transform = "scale(1)";
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mouseup", onMouseUp);

    const style = document.createElement("style");
    style.id = "paw-cursor-style";
    style.textContent = "*, *::before, *::after { cursor: none !important; }";
    document.head.appendChild(style);

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mouseup", onMouseUp);
      cursor.remove();
      style.remove();
    };
  }, []);
}
