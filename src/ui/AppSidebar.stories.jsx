import { useEffect, useMemo, useState } from 'react'
import { expect, userEvent, within, waitFor } from 'storybook/test'
import {
  BookOpen, Building2, Code, Compass, Download, EyeOff, FileText, FlaskConical, GitPullRequest, GraduationCap,
  House, Lock, MessagesSquare, Plug, ScrollText, Search, Send, Settings, Terminal, TriangleAlert, UserRound, Users,
} from 'lucide-react'
import AppSidebar, { AppPage, AppSidebarLayout, APP_SIDEBAR_APPS } from './AppSidebar.jsx'
import { SettingsLayout } from './SettingsNav.jsx'
import { SettingGroup, SettingRow } from './Settings.jsx'

/* CSF3 stories for the shared app sidebar. classes + tokens come from src/index.css via
   .storybook/preview.jsx plus the component's own sheet; the theme toolbar flips data-theme. each
   story mounts the sidebar inside AppSidebarLayout beside a placeholder page, the way an app screen
   does. Online, Local and Docs show the three apps' navs (Local's settings page becomes the footer's
   gear and its collectives link moves up to the shortcuts on their own); Collapsed starts as the icon rail; Mobile
   runs at a phone viewport, where the sidebar is a top bar whose menu opens the drawer. every story
   shows the one order the sidebar keeps in every app: the brand row, the shortcuts (search, the docs,
   community, the app's links that leave it), the app's pages, then the footer row (the account, the
   settings gear and the theme toggle). AccountSettings
   is an account settings page in the AppPage frame with the settings section bar in its body, the
   sidebar left as it is on every other page. choosing an
   in-app item makes it current, so the indicator can be seen sliding. every story passes
   storageKey={null} so one story's collapse or resize never leaks into the next. the nav data is
   example data. */

const meta = {
  title: 'in use/AppSidebar',
  component: AppSidebar,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
}
export default meta

// the switcher: the docs; the component ends it with community as soon by itself
const apps = APP_SIDEBAR_APPS.map((entry) => ({ ...entry, href: '#docs' }))

const ONLINE_GROUPS = [
  { id: 'main', ariaLabel: 'peasant sections', items: [
    { id: 'home', label: 'home', href: '#home', icon: House },
    { id: 'discover', label: 'discover', href: '#discover', icon: Compass },
    { id: 'prs', label: 'pull requests', href: '#prs', icon: GitPullRequest },
    { id: 'collectives', label: 'collectives', href: '#collectives', icon: Users },
    { id: 'eval-crowd', label: 'eval-crowd', href: '#eval-crowd', swatch: 'var(--olive)', depth: 1 },
    { id: 'peasant-dev', label: 'peasant-dev', href: '#peasant-dev', swatch: 'var(--clay)', depth: 1 },
    { id: 'reading-group', label: 'reading-group', href: '#reading-group', swatch: 'var(--teal)', depth: 1 },
  ] },
]

const LOCAL_GROUPS = [
  { id: 'main', ariaLabel: 'peasant sections', items: [
    { id: 'home', label: 'sessions', href: '#sessions', icon: ScrollText },
    { id: 'collectives', label: 'collectives', href: '#online-collectives', icon: Users, external: true, title: 'collectives, opens online' },
    { id: 'settings', label: 'settings', href: '#settings', icon: Settings },
  ] },
]

const DOCS_GROUPS = [
  { id: 'start', label: 'get started', items: [
    { id: 'docs-home', label: 'overview', href: '#overview', icon: BookOpen },
    { id: 'install', label: 'install', href: '#install', icon: Download },
    { id: 'kickstart', label: 'set up with kickstart', href: '#kickstart', icon: Terminal },
    { id: 'publish', label: 'publish a session', href: '#publish', icon: Send },
  ] },
  { id: 'guides', label: 'guides', items: [
    { id: 'guide-evals', label: 'agent evals', href: '#evals', icon: FlaskConical },
    { id: 'guide-reviews', label: 'pull request reviews', href: '#reviews', icon: GitPullRequest },
    { id: 'guide-research', label: 'research sets', href: '#research', icon: Search },
    { id: 'guide-teaching', label: 'teaching', href: '#teaching', icon: GraduationCap },
  ] },
  { id: 'reference', label: 'reference', items: [
    { id: 'cli', label: 'cli', href: '#cli', icon: Code },
    { id: 'harnesses', label: 'harnesses', href: '#harnesses', icon: Plug },
    { id: 'redaction', label: 'redaction', href: '#redaction', icon: EyeOff },
    { id: 'access', label: 'collectives and access', href: '#access', icon: Lock },
  ] },
  { id: 'more', ariaLabel: 'more', items: [
    { id: 'blog', label: 'blog', href: '#blog', icon: FileText },
    { id: 'community', label: 'community', href: '#community', icon: MessagesSquare, external: true },
  ] },
]

