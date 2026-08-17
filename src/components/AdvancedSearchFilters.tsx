import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { X, ChevronDown, Filter } from 'lucide-react';

interface Suggestion {
  name: string;
  usage_count: number;
}

export interface SearchFilters {
  skills: string[];
  software: string[];
  equipment: string[];
  processes: string[];
  matchMode: 'any' | 'all';
}

interface AdvancedSearchFiltersProps {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  defaultExpanded?: boolean;
}

export default function AdvancedSearchFilters({ filters, onChange, defaultExpanded = false }: AdvancedSearchFiltersProps) {
  const [showFilters, setShowFilters] = useState(defaultExpanded);
  const [activeCategory, setActiveCategory] = useState<'skills' | 'software' | 'equipment' | 'processes' | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveCategory(null);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!activeCategory || searchTerm.length < 1) {
        setSuggestions([]);
        return;
      }

      setLoading(true);
      try {
        const type = activeCategory === 'processes' ? 'process' : activeCategory.replace(/s$/, '');
        const { data, error } = await api.get('/api/expertise/suggestions', {
          type,
          search_term: searchTerm,
        });

        if (!error && data) {
          setSuggestions(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Error fetching suggestions:', err);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, activeCategory]);

  const handleAddFilter = (category: 'skills' | 'software' | 'equipment' | 'processes', value: string) => {
    if (!filters[category].includes(value)) {
      onChange({
        ...filters,
        [category]: [...filters[category], value],
      });
    }
    setSearchTerm('');
    setActiveCategory(null);
  };

  const handleRemoveFilter = (category: 'skills' | 'software' | 'equipment' | 'processes', value: string) => {
    onChange({
      ...filters,
      [category]: filters[category].filter((item) => item !== value),
    });
  };

  const handleClearAll = () => {
    onChange({
      skills: [],
      software: [],
      equipment: [],
      processes: [],
      matchMode: filters.matchMode,
    });
  };

  const totalFilters = filters.skills.length + filters.software.length +
                       filters.equipment.length + filters.processes.length;

  const renderFilterButton = (
    category: 'skills' | 'software' | 'equipment' | 'processes',
    label: string,
    icon: string
  ) => (
    <div className="relative" ref={activeCategory === category ? dropdownRef : null}>
      <button
        onClick={() => {
          setActiveCategory(activeCategory === category ? null : category);
          setSearchTerm('');
        }}
        className={`px-4 py-2 border rounded-lg flex items-center gap-2 transition ${
          filters[category].length > 0
            ? 'bg-blue-50 border-blue-300 text-blue-700'
            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
        }`}
      >
        <span>{icon}</span>
        <span className="font-medium">{label}</span>
        {filters[category].length > 0 && (
          <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
            {filters[category].length}
          </span>
        )}
        <ChevronDown className="w-4 h-4" />
      </button>

      {activeCategory === category && (
        <div className="absolute z-20 mt-2 w-80 bg-white border border-gray-300 rounded-lg shadow-lg">
          <div className="p-3 border-b border-gray-200">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}...`}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
          </div>

          {loading && (
            <div className="p-4 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          )}

          {!loading && suggestions.length > 0 && (
            <div className="max-h-60 overflow-y-auto">
              {suggestions.map((suggestion, index) => (
                <button
                  key={`${suggestion.name}-${index}`}
                  onClick={() => handleAddFilter(category, suggestion.name)}
                  disabled={filters[category].includes(suggestion.name)}
                  className={`w-full px-4 py-2 text-left hover:bg-blue-50 transition flex items-center justify-between ${
                    filters[category].includes(suggestion.name) ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <span className="text-gray-900">{suggestion.name}</span>
                  <span className="text-xs text-gray-500">
                    {suggestion.usage_count} {suggestion.usage_count === 1 ? 'user' : 'users'}
                  </span>
                </button>
              ))}
            </div>
          )}

          {!loading && searchTerm.length >= 1 && suggestions.length === 0 && (
            <div className="p-4 text-center text-gray-500 text-sm">
              No {label.toLowerCase()} found
            </div>
          )}

          {searchTerm.length < 1 && (
            <div className="p-4 text-center text-gray-500 text-sm">
              Type to search {label.toLowerCase()}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 transition"
        >
          <Filter className="w-5 h-5" />
          <span className="font-medium">Advanced Filters</span>
          {totalFilters > 0 && (
            <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
              {totalFilters}
            </span>
          )}
        </button>

        {totalFilters > 0 && (
          <button
            onClick={handleClearAll}
            className="text-sm text-gray-600 hover:text-gray-900 underline"
          >
            Clear all filters
          </button>
        )}
      </div>

      {showFilters && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-4 border border-gray-200">
          <div className="flex flex-wrap gap-3">
            {renderFilterButton('skills', 'Skills', '🎯')}
            {renderFilterButton('software', 'Software', '💻')}
            {renderFilterButton('equipment', 'Equipment', '🔧')}
            {renderFilterButton('processes', 'Processes', '⚙️')}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 font-medium">Match mode:</span>
            <div className="flex gap-2">
              <button
                onClick={() => onChange({ ...filters, matchMode: 'any' })}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                  filters.matchMode === 'any'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Any match
              </button>
              <button
                onClick={() => onChange({ ...filters, matchMode: 'all' })}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                  filters.matchMode === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                All match
              </button>
            </div>
          </div>

          {totalFilters > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">Active filters:</div>
              <div className="flex flex-wrap gap-2">
                {filters.skills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                  >
                    <span>🎯</span>
                    <span>{skill}</span>
                    <button
                      onClick={() => handleRemoveFilter('skills', skill)}
                      className="hover:bg-blue-200 rounded-full p-0.5 transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {filters.software.map((sw) => (
                  <span
                    key={sw}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
                  >
                    <span>💻</span>
                    <span>{sw}</span>
                    <button
                      onClick={() => handleRemoveFilter('software', sw)}
                      className="hover:bg-green-200 rounded-full p-0.5 transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {filters.equipment.map((eq) => (
                  <span
                    key={eq}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm"
                  >
                    <span>🔧</span>
                    <span>{eq}</span>
                    <button
                      onClick={() => handleRemoveFilter('equipment', eq)}
                      className="hover:bg-orange-200 rounded-full p-0.5 transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {filters.processes.map((proc) => (
                  <span
                    key={proc}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-cyan-100 text-cyan-800 rounded-full text-sm"
                  >
                    <span>⚙️</span>
                    <span>{proc}</span>
                    <button
                      onClick={() => handleRemoveFilter('processes', proc)}
                      className="hover:bg-cyan-200 rounded-full p-0.5 transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
