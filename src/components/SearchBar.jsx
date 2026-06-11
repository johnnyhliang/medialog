export default function SearchBar({ value, onChange }) {
  return (
    <input
      type="search"
      placeholder="Search entries…"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
