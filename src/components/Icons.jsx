const base = {
  width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
}
const Icon = ({ children, size, ...p }) => (
  <svg {...base} {...(size ? { width: size, height: size } : null)} {...p} aria-hidden="true" focusable="false">
    {children}
  </svg>
)

export const Sun = (p) => (
  <Icon {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Icon>
)
export const Moon = (p) => (<Icon {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></Icon>)
export const Search = (p) => (<Icon {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Icon>)
export const X = (p) => (<Icon {...p}><path d="M18 6 6 18M6 6l12 12" /></Icon>)
export const Menu = (p) => (<Icon {...p}><path d="M3 6h18M3 12h18M3 18h18" /></Icon>)
export const Check = (p) => (<Icon {...p}><path d="m20 6-11 11-5-5" /></Icon>)
export const ArrowLeft = (p) => (<Icon {...p}><path d="M19 12H5M12 19l-7-7 7-7" /></Icon>)
export const ArrowRight = (p) => (<Icon {...p}><path d="M5 12h14M12 5l7 7-7 7" /></Icon>)
export const ChevronLeft = (p) => (<Icon {...p}><path d="m15 18-6-6 6-6" /></Icon>)
export const ChevronRight = (p) => (<Icon {...p}><path d="m9 18 6-6-6-6" /></Icon>)
export const Calendar = (p) => (<Icon {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></Icon>)
export const Clock = (p) => (<Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>)
export const User = (p) => (<Icon {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Icon>)
export const Users = (p) => (<Icon {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 5.2a3.5 3.5 0 0 1 0 5.6M18 14.3a6.5 6.5 0 0 1 3.5 5.7" /></Icon>)
export const Building = (p) => (<Icon {...p}><path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M2 21h20M8 8h3M8 12h3M8 16h3" /></Icon>)
export const Cap = (p) => (<Icon {...p}><path d="m12 4 10 5-10 5L2 9l10-5Z" /><path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" /></Icon>)
export const Lock = (p) => (<Icon {...p}><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></Icon>)
export const Shield = (p) => (<Icon {...p}><path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6l-8-3Z" /></Icon>)
export const Alert = (p) => (<Icon {...p}><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4M12 17.5v.5" /></Icon>)
export const Copy = (p) => (<Icon {...p}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></Icon>)
export const Inbox = (p) => (<Icon {...p}><path d="M3 12h5l2 3h4l2-3h5" /><path d="M5.5 5h13l2.5 7v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6l2.5-7Z" /></Icon>)
export const Trash = (p) => (<Icon {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V4h6v3" /></Icon>)
export const Wrench = (p) => (<Icon {...p}><path d="M15.5 3.5a5.5 5.5 0 0 0-6.8 7.1L3 16.3V21h4.7l5.7-5.7a5.5 5.5 0 0 0 7.1-6.8l-3.2 3.2-2.8-.5-.5-2.8 3.2-3.2Z" /></Icon>)
export const Cube = (p) => (<Icon {...p}><path d="m12 2.8 8.5 4.6v9.2L12 21.2 3.5 16.6V7.4L12 2.8Z" /><path d="M3.8 7.2 12 11.8l8.2-4.6M12 11.8V21" /></Icon>)
export const Logout = (p) => (<Icon {...p}><path d="M15 17l5-5-5-5M20 12H9M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5" /></Icon>)
export const Globe = (p) => (<Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M3.5 9h17M3.5 15h17M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></Icon>)
