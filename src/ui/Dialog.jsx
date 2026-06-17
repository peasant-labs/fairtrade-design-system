/* the modal dialog already lives at src/Dialog.jsx (focus-trap / Esc / scrim / return-focus)
   and is used by App.jsx. re-exported here so the ui/* surface is complete and stories can
   import it from one place. do not fork the implementation. */
export { default } from '../Dialog.jsx'
