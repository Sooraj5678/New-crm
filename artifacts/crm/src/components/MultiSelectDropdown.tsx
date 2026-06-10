import { useState, useRef, useEffect } from "react";
import { ChevronDown, X, Check, Search, Plus } from "lucide-react";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectDropdownProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  onAddNew?: (name: string) => void;
  addNewLabel?: string;
  className?: string;
  maxWidth?: string;
}

export function MultiSelectDropdown({
  options,
  selected,
  onChange,
  placeholder = "All",
  searchPlaceholder = "Search...",
  onAddNew,
  addNewLabel = "Add new",
  className = "",
  maxWidth = "w-48",
}: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [showAddNew, setShowAddNew] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
        setShowAddNew(false);
        setNewName("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase()),
  );

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const removeTag = (value: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selected.filter(v => v !== value));
  };

  const handleAddNew = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    onAddNew?.(trimmed);
    setNewName("");
    setShowAddNew(false);
    setSearch("");
  };

  const selectedLabels = selected.map(v => options.find(o => o.value === v)?.label ?? v);

  return (
    <div ref={ref} className={`relative ${maxWidth} ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-1.5 px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring min-h-[38px]"
      >
        <div className="flex flex-wrap gap-1 flex-1 min-w-0">
          {selected.length === 0 ? (
            <span className="text-muted-foreground truncate">{placeholder}</span>
          ) : (
            selected.map((v, i) => (
              <span
                key={v}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium"
              >
                {selectedLabels[i]}
                <button
                  type="button"
                  onClick={e => removeTag(v, e)}
                  className="hover:text-destructive transition-colors"
                >
                  <X size={10} />
                </button>
              </span>
            ))
          )}
        </div>
        <ChevronDown size={14} className={`shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 w-56 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-7 pr-3 py-1.5 text-xs rounded border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 && !onAddNew && (
              <p className="text-xs text-muted-foreground text-center py-4">No options found</p>
            )}
            {filtered.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => toggle(option.value)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors text-left"
              >
                <span className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center ${selected.includes(option.value) ? "bg-primary border-primary" : "border-input"}`}>
                  {selected.includes(option.value) && <Check size={10} className="text-primary-foreground" />}
                </span>
                <span className="truncate">{option.label}</span>
              </button>
            ))}
          </div>

          {onAddNew && (
            <div className="border-t border-border p-2">
              {showAddNew ? (
                <div className="flex gap-1.5">
                  <input
                    autoFocus
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddNew(); } if (e.key === "Escape") { setShowAddNew(false); setNewName(""); } }}
                    placeholder="Enter name..."
                    className="flex-1 min-w-0 px-2 py-1.5 text-xs rounded border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={handleAddNew}
                    disabled={!newName.trim()}
                    className="px-2 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 hover:bg-primary/90"
                  >
                    Add
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddNew(true)}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs text-primary font-medium hover:bg-primary/5 rounded transition-colors"
                >
                  <Plus size={12} /> {addNewLabel}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
