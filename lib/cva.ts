type ClassValue = string | undefined | null | false;

type VariantConfig = {
  [key: string]: {
    [key: string]: string;
  };
};

type DefaultVariants<V extends VariantConfig> = {
  [K in keyof V]?: keyof V[K];
};

type VariantProps<V extends VariantConfig> = {
  [K in keyof V]?: keyof V[K];
};

type CompoundVariant<V extends VariantConfig> = {
  [K in keyof V]?: keyof V[K];
} & {
  className: string;
};

type CVAConfig<V extends VariantConfig> = {
  variants?: V;
  defaultVariants?: DefaultVariants<V>;
  compoundVariants?: CompoundVariant<V>[];
};

export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(' ');
}

export function cva<V extends VariantConfig>(
  base: string,
  config?: CVAConfig<V>
) {
  return (props?: VariantProps<V> & { className?: string }) => {
    const { className, ...variantProps } = props || {};

    const variants = config?.variants || {};
    const defaultVariants = config?.defaultVariants || {};
    const compoundVariants = config?.compoundVariants || [];

    // Build variant classes
    const variantClasses: string[] = [];

    for (const variantKey in variants) {
      const variantValue = (variantProps as Record<string, unknown>)?.[variantKey]
        ?? defaultVariants[variantKey as keyof typeof defaultVariants];

      if (variantValue && variants[variantKey]?.[variantValue as string]) {
        variantClasses.push(variants[variantKey][variantValue as string]);
      }
    }

    // Check compound variants
    const compoundClasses: string[] = [];

    for (const compound of compoundVariants) {
      const { className: compoundClassName, ...conditions } = compound;

      let matches = true;
      for (const [key, value] of Object.entries(conditions)) {
        const propValue = (variantProps as Record<string, unknown>)?.[key]
          ?? defaultVariants[key as keyof typeof defaultVariants];
        if (propValue !== value) {
          matches = false;
          break;
        }
      }

      if (matches) {
        compoundClasses.push(compoundClassName);
      }
    }

    return cn(base, ...variantClasses, ...compoundClasses, className);
  };
}

// Helper to extract variant props type from a cva function
export type VariantPropsOf<T> = T extends (props?: infer P) => string
  ? Omit<P, 'className'>
  : never;
