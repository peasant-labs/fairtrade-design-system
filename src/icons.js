/* bundled lucide icons (replaces the unpkg CDN + window.lucide poll, which was flaky and
   caused icons to intermittently not paint). only the icons the partials actually use are
   imported, so the bundle stays lean. paintIcons() converts every <i data-lucide="..."> into
   an inline <svg class="lucide ...">; it is idempotent and safe to call repeatedly. */
import {
  createIcons,
  AlignLeft, Archive, ArrowUp, Bell, BellOff, Box, BoxSelect, Brain, Check,
  BookMarked, ChevronDown, ChevronLeft, ChevronRight, Circle, CircleAlert, CircleCheck, CircleX,
  Clipboard, Clock, Compass, Copy, Download, ExternalLink, Eye, EyeOff, File, FileDiff,
  FilePen, FileText, Filter, Flag, Folder, FolderOpen, Gauge, Gem, GitBranch,
  GitCommitHorizontal, GitFork, Hash, Inbox, Info, Link, Loader, LoaderCircle, Lock,
  MapPin, Maximize, Minus, Moon, Pencil, Plus, Route, Search, SearchX, Settings, Share2,
  ShieldCheck, SquarePen, SquareTerminal, Sun, Terminal, Trash2, TriangleAlert, Upload,
  User, Users, Wrench, X,
} from 'lucide'

const icons = {
  AlignLeft, Archive, ArrowUp, Bell, BellOff, Box, BoxSelect, Brain, Check,
  BookMarked, ChevronDown, ChevronLeft, ChevronRight, Circle, CircleAlert, CircleCheck, CircleX,
  Clipboard, Clock, Compass, Copy, Download, ExternalLink, Eye, EyeOff, File, FileDiff,
  FilePen, FileText, Filter, Flag, Folder, FolderOpen, Gauge, Gem, GitBranch,
  GitCommitHorizontal, GitFork, Hash, Inbox, Info, Link, Loader, LoaderCircle, Lock,
  MapPin, Maximize, Minus, Moon, Pencil, Plus, Route, Search, SearchX, Settings, Share2,
  ShieldCheck, SquarePen, SquareTerminal, Sun, Terminal, Trash2, TriangleAlert, Upload,
  User, Users, Wrench, X,
}

export function paintIcons() {
  try {
    createIcons({ icons, nameAttr: 'data-lucide' })
  } catch {
    /* no-op: never let an icon pass break the page */
  }
}
