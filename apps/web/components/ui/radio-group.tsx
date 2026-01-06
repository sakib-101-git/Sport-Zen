"use client";

import * as React from "react";
import { Circle } from "lucide-react";
import { cn } from "./utils";

interface RadioGroupContextValue {
  value: string;
  onValueChange: (value: string) => void;
  name: string;
}

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(null);

const useRadioGroup = () => {
  const context = React.useContext(RadioGroupContext);
  if (!context) {
    throw new Error("useRadioGroup must be used within a RadioGroup");
  }
  return context;
};

interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
}

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className, value: controlledValue, defaultValue = "", onValueChange, name = "radio-group", children, ...props }, ref) => {
    const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
    const value = controlledValue !== undefined ? controlledValue : uncontrolledValue;

    const handleValueChange = React.useCallback((newValue: string) => {
      if (controlledValue === undefined) {
        setUncontrolledValue(newValue);
      }
      onValueChange?.(newValue);
    }, [controlledValue, onValueChange]);

    return (
      <RadioGroupContext.Provider value={{ value, onValueChange: handleValueChange, name }}>
        <div
          ref={ref}
          role="radiogroup"
          className={cn("grid gap-2", className)}
          {...props}
        >
          {children}
        </div>
      </RadioGroupContext.Provider>
    );
  }
);
RadioGroup.displayName = "RadioGroup";

interface RadioGroupItemProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  value: string;
}

const RadioGroupItem = React.forwardRef<HTMLInputElement, RadioGroupItemProps>(
  ({ className, value, id, ...props }, ref) => {
    const { value: groupValue, onValueChange, name } = useRadioGroup();
    const isChecked = groupValue === value;

    return (
      <label className="relative inline-flex items-center">
        <input
          type="radio"
          ref={ref}
          id={id}
          name={name}
          value={value}
          checked={isChecked}
          onChange={() => onValueChange(value)}
          className="sr-only peer"
          {...props}
        />
        <div
          className={cn(
            "aspect-square h-4 w-4 rounded-full border border-gray-600 bg-gray-800 transition-colors",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-gray-950",
            "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
            isChecked && "border-primary",
            className
          )}
        >
          {isChecked && (
            <span className="flex h-full w-full items-center justify-center">
              <Circle className="h-2.5 w-2.5 fill-primary text-primary" />
            </span>
          )}
        </div>
      </label>
    );
  }
);
RadioGroupItem.displayName = "RadioGroupItem";

export { RadioGroup, RadioGroupItem };
