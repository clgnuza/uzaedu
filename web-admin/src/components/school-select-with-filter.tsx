'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

type SchoolItem = { id: string; name: string; city?: string | null; district?: string | null };

function schoolLabel(s: SchoolItem): string {
  const loc = [s.city, s.district].filter(Boolean).join(' / ');
  return loc ? `${s.name} (${loc})` : s.name;
}

interface SchoolSelectWithFilterProps {
  value: string;
  onChange: (schoolId: string) => void;
  token: string | null;
  disabled?: boolean;
  placeholder?: string;
  /** Düzenleme modunda: il/ilçe önceden doldurulsun (user.school'dan). */
  initialCity?: string | null;
  initialDistrict?: string | null;
}

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

  const selectCls =
    'w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 transition-colors';

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium mb-1.5">İl</label>
          <select
            value={city}
            onChange={(e) => handleCityChange(e.target.value)}
            disabled={disabled || loadingCities}
            className={selectCls}
          >
            <option value="">Tüm iller</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">İlçe</label>
          <select
            value={district}
            onChange={(e) => handleDistrictChange(e.target.value)}
            disabled={disabled || loadingDistricts || !city}
            className={selectCls}
          >
            <option value="">Tüm ilçeler</option>
            {districts.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">Okul</label>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || loadingSchools}
          className={selectCls}
        >
          <option value="">{placeholder}</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>{schoolLabel(s)}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
