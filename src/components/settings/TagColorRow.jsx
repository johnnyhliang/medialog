import { useRef } from 'react'
import { Check, Palette, X } from 'lucide-react'

// Basic + pastel presets, paired so preset[i] and preset[i+8] are the same
// hue at two saturations — picking a color should be one click, not a native
// OS picker for something this ordinary.
const PRESETS = [
  '#E5484D', '#F76B15', '#F5B429', '#46A758', '#3B82F6', '#8B5CF6', '#EC4899', '#8A8477',
  '#FBD5D5', '#FDDCC0', '#FDF0C6', '#D3F0D8', '#DBEAFE', '#EDE9FE', '#FCE1EE', '#E4E1D8',
]

// One tag's row: name chip, preset swatches, a custom-color button (a real
// button, not a bare native <input type="color"> sitting in the layout), and
// a clear action. The native input still does the actual color picking for
// "custom" — it's just hidden behind a styled trigger instead of being the
// trigger itself.
export default function TagColorRow({ tag, onUpdateTagColor }) {
  const customInputRef = useRef(null)
  const current = tag.color || null

  return (
    <div className="tag-color-row">
      <span className="tag-color-chip" style={{ background: current || 'var(--surface-3)' }}>
        #{tag.name}
      </span>

      <div className="tag-color-swatches">
        {PRESETS.map((hex) => (
          <button
            key={hex}
            type="button"
            className={`tag-color-swatch ${current?.toLowerCase() === hex.toLowerCase() ? 'active' : ''}`}
            style={{ background: hex }}
            title={hex}
            onClick={() => onUpdateTagColor(tag.name, hex)}
          >
            {current?.toLowerCase() === hex.toLowerCase() && <Check size={11} strokeWidth={3} />}
          </button>
        ))}

        <button
          type="button"
          className={`tag-color-swatch tag-color-swatch--custom ${current && !PRESETS.some((h) => h.toLowerCase() === current.toLowerCase()) ? 'active' : ''}`}
          title="Custom color"
          onClick={() => customInputRef.current?.click()}
        >
          <Palette size={12} />
        </button>
        <input
          ref={customInputRef}
          type="color"
          className="tag-color-native-input"
          value={current ?? '#e8e3d8'}
          onChange={(e) => onUpdateTagColor(tag.name, e.target.value)}
          tabIndex={-1}
        />
      </div>

      <button
        type="button"
        className="tag-color-clear"
        title="Reset to default"
        onClick={() => onUpdateTagColor(tag.name, null)}
        disabled={!current}
      >
        <X size={12} />
      </button>
    </div>
  )
}
