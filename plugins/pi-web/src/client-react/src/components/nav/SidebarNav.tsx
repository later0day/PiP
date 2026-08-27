import { type JSX,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import clsx from "clsx";
import { createPortal } from "react-dom";
import { GlideMenu } from "../../primitives";
import { cssVars } from "../../lib/cssVars";
import styles from "./SidebarNav.module.css";

// SidebarNav — beautifului collapsible workspace rail. Primary nav + recents with
// the GlideMenu hover-follow highlight (reused from primitives), an inline-growing
// chat search field, a portalled workspace switcher, and a copy fade on collapse.
// Ported verbatim; Tailwind → CSS Modules over DSH vars; role/aria/tabIndex kept.

// ── inline icon set (source pulled these from an external icon lib; path data
// inlined here per the landing recipe). Each takes size + optional className.
interface IconProps {
  size?: number;
  className?: string;
}

function IconHome({ size = 18, className }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20h14V9.5" />
      <path d="M9.5 20v-6h5v6" />
    </svg>
  );
}

function IconUserAdd({ size = 18, className }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
      <path d="M18 8v6M15 11h6" />
    </svg>
  );
}

function IconPopsicle2({ size = 18, className }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M8 3.5A4 4 0 0 1 16 3.5v6a4 4 0 0 1-8 0z" />
      <path d="M11 13.5h2l-.4 6a.6.6 0 0 1-1.2 0z" />
    </svg>
  );
}

function IconChevronDownSmall({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 9.5 12 15l6-5.5" />
    </svg>
  );
}

function IconSidebarLeftArrow({ size = 18, className }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M9 4v16" />
      <path d="M16.5 9.5 14 12l2.5 2.5" />
    </svg>
  );
}

function IconEditBig({ size = 18, className }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 20h4l10-10-4-4L4 16z" />
      <path d="M13.5 6.5l4 4" />
    </svg>
  );
}

