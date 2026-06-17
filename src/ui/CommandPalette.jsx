/* the command palette already lives at src/CommandPalette.jsx (cmd-k, arrow nav, enter to jump,
   Esc to close) and is used by App.jsx. re-exported here so the ui/* surface is complete and
   stories can import it from one place. do not fork the implementation. */
export { default } from '../CommandPalette.jsx'
