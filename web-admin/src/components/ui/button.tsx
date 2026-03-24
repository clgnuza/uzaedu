import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  asChild?: boolean;
}

const buttonStyles = {
  base: 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  variant: {
    default: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow',
    destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
    outline: 'border border-input bg-background hover:bg-muted hover:text-foreground',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    ghost: 'hover:bg-muted hover:text-foreground',
    link: 'text-primary underline-offset-4 hover:underline',
  },
  size: {
    default: 'h-10 px-4 py-2',
    sm: 'h-8 px-3 text-sm',
    lg: 'h-12 px-6 text-base',
    icon: 'h-10 w-10',
  },
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', asChild = false, children, ...props }, ref) => {
    const classes = cn(
      buttonStyles.base,
      variant && buttonStyles.variant[variant],
      size && buttonStyles.size[size],
      className,
    );

    if (asChild && React.Children.count(children) === 1) {
      const child = React.Children.only(children) as React.ReactElement<{ className?: string }>;
      const { type: _type, form: _form, formAction: _formAction, ...childProps } = props;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return React.cloneElement(child, { className: cn(classes, child.props?.className), ...childProps, ref } as any);
    }

    return (
      <button ref={ref} className={classes} {...props}>
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';

export { Button };
