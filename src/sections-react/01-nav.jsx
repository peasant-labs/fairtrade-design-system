import { Search, Moon, Sun } from 'lucide-react'

/* 01-nav: the fixed top nav bar. App.jsx's delegated click handlers + effects query these
   EXACT hooks — preserve all of them: .nav, .theme-btn, .navctl.bx (search/command-k),
   every nav link's data-spy, .sb-link (storybook), and all ids. <i data-lucide> -> lucide-react.
   Replaces <Raw html={navHtml} />. */
export function NavBar() {
  return (
    <nav className="nav">
      <div className="nav-in">
        <div className="nav-left">
          <a className="brand" href="#"><svg className="logo" width="20" height="20" viewBox="0 0 32 32"><use href="#logo" /></svg><span>fairtrade</span></a>
          <div className="nav-links">
            <a href="#foundations" data-spy="foundations">foundations</a>
            <a href="#components" data-spy="components">components</a>
            <a href="#using" data-spy="using">using the system</a>
            <a href="#inuse" data-spy="inuse">in use</a>
          </div>
        </div>
        <div className="nav-right">
          <button className="navctl bx" aria-haspopup="dialog" aria-label="search (command k)"><Search aria-hidden="true" /> <span className="bx-label">search</span> <span className="kbd">⌘k</span></button>
          <a className="navctl sb-link" href={(import.meta.env.BASE_URL || '/') + 'storybook/'} aria-label="storybook"><svg className="brand" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><use href="#b-storybook" /></svg> <span className="sb-label">storybook</span></a>
          <span className="navctl"><span className="dot"></span> connected</span>
          <button className="navctl sq theme-btn" aria-label="toggle theme"><span className="i-moon"><Moon aria-hidden="true" /></span><span className="i-sun"><Sun aria-hidden="true" /></span></button>
        </div>
      </div>
    </nav>
  )
}
