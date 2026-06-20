import { useState, useRef, useEffect } from 'react'
import {
  BookOpen, Book, BookMarked, Newspaper, FileText, ScrollText,
  Film, Clapperboard, Tv, Video, PlaySquare,
  Music, Headphones, Radio, Mic,
  Code, Terminal, Cpu, Globe, Layers,
  Gamepad2, Puzzle, Trophy,
  Camera, Image, Palette, Pen,
  GraduationCap, FlaskConical, Microscope, Atom,
  Heart, Star, Bookmark, Tag, Folder,
  Briefcase, Building, ShoppingBag,
  Plane, Map, Compass,
  Dumbbell, Apple, Coffee,
  Sun, Moon, Leaf, Sprout,
  MessageCircle, Users, Lightbulb,
  Smile,
} from 'lucide-react'
import { updateTopicIcon } from '../lib/db/topics.js'

const ICON_MAP = {
  BookOpen, Book, BookMarked, Newspaper, FileText, ScrollText,
  Film, Clapperboard, Tv, Video, PlaySquare,
  Music, Headphones, Radio, Mic,
  Code, Terminal, Cpu, Globe, Layers,
  Gamepad2, Puzzle, Trophy,
  Camera, Image, Palette, Pen,
  GraduationCap, FlaskConical, Microscope, Atom,
  Heart, Star, Bookmark, Tag, Folder,
  Briefcase, Building, ShoppingBag,
  Plane, Map, Compass,
  Dumbbell, Apple, Coffee,
  Sun, Moon, Leaf, Sprout,
  MessageCircle, Users, Lightbulb,
}

const ICON_OPTIONS = Object.keys(ICON_MAP)

function IconPickerPopover({ currentIcon, onSelect, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  return (
    <div className="icon-picker-popover" ref={ref}>
      <div className="icon-picker-grid">
        {currentIcon && (
          <button
            className="icon-picker-item icon-picker-clear"
            title="Remove icon"
            onClick={() => onSelect(null)}
          >
            ✕
          </button>
        )}
        {ICON_OPTIONS.map((name) => {
          const Icon = ICON_MAP[name]
          return (
            <button
              key={name}
              className={`icon-picker-item${currentIcon === name ? ' active' : ''}`}
              title={name}
              onClick={() => onSelect(name)}
            >
              <Icon size={18} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function TopicsGrid({ topics, onSelectTopic, onTopicIconChange, supabase }) {
  const sorted = [...topics].sort((a, b) => a.name.localeCompare(b.name))
  const [pickingIconFor, setPickingIconFor] = useState(null)

  if (sorted.length === 0) {
    return <p className="muted topics-grid-empty">No topics yet — create one in the sidebar</p>
  }

  async function handleIconSelect(topic, iconName) {
    setPickingIconFor(null)
    if (!supabase) return
    try {
      await updateTopicIcon(supabase, topic.id, iconName)
      onTopicIconChange?.(topic.id, iconName)
    } catch (e) {
      console.error('Failed to save icon', e)
    }
  }

  return (
    <div className="topics-grid">
      {sorted.map((t) => {
        const Icon = t.icon ? ICON_MAP[t.icon] : null
        const isPicking = pickingIconFor === t.id
        return (
          <div key={t.id} className="topics-grid-card-wrap">
            <button
              className="topics-grid-card"
              onClick={() => onSelectTopic(t)}
            >
              <span className="topics-grid-icon-area">
                {Icon
                  ? <Icon size={22} strokeWidth={1.6} className="topics-grid-icon" />
                  : <span className="topics-grid-icon-placeholder" />
                }
              </span>
              <span className="topics-grid-name">{t.name}</span>
              {t.entry_count != null && (
                <span className="topics-grid-count">{t.entry_count}</span>
              )}
            </button>
            <button
              className={`topics-grid-icon-btn${isPicking ? ' active' : ''}`}
              title="Set icon"
              onClick={(e) => {
                e.stopPropagation()
                setPickingIconFor(isPicking ? null : t.id)
              }}
            >
              <Smile size={13} />
            </button>
            {isPicking && (
              <IconPickerPopover
                currentIcon={t.icon}
                onSelect={(iconName) => handleIconSelect(t, iconName)}
                onClose={() => setPickingIconFor(null)}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
