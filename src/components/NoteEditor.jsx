import CodeMirror from '@uiw/react-codemirror'
import { markdown, markdownLanguage, insertNewlineContinueMarkup, deleteMarkupBackward } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { keymap } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
import { Prec } from '@codemirror/state'

// Markdown editor: list/checkbox continuation on Enter, smart backspace,
// Tab indent. basicSetup provides Ctrl+F search + undo history.
const mdKeymap = Prec.high(
  keymap.of([
    { key: 'Enter', run: insertNewlineContinueMarkup },
    { key: 'Backspace', run: deleteMarkupBackward },
    indentWithTab,
  ]),
)

export default function NoteEditor({ value, onChange }) {
  return (
    <CodeMirror
      value={value}
      theme="dark"
      extensions={[markdown({ base: markdownLanguage, codeLanguages: languages }), mdKeymap]}
      onChange={onChange}
      basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false }}
    />
  )
}