/* a stand-in page body in the AppPage frame: a heading and a few hairline rows, so the sticky
   column has a page beside it */
function PlaceholderPage({ title }) {
  return (
    <AppPage>
      <h1 style={{ fontSize: 'var(--fs-xl)' }}>{title}</h1>
      <div>
        {['fix the flaky upload test', 'add retries to the sync client', 'trace the slow kickstart scan'].map((row) => (
          <div key={row} style={{ padding: 'var(--sp-3) 0', borderBottom: 'var(--bd)', color: 'var(--ink)' }}>{row}</div>
        ))}
      </div>
    </AppPage>
  )
}

const lands = () => new Promise((resolve) => setTimeout(resolve, 400))
const ACCOUNT_SECTIONS = [
  { id: 'profile', label: 'profile', icon: UserRound },
  { id: 'organizations', label: 'organizations', icon: Building2 },
  { id: 'pull-requests', label: 'pull requests', icon: GitPullRequest },
  { id: 'connections', label: 'connections', icon: Plug },
  { id: 'danger-zone', label: 'danger zone', icon: TriangleAlert },
]

/* an account settings page: the AppPage frame, the settings section bar in the body */
function SettingsPage() {
  const [current, setCurrent] = useState('profile')
  const section = ACCOUNT_SECTIONS.find((entry) => entry.id === current)
  return (
    <AppPage>
      <h1 style={{ fontSize: 'var(--fs-xl)' }}>your settings</h1>
      <SettingsLayout sections={ACCOUNT_SECTIONS} currentId={current} onSelect={setCurrent}>
        <SettingGroup label={section.label} defaultOpen>
          <SettingRow label="handle" control="text" value="mira" onCommit={lands} />
          <SettingRow label="discoverable profile" help="on: your handle shows on your transcripts and in member lists. off: you show as anon." control="switch" value onCommit={lands} />
        </SettingGroup>
      </SettingsLayout>
    </AppPage>
  )
}

/* the theme the story frame is drawn in: read from the toolbar's data-theme, flipped by the
   sidebar's own toggle the way an app's theme hook would */
function useStoryTheme() {
  const read = () => (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark')
  const [theme, setTheme] = useState(read)
  // the toolbar sets data-theme after the first render; follow it
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(read()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    setTheme(read())
    return () => observer.disconnect()
  }, [])
  const change = (next) => {
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
  }
  return [theme, change]
}

function Frame({ title, groups, currentId, page, ...props }) {
  const [current, setCurrent] = useState(currentId)
  const [theme, setTheme] = useStoryTheme()
  const live = useMemo(() => groups.map((group) => ({
    ...group,
    items: group.items.map((item) => (item.external ? item : { ...item, onSelect: setCurrent })),
  })), [groups])
  return (
    <AppSidebarLayout sidebar={<AppSidebar apps={apps} storageKey={null} homeHref="#home" groups={live} currentId={current} theme={theme} onThemeChange={setTheme} {...props} />}>
      {page ?? <PlaceholderPage title={title} />}
    </AppSidebarLayout>
  )
}

// the account as its own menu (profile, settings, sign out): the same flat row with no caret, so the
// handle keeps the default row's width, opening above the footer
export const AccountMenu = {
  render: () => <Frame title="home" app="online" groups={ONLINE_GROUPS} currentId="home" account={{ handle: 'alicedev', items: [{ label: 'profile' }, { label: 'settings' }, { separator: true }, { label: 'sign out' }] }} settingsHref="#settings" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: '@alicedev' })
    const handle = trigger.querySelector('.asb-handle')
    await expect(handle.scrollWidth).toBeLessThanOrEqual(handle.clientWidth)
    await userEvent.click(trigger)
    await expect(canvas.getByRole('menuitem', { name: 'sign out' })).toBeVisible()
  },
}