function IconMagnifyingGlass({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function IconCrossSmall({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function IconCheckmark1Small({ size = 18, className }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function IconPlusMedium({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconSettingsGear1({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v2.5M12 19v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12H5M19 12h2.5M4.2 19.8 6 18M18 6l1.8-1.8" />
    </svg>
  );
}

function IconArrowBoxLeft({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8" />
      <path d="M18 15l3-3-3-3" />
      <path d="M21 12H10" />
    </svg>
  );
}

// ── colocated data ──────────────────────────────────────────
const WORKSPACE = { key: "creamery", name: "Creamery Ops", monogram: "C" } satisfies {
  key: string;
  name: string;
  monogram: string;
};

interface NavItem {
  key: string;
  label: string;
  icon: ReactNode;
  count?: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: "home", label: "Home", icon: <IconHome size={18} /> },
  { key: "invite", label: "Invite users", icon: <IconUserAdd size={18} />, count: "3/10" },
];

interface MenuItem {
  label: string;
  icon: ReactNode;
}

const WORKSPACE_MENU_ITEMS: MenuItem[] = [
  { label: "New workspace", icon: <IconPlusMedium size={16} /> },
  { label: "Workspace settings", icon: <IconSettingsGear1 size={16} /> },
  { label: "Invite team members", icon: <IconUserAdd size={16} /> },
];

export interface SidebarRecent {
  id: string;
  label: string;
  prompt?: string;
}

const DEFAULT_RECENTS: SidebarRecent[] = [
  { id: "suppliers", label: "Supplier records" },
  { id: "todos", label: "Urgent to-dos this morning" },
  { id: "flavor", label: "Flavor page ticket" },
  { id: "workload", label: "Workload summary" },
  { id: "offboarding", label: "Off-board a supplier" },
  { id: "restock", label: "Batch restock function" },
  { id: "edits", label: "Propose flavor edits" },
  { id: "subway", label: "Subway surfing" },
];

const SIDEBAR_MOTION = {
  expandedWidth: 224,
  collapsedWidth: 52,
  duration: 280,
  copyDuration: 180,
  copyOffset: 8,
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
};

/* ─────────────────────────────────────────────────────────
 * CHAT SEARCH STORYBOARD
 *   0ms   search is triggered; Chats label begins fading
 *   0ms   field grows right → left from the search control
 * 180ms   field fills the row; cursor is focused and ready
 * ───────────────────────────────────────────────────────── */
const CHAT_SEARCH_MOTION = {
  duration: 180,
  closedWidth: 28,
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
};

// ── sub-components ──────────────────────────────────────────
function GlideGroup({ children }: { children: ReactNode }): JSX.Element {
  return (
    <GlideMenu className={styles.glideGroup} highlightClassName={styles.glideHighlightRow}>
      {children}
    </GlideMenu>
  );
}

function RailButton({
  icon,
  label,
  active = false,
  count,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  count?: string;
  onClick?: () => void;
}): JSX.Element {
  return (
    <button
      data-row
      data-glide-item
      type="button"
      onClick={onClick}
      className={clsx(styles.row, active && styles.rowActive)}
    >
      <span className={clsx(styles.rowIcon, active && styles.rowIconActive)}>{icon}</span>
      <span className={clsx(styles.copy, styles.rowLabel, active && styles.rowLabelActive)}>
        {label}
      </span>
      {count !== undefined && <span className={clsx(styles.copy, styles.rowCount)}>{count}</span>}
    </button>
  );
}

function WorkspaceMenu({
  position,
  onClose,
}: {
  position: { top: number; left: number };
  onClose: () => void;
}): JSX.Element {
  return createPortal(
    <div
      data-workspace-menu
      className={styles.menu}
      style={{
        top: position.top,
        left: position.left,
        animation: "pop-in 180ms cubic-bezier(0.23,1,0.32,1) both",
        transformOrigin: "top left",
      }}
    >
      <GlideMenu className={styles.menuList} highlightClassName={styles.glideHighlightMenu}>
        <button
          data-menu-row
          data-glide-item
          type="button"
          onClick={onClose}
          className={styles.menuRowTall}
        >
          <span className={styles.monogram}>{WORKSPACE.monogram}</span>
          <span className={styles.menuName}>{WORKSPACE.name}</span>
          <span className={styles.menuCheck}>
            <IconCheckmark1Small size={18} />
          </span>
        </button>
        <div className={styles.divider} />
        {WORKSPACE_MENU_ITEMS.map((item) => (
          <button
            key={item.label}
            data-menu-row
            data-glide-item
            type="button"
            onClick={onClose}
            className={styles.menuRow}
          >
            <span className={styles.menuRowIcon}>{item.icon}</span>
            <span className={styles.menuRowLabel}>{item.label}</span>
          </button>
        ))}
        <div className={styles.divider} />
        <button
          data-menu-row
          data-glide-item
          type="button"
          onClick={onClose}
          className={styles.menuRow}
        >
          <span className={styles.menuRowIcon}>
            <IconArrowBoxLeft size={16} />
          </span>
          <span className={styles.menuRowLabel}>Sign out</span>
        </button>
      </GlideMenu>
    </div>,
    document.body,
  );
}

export interface SidebarNavProps {
  activeTitle?: string | null;
  className?: string;
  fill?: boolean;
  onNewChat?: () => void;
  onPick?: (id: string, label: string, prompt?: string) => void;
  /** controlled primary-nav selection (e.g. "home" | "invite") */
  activeNav?: string;
  onNavigate?: (key: string) => void;
  /** footer call-to-action — defaults to the demo "Upgrade" button */
  footerLabel?: string;
  footerIcon?: ReactNode;
  onFooterClick?: () => void;
  recents?: SidebarRecent[];
  variant?: string;
}

export function SidebarNav({
  activeTitle,
  className = "",
  fill = false,
  onNewChat,
  onPick,
  activeNav,
  onNavigate,
  footerLabel = "Upgrade",
  footerIcon,
  onFooterClick,
  recents = DEFAULT_RECENTS,
}: SidebarNavProps): JSX.Element {
  const [collapsed, setCollapsed] = useState(false);
  const [internalNav, setInternalNav] = useState("chats");
  const currentNav = activeNav ?? internalNav;
  const selectNav = (key: string) => {
    setInternalNav(key);
    onNavigate?.(key);
  };
  const [demoActiveTitle, setDemoActiveTitle] = useState<string | null>(null);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [workspacePosition, setWorkspacePosition] = useState({ top: 0, left: 0 });
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const workspaceButtonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedTitle = activeTitle === undefined ? demoActiveTitle : activeTitle;
  const visibleRecents = recents.filter((item) =>
    item.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  useEffect(() => {
    if (!workspaceOpen) return;
    const close = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && !target.closest("[data-workspace-trigger]") && !target.closest("[data-workspace-menu]")) {
        setWorkspaceOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => { document.removeEventListener("pointerdown", close); };
  }, [workspaceOpen]);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const collapse = () => {
    setCollapsed(true);
    setWorkspaceOpen(false);
    setSearchOpen(false);
    setQuery("");
  };

  return (
    <aside
      data-sidebar-collapsed={collapsed}
      aria-label="Workspace navigation"
      className={clsx(styles.sidebar, fill ? styles.fill : styles.fixedHeight, className)}
      style={{
        width: collapsed ? SIDEBAR_MOTION.collapsedWidth : SIDEBAR_MOTION.expandedWidth,
        transitionDuration: `${String(SIDEBAR_MOTION.duration)}ms`,
        transitionTimingFunction: SIDEBAR_MOTION.easing,
        ...cssVars({
          "--sidebar-copy-duration": `${String(SIDEBAR_MOTION.copyDuration)}ms`,
          "--sidebar-copy-offset": `${String(SIDEBAR_MOTION.copyOffset)}px`,
          "--sidebar-easing": SIDEBAR_MOTION.easing,
        }),
      }}
    >
      <div className={styles.inner}>
        <div className={styles.header}>
          <button
            ref={workspaceButtonRef}
            data-workspace-trigger
            type="button"
            aria-expanded={workspaceOpen}
            aria-hidden={collapsed}
            tabIndex={collapsed ? -1 : 0}
            onClick={() => {
              if (!workspaceOpen && workspaceButtonRef.current) {
                const rect = workspaceButtonRef.current.getBoundingClientRect();
                setWorkspacePosition({ top: rect.bottom + 6, left: rect.left });
              }
              setWorkspaceOpen((open) => !open);
            }}
            className={styles.workspaceControl}
          >
            <span className={styles.logo}>
              <IconPopsicle2 size={18} />
            </span>
            <span className={clsx(styles.copy, styles.workspaceName)}>{WORKSPACE.name}</span>
            <span className={clsx(styles.copy, styles.workspaceChevron)}>
              <IconChevronDownSmall size={16} />
            </span>
          </button>

          {workspaceOpen && (
            <WorkspaceMenu position={workspacePosition} onClose={() => { setWorkspaceOpen(false); }} />
          )}

          <button
            type="button"
            aria-label="Collapse sidebar"
            aria-hidden={collapsed}
            tabIndex={collapsed ? -1 : 0}
            onClick={collapse}
            className={styles.collapseControl}
          >
            <IconSidebarLeftArrow size={18} />
          </button>
          <button
            type="button"
            aria-label="Expand sidebar"
            aria-hidden={!collapsed}
            tabIndex={collapsed ? 0 : -1}
            onClick={() => { setCollapsed(false); }}
            className={styles.expandControl}
          >
            <IconSidebarLeftArrow size={18} className={styles.rotate180} />
          </button>
        </div>

        <GlideGroup>
          <RailButton
            icon={<IconEditBig size={18} />}
            label="New chat"
            onClick={() => {
              if (activeTitle === undefined) setDemoActiveTitle(null);
              selectNav("chats");
              onNewChat?.();
            }}
          />
          {NAV_ITEMS.map((item) => (
            <RailButton
              key={item.key}
              icon={item.icon}
              label={item.label}
              count={item.count}
              active={currentNav === item.key}
              onClick={() => { selectNav(item.key); }}
            />
          ))}
        </GlideGroup>

        <div className={styles.scroll}>
          <div className={clsx(styles.copy, styles.searchHeader)}>
            <div
              aria-hidden={searchOpen}
              className={clsx(styles.chatsLabel, searchOpen && styles.chatsLabelHidden)}
              style={{
                transitionDuration: `${String(CHAT_SEARCH_MOTION.duration)}ms`,
                transitionTimingFunction: CHAT_SEARCH_MOTION.easing,
              }}
            >
              <IconChevronDownSmall size={16} />
              <span>Chats</span>
            </div>

            <button
              type="button"
              aria-label="Search chats"
              aria-expanded={searchOpen}
              onClick={() => { setSearchOpen(true); }}
              className={clsx(styles.searchTrigger, searchOpen && styles.searchTriggerHidden)}
              style={{ transitionDuration: `${String(CHAT_SEARCH_MOTION.duration)}ms` }}
            >
              <IconMagnifyingGlass size={16} />
            </button>

            <div
              className={clsx(styles.searchField, searchOpen ? styles.searchFieldOpen : styles.searchFieldClosed)}
              style={{
                width: searchOpen ? "100%" : CHAT_SEARCH_MOTION.closedWidth,
                transitionDuration: `${String(CHAT_SEARCH_MOTION.duration)}ms`,
                transitionTimingFunction: CHAT_SEARCH_MOTION.easing,
              }}
            >
              <span className={styles.searchFieldIcon}>
                <IconMagnifyingGlass size={15} />
              </span>
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => { setQuery(event.target.value); }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setSearchOpen(false);
                    setQuery("");
                  }
                }}
                placeholder="Search chats"
                aria-label="Search chat history"
                className={styles.searchInput}
              />
              <button
                type="button"
                aria-label="Close chat search"
                onClick={() => {
                  setSearchOpen(false);
                  setQuery("");
                }}
                className={styles.searchClose}
              >
                <IconCrossSmall size={16} />
              </button>
            </div>
          </div>

          <GlideGroup>
            {visibleRecents.map((item) => {
              const active = item.label === selectedTitle;
              return (
                <button
                  key={item.id}
                  data-row
                  data-glide-item
                  type="button"
                  title={item.label}
                  onClick={() => {
                    selectNav("chats");
                    if (activeTitle === undefined) setDemoActiveTitle(item.label);
                    onPick?.(item.id, item.label, item.prompt);
                  }}
                  className={clsx(styles.row, active && styles.rowActive)}
                >
                  <span
                    className={clsx(styles.copy, styles.recentLabel, active && styles.rowLabelActive)}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
            {query && visibleRecents.length === 0 && (
              <div className={clsx(styles.copy, styles.noChats)}>No chats found</div>
            )}
          </GlideGroup>
        </div>

        <div className={clsx(styles.copy, styles.footer)}>
          <button type="button" onClick={onFooterClick ?? onNewChat} className={styles.footerBtn}>
            {footerIcon}
            {footerLabel}
          </button>
        </div>
      </div>
    </aside>
  );
}
