import { EditorView } from "@codemirror/view";

export const editorTheme = EditorView.theme({
  "&": {
    fontSize: "14px",
    backgroundColor: "transparent",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    borderRight: "none",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
  },
  ".cm-focused .cm-cursor": {
    borderLeftColor: "var(--color-accent, #6d9eff)",
  },
  ".cm-focused": {
    outline: "none",
  },
});
