'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

type SchoolItem = { id: string; name: string; city?: string | null; district?: string | null };

function schoolLabel(s: SchoolItem): string {
  const loc = [s.city, s.district].filter(Boolean).join(' / ');
  return loc ? `${s.name} (${loc})` : s.name;
}

type PickerKind = 'city' | 'district' | 'school' | null;

function MobilePickerSheet({
  open,
  title,
  onClose,
  children,
  search,
  onSearchChange,
  showSearch,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  search: string;
  onSearchChange: (v: string) => void;
  showSearch: boolean;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onEscape = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onEscape);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!mounted || typeof document === 'undefined' || !open) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-60 bg-black/45 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="school-picker-title"
        className="fixed inset-x-0 bottom-0 z-61 flex max-h-[min(88dvh,640px)] flex-col rounded-t-2xl border border-border/80 bg-background shadow-[0_-12px_40px_rgba(0,0,0,0.18)] dark:shadow-[0_-12px_40px_rgba(0,0,0,0.45)]"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex shrink-0 flex-col items-center border-b border-border/60 bg-muted/10 pt-2">
          <span className="mb-2 h-1 w-10 rounded-full bg-muted-foreground/30" aria-hidden />
          <div className="flex w-full items-center justify-between gap-2 px-4 pb-3">
            <h2 id="school-picker-title" className="min-w-0 flex-1 text-base font-semibold tracking-tight text-foreground">
              {title}
            </h2>
            <button
              type="button"
              className="shrink-0 rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={onClose}
              aria-label="Kapat"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>
        {showSearch && (
          <div className="shrink-0 border-b border-border/50 bg-background px-3 py-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Ara…"
                className="h-10 w-full rounded-xl border border-input bg-muted/30 py-2 pl-9 pr-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                autoComplete="off"
                autoCorrect="off"
              />
            </div>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2 [-webkit-overflow-scrolling:touch]">
          {children}
        </div>
      </div>
    </>,
    document.body,
  );
}

interface SchoolSelectWithFilterProps {
  value: string;
  onChange: (schoolId: string) => void;
  token: string | null;
  disabled?: boolean;
  placeholder?: string;
  initialCity?: string | null;
  initialDistrict?: string | null;
}

const selectCls =
  'w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 transition-colors';

const mobileTriggerCls = cn(
  'flex w-full items-center justify-between gap-2 rounded-xl border border-input bg-background px-3.5 py-3 text-left text-sm shadow-sm transition-colors',
  'active:bg-muted/50',
);

