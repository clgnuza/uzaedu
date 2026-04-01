'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface SelectContextValue {
  value: string;
  onValueChange: (v: string) => void;
  placeholder?: string;
}

const SelectContext = React.createContext<SelectContextValue | null>(null);

function useSelectContext() {
  const ctx = React.useContext(SelectContext);
  if (!ctx) throw new Error('Select components must be used within Select');
  return ctx;
}

function extractFromChildren(children: React.ReactNode): {
  items: Array<{ value: string; label: string }>;
  placeholder: string;
  triggerClassName: string;
  triggerId?: string;
} {
  const items: Array<{ value: string; label: string }> = [];
  let placeholder = '';
  let triggerClassName = '';
  let triggerId: string | undefined;
  function walk(nodes: React.ReactNode) {
    React.Children.forEach(nodes, (node) => {
      if (React.isValidElement(node)) {
        const n = node as React.ReactElement<{ value?: string; placeholder?: string; className?: string; id?: string; children?: React.ReactNode }>;
        if (n.props?.value !== undefined && typeof n.props.value === 'string') {
          items.push({
            value: n.props.value,
            label: typeof n.props.children === 'string' ? n.props.children : String(n.props.children ?? ''),
          });
        } else if (n.props?.placeholder) {
          placeholder = String(n.props.placeholder);
        } else if (n.type === SelectTrigger) {
          if (n.props?.className) triggerClassName = n.props.className;
          if (n.props?.id) triggerId = String(n.props.id);
        }
        if (n.props?.children) walk(n.props.children);
      }
    });
  }
  walk(children);
  return { items, placeholder, triggerClassName, triggerId };
}

interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}

export function SelectTrigger({ className, id }: { className?: string; id?: string; children?: React.ReactNode }) {
  return null;
}

export function Select({ value = '', onValueChange, disabled, children }: SelectProps) {
  const { items, placeholder, triggerClassName, triggerId } = extractFromChildren(children);

  return (
    <SelectContext.Provider value={{ value, onValueChange: onValueChange ?? (() => {}), placeholder }}>
      <div className="w-full min-w-0">
        <select
          id={triggerId}
          value={value}
          onChange={(e) => onValueChange?.(e.target.value)}
          disabled={disabled}
          className={cn(
            'flex h-10 w-full appearance-none rounded-lg border border-input bg-background px-4 py-2 pr-8 text-sm text-foreground transition-all duration-200',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-primary/30',
            'hover:border-muted-foreground/30',
            'disabled:cursor-not-allowed disabled:opacity-50',
            triggerClassName,
          )}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 0.5rem center',
        }}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
        </select>
      </div>
    </SelectContext.Provider>
  );
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  return null;
}

export function SelectContent({ children, className }: { children?: React.ReactNode; className?: string }) {
  return null;
}

export function SelectItem({ value, children }: { value: string; children?: React.ReactNode }) {
  return null;
}