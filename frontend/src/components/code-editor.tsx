"use client";

import CodeMirror from "@uiw/react-codemirror";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";

function languageFor(path: string) {
  const extension = path.split(".").pop()?.toLowerCase();
  if (extension === "py") return python();
  if (["js", "jsx", "mjs", "cjs"].includes(extension || "")) return javascript({ jsx: true });
  if (["ts", "tsx"].includes(extension || "")) return javascript({ jsx: true, typescript: true });
  if (extension === "json") return json();
  if (["html", "htm", "vue"].includes(extension || "")) return html();
  if (["css", "scss", "less"].includes(extension || "")) return css();
  return [];
}

export default function NovaCodeEditor({
  path,
  value,
  onChange,
}: {
  path: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <CodeMirror
      value={value}
      height="620px"
      theme={oneDark}
      extensions={[languageFor(path), EditorView.lineWrapping]}
      onChange={onChange}
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        highlightActiveLine: true,
        highlightSelectionMatches: true,
        bracketMatching: true,
        closeBrackets: true,
        autocompletion: true,
        indentOnInput: true,
      }}
    />
  );
}
