import * as React from "react"

import { cn } from "@/lib/utils"
import { PP_FIELD } from "@/lib/fieldStyles"

const Textarea = React.forwardRef(({ className, ...props }, ref) => {
  return (
    (<textarea
      className={cn(
        "flex min-h-[60px] w-full rounded-md px-3 py-2 text-base shadow-sm transition-colors duration-[var(--motion-duration)] ease-[var(--motion-ease)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        PP_FIELD,
        className
      )}
      ref={ref}
      {...props} />)
  );
})
Textarea.displayName = "Textarea"

export { Textarea }
