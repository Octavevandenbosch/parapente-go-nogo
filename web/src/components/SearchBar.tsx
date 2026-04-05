import { useState } from "react";
import { Search, Loader2 } from "lucide-react";

interface SearchBarProps {
  onSearch: (query: string, radius: number) => void;
  isLoading: boolean;
}

export function SearchBar({ onSearch, isLoading }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [radius, setRadius] = useState(25);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) onSearch(query.trim(), radius);
  };

  return (
    <form onSubmit={handleSubmit} className="search-bar">
      <div className="search-input-group">
        <Search size={18} className="search-icon" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ville ou région (ex: Annecy, Millau...)"
          className="search-input"
          disabled={isLoading}
        />
      </div>
      <div className="search-radius">
        <label htmlFor="radius">Rayon</label>
        <select
          id="radius"
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
          disabled={isLoading}
        >
          <option value={10}>10 km</option>
          <option value={25}>25 km</option>
          <option value={50}>50 km</option>
          <option value={75}>75 km</option>
        </select>
      </div>
      <button type="submit" className="search-btn" disabled={isLoading || !query.trim()}>
        {isLoading ? <Loader2 size={18} className="spin" /> : "Rechercher"}
      </button>
    </form>
  );
}