export function SchoolSelectWithFilter({
  value,
  onChange,
  token,
  disabled,
  placeholder = 'Okul seçin',
  initialCity: initialCityProp,
  initialDistrict: initialDistrictProp,
}: SchoolSelectWithFilterProps) {
  const [cities, setCities] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [schools, setSchools] = useState<SchoolItem[]>([]);
  const [city, setCity] = useState(initialCityProp ?? '');
  const [district, setDistrict] = useState(initialDistrictProp ?? '');
  const [loadingCities, setLoadingCities] = useState(true);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingSchools, setLoadingSchools] = useState(false);

  const [picker, setPicker] = useState<PickerKind>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!picker) setSearch('');
  }, [picker]);

  useEffect(() => {
    apiFetch<string[]>('school-reviews-public/cities')
      .then(setCities)
      .catch(() => setCities([]))
      .finally(() => setLoadingCities(false));
  }, []);

  useEffect(() => {
    if (!city?.trim()) {
      setDistricts([]);
      setDistrict('');
      setLoadingDistricts(false);
      return;
    }
    setLoadingDistricts(true);
    apiFetch<string[]>(`school-reviews-public/districts?city=${encodeURIComponent(city)}`)
      .then(setDistricts)
      .catch(() => setDistricts([]))
      .finally(() => setLoadingDistricts(false));
    setDistrict('');
  }, [city]);

  const fetchSchools = useCallback(async () => {
    if (!token) {
      setSchools([]);
      return;
    }
    setLoadingSchools(true);
    const params = new URLSearchParams();
    params.set('limit', '100');
    if (city?.trim()) params.set('city', city.trim());
    if (district?.trim()) params.set('district', district.trim());
    try {
      const res = await apiFetch<{ items: SchoolItem[] }>(`schools?${params.toString()}`, { token });
      setSchools(Array.isArray(res?.items) ? res.items : []);
    } catch {
      setSchools([]);
    } finally {
      setLoadingSchools(false);
    }
  }, [token, city, district]);

  useEffect(() => {
    setCity((prev) => (initialCityProp != null ? initialCityProp : prev));
    setDistrict((prev) => (initialDistrictProp != null ? initialDistrictProp : prev));
  }, [initialCityProp, initialDistrictProp]);

  useEffect(() => {
    fetchSchools();
  }, [fetchSchools]);

  const handleCityChange = (v: string) => {
    setCity(v);
    setDistrict('');
    onChange('');
  };
  const handleDistrictChange = (v: string) => {
    setDistrict(v);
    onChange('');
  };

  const selectedSchool = useMemo(() => schools.find((s) => s.id === value), [schools, value]);

  const filteredCities = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cities;
    return cities.filter((c) => c.toLowerCase().includes(q));
  }, [cities, search]);

  const filteredDistricts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return districts;
    return districts.filter((d) => d.toLowerCase().includes(q));
  }, [districts, search]);

  const filteredSchools = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return schools;
    return schools.filter((s) => schoolLabel(s).toLowerCase().includes(q));
  }, [schools, search]);

  const listRow = (active: boolean) =>
    cn(
      'mb-1.5 w-full rounded-xl border px-3.5 py-3 text-left text-sm transition-colors last:mb-0',
      active
        ? 'border-primary/50 bg-primary/10 font-medium text-foreground ring-1 ring-primary/25'
        : 'border-border/60 bg-card text-foreground hover:bg-muted/60 active:bg-muted',
    );

  const closePicker = () => setPicker(null);

  return (
    <div className="space-y-3">
      {/* Masaüstü: native select */}
      <div className="hidden md:block">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium">İl</label>
            <select
              value={city}
              onChange={(e) => handleCityChange(e.target.value)}
              disabled={disabled || loadingCities}
              className={selectCls}
            >
              <option value="">Tüm iller</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">İlçe</label>
            <select
              value={district}
              onChange={(e) => handleDistrictChange(e.target.value)}
              disabled={disabled || loadingDistricts || !city}
              className={selectCls}
            >
              <option value="">Tüm ilçeler</option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1.5 mt-3 block text-sm font-medium">Okul</label>
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled || loadingSchools}
            className={selectCls}
          >
            <option value="">{placeholder}</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {schoolLabel(s)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Mobil: tetikleyici + alt panel liste */}
      <div className="space-y-2 md:hidden">
        <div>
          <span className="mb-1 block text-xs font-medium text-muted-foreground">İl</span>
          <button
            type="button"
            disabled={disabled || loadingCities}
            className={mobileTriggerCls}
            onClick={() => setPicker('city')}
          >
            <span className="min-w-0 flex-1 truncate">{city || 'Tüm iller'}</span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        </div>
        <div>
          <span className="mb-1 block text-xs font-medium text-muted-foreground">İlçe</span>
          <button
            type="button"
            disabled={disabled || loadingDistricts || !city}
            className={mobileTriggerCls}
            onClick={() => city && setPicker('district')}
          >
            <span className="min-w-0 flex-1 truncate">
              {!city ? 'Önce il seçin' : loadingDistricts ? 'Yükleniyor…' : district || 'Tüm ilçeler'}
            </span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        </div>
        <div>
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Okul</span>
          <button
            type="button"
            disabled={disabled || loadingSchools}
            className={mobileTriggerCls}
            onClick={() => setPicker('school')}
          >
            <span className="min-w-0 flex-1 truncate">
              {loadingSchools ? 'Yükleniyor…' : selectedSchool ? schoolLabel(selectedSchool) : placeholder}
            </span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        </div>
      </div>

      <MobilePickerSheet
        open={picker === 'city'}
        title="İl seçin"
        onClose={closePicker}
        search={search}
        onSearchChange={setSearch}
        showSearch
      >
        <button type="button" className={listRow(!city)} onClick={() => { handleCityChange(''); closePicker(); }}>
          Tüm iller
        </button>
        {filteredCities.map((c) => (
          <button
            key={c}
            type="button"
            className={listRow(city === c)}
            onClick={() => {
              handleCityChange(c);
              closePicker();
            }}
          >
            {c}
          </button>
        ))}
      </MobilePickerSheet>

      <MobilePickerSheet
        open={picker === 'district'}
        title="İlçe seçin"
        onClose={closePicker}
        search={search}
        onSearchChange={setSearch}
        showSearch
      >
        <button
          type="button"
          className={listRow(!district)}
          onClick={() => {
            handleDistrictChange('');
            closePicker();
          }}
        >
          Tüm ilçeler
        </button>
        {filteredDistricts.map((d) => (
          <button
            key={d}
            type="button"
            className={listRow(district === d)}
            onClick={() => {
              handleDistrictChange(d);
              closePicker();
            }}
          >
            {d}
          </button>
        ))}
      </MobilePickerSheet>

      <MobilePickerSheet
        open={picker === 'school'}
        title="Okul seçin"
        onClose={closePicker}
        search={search}
        onSearchChange={setSearch}
        showSearch
      >
        <button
          type="button"
          className={listRow(!value)}
          onClick={() => {
            onChange('');
            closePicker();
          }}
        >
          {placeholder}
        </button>
        {filteredSchools.map((s) => (
          <button
            key={s.id}
            type="button"
            className={listRow(value === s.id)}
            onClick={() => {
              onChange(s.id);
              closePicker();
            }}
          >
            {schoolLabel(s)}
          </button>
        ))}
      </MobilePickerSheet>
    </div>
  );
}
