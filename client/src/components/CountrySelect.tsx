import { useEffect, useMemo, useRef, useState } from "react";
import type { AfricanCountry } from "../data/africanCountries";
import { findCountryByName, flagEmoji } from "../data/africanCountries";

type Props = {
  id?: string;
  value: string;
  countries: AfricanCountry[];
  onChange: (countryName: string) => void;
};

function flagImageUrl(iso2: string): string {
  return `https://flagcdn.com/h24/${iso2.toLowerCase()}.png`;
}

function formatSelected(c: AfricanCountry): string {
  return `${c.name} (${c.dial})`;
}

export function CountrySelect({ id, value, countries, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => {
    const s = findCountryByName(value);
    return s ? formatSelected(s) : "";
  });
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevValueRef = useRef(value);

  const selected = findCountryByName(value);

  useEffect(() => {
    if (value !== prevValueRef.current) {
      prevValueRef.current = value;
      const s = findCountryByName(value);
      setText(s ? formatSelected(s) : "");
    }
  }, [value]);

  const filtered = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter((c) => {
      const name = c.name.toLowerCase();
      const dialDig = c.dial.replace(/\D/g, "");
      const qDig = q.replace(/\D/g, "");
      return (
        name.includes(q) ||
        (qDig.length > 0 && dialDig.includes(qDig)) ||
        c.iso2.toLowerCase() === q
      );
    });
  }, [countries, text]);

  useEffect(() => {
    setActiveIndex(0);
  }, [filtered]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const pickCountry = (c: AfricanCountry) => {
    onChange(c.name);
    setText(formatSelected(c));
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleInputChange = (t: string) => {
    setText(t);
    setOpen(true);
    if (value) {
      const s = findCountryByName(value);
      if (s && formatSelected(s) !== t) onChange("");
    }
  };

  const tryResolveExactNameOnBlur = () => {
    const q = text.trim().toLowerCase();
    if (!q) return;
    const exact = countries.find((c) => c.name.toLowerCase() === q);
    if (exact) pickCountry(exact);
  };

  const handleBlurInput = () => {
    window.setTimeout(() => {
      if (rootRef.current?.contains(document.activeElement)) return;
      setOpen(false);
      tryResolveExactNameOnBlur();
    }, 180);
  };

  const onKeyDownInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (filtered.length === 0) return;
      setOpen(true);
      setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (filtered.length === 0) return;
      setOpen(true);
      setActiveIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === "Enter") {
      if (open && filtered[activeIndex]) {
        e.preventDefault();
        pickCountry(filtered[activeIndex]);
      }
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
      const s = findCountryByName(value);
      if (s) setText(formatSelected(s));
      else setText("");
    }
  };

  const listId = id ? `${id}-country-list` : "country-select-list";

  return (
    <div className="register-country-custom" ref={rootRef}>
      <input type="hidden" value={value} required readOnly tabIndex={-1} aria-hidden />
      <div className="register-country-search-wrap">
        {selected && (
          <span className="register-country-flag-wrap register-country-flag-wrap--input">
            <img
              className="register-country-flag"
              src={flagImageUrl(selected.iso2)}
              alt=""
              width={32}
              height={24}
              decoding="async"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                const s = (e.target as HTMLImageElement).nextElementSibling;
                if (s) (s as HTMLElement).style.display = "inline";
              }}
            />
            <span className="register-country-flag-fallback" aria-hidden>
              {flagEmoji(selected.iso2)}
            </span>
          </span>
        )}
        <input
          ref={inputRef}
          type="text"
          id={id}
          className="register-country-input"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder="Type country name or dial code…"
          value={text}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={handleBlurInput}
          onKeyDown={onKeyDownInput}
        />
      </div>
      {open && filtered.length > 0 && (
        <ul className="register-country-dropdown" role="listbox" id={listId}>
          {filtered.map((c, idx) => (
            <li key={c.name} role="presentation">
              <button
                type="button"
                role="option"
                id={`${listId}-opt-${idx}`}
                aria-selected={value === c.name}
                className={`register-country-option${value === c.name ? " is-active" : ""}${idx === activeIndex ? " is-highlight" : ""}`}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => pickCountry(c)}
              >
                <span className="register-country-flag-wrap">
                  <img
                    className="register-country-flag"
                    src={flagImageUrl(c.iso2)}
                    alt=""
                    width={32}
                    height={24}
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                      const s = (e.target as HTMLImageElement).nextElementSibling;
                      if (s) (s as HTMLElement).style.display = "inline";
                    }}
                  />
                  <span className="register-country-flag-fallback" aria-hidden>
                    {flagEmoji(c.iso2)}
                  </span>
                </span>
                <span className="register-country-name">{c.name}</span>
                <span className="register-country-dial">{c.dial}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && filtered.length === 0 && text.trim().length > 0 && (
        <div className="register-country-empty" role="status">
          No match — try another spelling or dial code.
        </div>
      )}
    </div>
  );
}
