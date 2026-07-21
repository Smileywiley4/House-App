import * as React from "react"

import { cn } from "@/lib/utils"
import { PP_FIELD } from "@/lib/fieldStyles"

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    (<input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-control px-3 py-1 text-base shadow-sm transition-colors duration-[var(--motion-duration)] ease-[var(--motion-ease)] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        PP_FIELD,
        className
      )}
      ref={ref}
      {...props} />)
  );
})
Input.displayName = "Input"

export { Input }
