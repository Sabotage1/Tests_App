"use client";

import { useEffect } from "react";

const MIN_LIST_HEIGHT = 360;

export function QuestionListHeightSync() {
  useEffect(() => {
    const editorPanel = document.getElementById("question-editor");
    const listPanel = document.getElementById("question-list-panel");

    if (!editorPanel || !listPanel) {
      return;
    }

    let frameId = 0;

    const syncHeights = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        const editorHeight = Math.max(MIN_LIST_HEIGHT, Math.round(editorPanel.getBoundingClientRect().height));
        listPanel.style.setProperty("--question-list-max-height", `${editorHeight}px`);
      });
    };

    syncHeights();

    const resizeObserver = new ResizeObserver(syncHeights);
    resizeObserver.observe(editorPanel);
    window.addEventListener("resize", syncHeights);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener("resize", syncHeights);
    };
  }, []);

  return null;
}