export const Online = {
  render: () => <Frame title="home" app="online" groups={ONLINE_GROUPS} currentId="home" account={{ handle: 'mira', href: '#account' }} settingsHref="#settings" search={{ onOpen: () => {}, shortcut: '⌘K', keyShortcuts: 'Meta+K' }} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const toggle = canvas.getByRole('button', { name: 'collapse the sidebar' })
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(canvas.getByRole('link', { name: 'home' })).toHaveAttribute('aria-current', 'page')
    // the shortcuts sit on top: search, the docs (a new tab) and community; never online or local
    const switcher = canvas.getByRole('navigation', { name: 'shortcuts' })
    await expect(within(switcher).queryByText('online')).toBeNull()
    await expect(within(switcher).getByRole('link', { name: /^docs\s*, opens in a new tab$/ })).toHaveAttribute('target', '_blank')
    // collapse to the rail, check the labels survive as accessible names, then expand again
    await userEvent.click(toggle)
    await waitFor(() => expect(canvas.getByRole('button', { name: 'expand the sidebar' })).toHaveAttribute('aria-expanded', 'false'))
    await expect(canvas.getByRole('link', { name: 'discover' })).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'expand the sidebar' }))
    await waitFor(() => expect(canvas.getByRole('button', { name: 'collapse the sidebar' })).toHaveAttribute('aria-expanded', 'true'))
    // choosing another item moves the current marker there, then back
    await userEvent.click(canvas.getByRole('link', { name: 'discover' }))
    await waitFor(() => expect(canvas.getByRole('link', { name: 'discover' })).toHaveAttribute('aria-current', 'page'))
    await userEvent.click(canvas.getByRole('link', { name: 'home' }))
    await waitFor(() => expect(canvas.getByRole('link', { name: 'home' })).toHaveAttribute('aria-current', 'page'))
    // rest without a focused control so the documented state carries no focus ring
    canvasElement.ownerDocument.activeElement?.blur()
  },
}

export const AccountSettings = {
  render: () => <Frame title="your settings" app="online" groups={ONLINE_GROUPS} account={{ handle: 'mira', href: '#account' }} page={<SettingsPage />} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // the settings sections live in the page body; the sidebar keeps its own nav
    const sections = canvas.getByRole('navigation', { name: 'settings sections' })
    await expect(within(sections).getByRole('button', { name: 'profile' })).toHaveAttribute('aria-current', 'true')
    await expect(canvas.getByRole('navigation', { name: 'peasant sections' })).toBeInTheDocument()
  },
}

export const Local = {
  render: () => <Frame title="sessions" app="local" groups={LOCAL_GROUPS} currentId="home" account={{ handle: 'mira' }} search={{ onOpen: () => {}, shortcut: '⌘K', keyShortcuts: 'Meta+K' }} />,
}

export const Docs = {
  render: () => <Frame title="overview" app="docs" groups={DOCS_GROUPS} currentId="docs-home" />,
}

export const Collapsed = {
  render: () => <Frame title="home" app="online" groups={ONLINE_GROUPS} currentId="discover" account={{ handle: 'mira', href: '#account' }} defaultCollapsed />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'expand the sidebar' })).toHaveAttribute('aria-expanded', 'false')
    await expect(canvas.queryByRole('separator')).toBeNull()
    await expect(canvas.getByRole('link', { name: 'discover' })).toHaveAttribute('title', 'discover')
  },
}

export const Mobile = {
  render: () => <Frame title="home" app="online" groups={ONLINE_GROUPS} currentId="home" account={{ handle: 'mira', href: '#account' }} />,
  parameters: {
    viewport: {
      defaultViewport: 'phone390',
      options: { phone390: { name: 'phone, 390', styles: { width: '390px', height: '780px' } } },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // the phone layout only applies when the frame is narrow; at a desktop width the menu is hidden
    const menu = canvas.queryByRole('button', { name: 'open the menu' })
    if (!menu) return
    await expect(menu).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(menu)
    await waitFor(() => expect(menu).toHaveAttribute('aria-expanded', 'true'))
    // the same button is now the drawer's close control
    await expect(menu).toHaveAttribute('aria-label', 'close the menu')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(menu).toHaveAttribute('aria-expanded', 'false'))
    await expect(menu).toHaveAttribute('aria-label', 'open the menu')
    canvasElement.ownerDocument.activeElement?.blur()
  },
}
