# Project Guidelines & Rules

## Video Player & Live Chat Layout
- **Live-Only Chat Toggle**: The "Live Chat" toggle button in the player overlay and control bar must **strictly appear ONLY for live classes** (`isLive === true`). For recorded lectures, this button must remain completely hidden.
- **Side-by-Side Flex Resizing (No Crop)**: When Live Chat is opened in theater view, the video container must smoothly flex and shrink to the left without being cropped or distorted. Always maintain a 16:9 aspect ratio using flexbox (`flex-1 min-w-0`) with an inner `aspect-video max-w-full max-h-full` wrapper. When chat is closed, the video expands to 100% full width.

## Contextual Material Recommendations
- In the player theater view (`TheaterModal`), always auto-recommend notes, DPPs, and chapter lectures that match the active lecture's `subject` and `chapter`.

## Admin Folder Quick Selection
- In admin upload dialogs (Live Classes, Recorded Lectures, PDFs & Notes, DPPs), whenever a batch is selected, the UI must automatically query and display existing subjects and chapters as clickable pills so admins don't need to retype them manually.