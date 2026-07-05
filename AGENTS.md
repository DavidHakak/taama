<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Loader & Actions Rules
- **Universal Loaders**: Every user action (form submission, toggle, creation, deletion, database updates) MUST trigger a visual loader (using `setGlobalLoading` or inline loaders).
- **Disable Inputs/Buttons**: During any loading/submitting state, all relevant inputs and submit buttons must be disabled (`disabled={loading}`) to prevent double clicks and double submissions.
- **Client Cache Sync**: After any successful mutation action, `router.refresh()` MUST be called to synchronize the client-side router with updated database data.

