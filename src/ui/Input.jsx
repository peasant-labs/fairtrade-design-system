import { useId, useState } from 'react';
import { TriangleAlert, ChevronDown } from 'lucide-react';

/* input-states family (.is-*): label-above fields with a hint or a real error below, wired with
   aria-describedby; readonly/disabled use the real native attributes (never an opacity hack); error
   is never the clay border alone — it pairs a triangle-alert icon with a plain-language message.
   reuses .is-field / .label / .input / .is-input / .is-hint / .is-error / .select-wrap / .select /
   .input-ico from src/index.css with zero new CSS. all-lowercase chrome; children pass through
   verbatim (never force-lowercased). */

/**
 * Field — the label + control + hint/error wrapper (.is-field) the inputs compose into.
 * Renders the label above, the control (children) in the middle, and a hint (.is-hint) or, when
 * `error` is a non-empty string, an error (.is-error with a TriangleAlert icon) below. Wires the
 * label's htmlFor and the hint/error id to the control via the {labelId, descId, describedBy}
 * render-prop args so the standalone <Field> can be used with any control. The shipped Input /
 * Textarea / Select use this internally, so most callers never touch Field directly.
 *
 * @param {Object} props
 * @param {React.ReactNode} [props.label] - label text shown above the control. When `lock` is set it
 *   is wrapped in `.is-lk` with a leading icon.
 * @param {React.ComponentType<{size?:number}>} [props.lock] - optional lucide icon (e.g. lock={Lock})
 *   rendered before the label inside `.is-lk` to flag a read-only/locked field.
 * @param {string} [props.hint] - helper text rendered in `.is-hint` below the control (when no error).
 * @param {string} [props.error] - error message; a non-empty string renders `.is-error` (TriangleAlert
 *   + message) instead of the hint and is announced via aria-describedby.
 * @param {string} [props.id] - control id; auto-generated when omitted. Used for label htmlFor.
 * @param {(args:{id:string,labelId:string,descId:string|undefined,describedBy:string|undefined,invalid:boolean})=>React.ReactNode} props.children
 *   - render-prop receiving wiring ids; returns the control element.
 * @returns {JSX.Element}
 */
export function Field({ label, lock: LockIcon, hint, error, id, children }) {
  const autoId = useId();
  const fieldId = id || autoId;
  const invalid = typeof error === 'string' && error.length > 0;
  const descId = invalid ? `${fieldId}-err` : hint ? `${fieldId}-hint` : undefined;
  const describedBy = descId;
  return (
    <div className="is-field">
      {label != null && (
        <label className="label" htmlFor={fieldId}>
          {LockIcon ? (
            <span className="is-lk">
              <LockIcon className="lucide" aria-hidden="true" /> {label}
            </span>
          ) : (
            label
          )}
        </label>
      )}
      {children({ id: fieldId, labelId: fieldId, descId, describedBy, invalid })}
      {invalid ? (
        <span className="is-error" id={descId}>
          <TriangleAlert className="lucide" aria-hidden="true" /> {error}
        </span>
      ) : hint ? (
        <span className="is-hint" id={descId}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

/* shared controlled/uncontrolled value plumbing: returns [value, handleChange] honoring a controlled
   `value` prop, falling back to internal state seeded from `defaultValue`. onChange always fires. */
function useControllable(value, defaultValue, onChange) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? '');
  const current = isControlled ? value : internal;
  const handleChange = (e) => {
    if (!isControlled) setInternal(e.target.value);
    onChange?.(e);
  };
  return [current, handleChange];
}

/**
 * Input — a single-line text field with the full input-states wiring. When `iconLeft` is supplied the
 * control sits inside an `.input-ico` wrapper (the icon is absolutely positioned, leaving room via the
 * CSS padding). Error sets aria-invalid + the clay border via `.is-input[aria-invalid]` and links the
 * message with aria-describedby. Supports controlled (`value` + `onChange`) and uncontrolled
 * (`defaultValue`) use.
 *
 * Emits `<div class="is-field"><label class="label"/>[<div class="input-ico">]<input class="input is-input"/>[…]<span class="is-hint|is-error"/></div>`
 * matching src/index.css with zero new CSS.
 *
 * @param {Object} props
 * @param {React.ReactNode} [props.label] - label above the field.
 * @param {React.ComponentType<{size?:number}>} [props.lock] - optional lucide icon shown beside the label (.is-lk).
 * @param {string} [props.hint] - helper text under the field.
 * @param {string} [props.error] - error message; non-empty marks the field invalid (aria-invalid, clay border, icon).
 * @param {boolean} [props.invalid=false] - force the invalid border without a message (sets aria-invalid).
 * @param {React.ComponentType<{size?:number}>} [props.iconLeft] - leading lucide icon component (wraps the input in .input-ico).
 * @param {string} [props.type='text'] - native input type.
 * @param {boolean} [props.readOnly=false] - native readonly (surface-2 fill, quiet, still selectable).
 * @param {boolean} [props.disabled=false] - native disabled.
 * @param {string|number} [props.value] - controlled value.
 * @param {string|number} [props.defaultValue] - initial value for uncontrolled use.
 * @param {(e:React.ChangeEvent<HTMLInputElement>)=>void} [props.onChange] - change handler.
 * @param {string} [props.id] - input id; auto-generated + associated with the label when omitted.
 * @returns {JSX.Element}
 */
export default function Input({
  label,
  lock,
  hint,
  error,
  invalid = false,
  iconLeft: IconLeft,
  type = 'text',
  readOnly = false,
  disabled = false,
  value,
  defaultValue,
  onChange,
  id,
  ...rest
}) {
  const [current, handleChange] = useControllable(value, defaultValue, onChange);
  return (
    <Field label={label} lock={lock} hint={hint} error={error} id={id}>
      {({ id: fieldId, describedBy, invalid: errInvalid }) => {
        const isInvalid = errInvalid || invalid;
        const input = (
          <input
            id={fieldId}
            type={type}
            className="input is-input"
            value={current}
            onChange={handleChange}
            readOnly={readOnly}
            disabled={disabled}
            aria-invalid={isInvalid || undefined}
            aria-describedby={describedBy}
            {...rest}
          />
        );
        return IconLeft ? (
          <div className="input-ico">
            <IconLeft className="lucide" aria-hidden="true" />
            {input}
          </div>
        ) : (
          input
        );
      }}
    </Field>
  );
}

/**
 * Textarea — the multi-line sibling of Input. Renders `textarea.input.is-input` (the CSS gives it an
 * auto height with a min of one control row and vertical resize). Same label/hint/error and
 * controlled/uncontrolled wiring as Input.
 *
 * @param {Object} props
 * @param {React.ReactNode} [props.label] - label above the field.
 * @param {React.ComponentType<{size?:number}>} [props.lock] - optional lucide icon beside the label (.is-lk).
 * @param {string} [props.hint] - helper text under the field.
 * @param {string} [props.error] - error message; non-empty marks the field invalid.
 * @param {boolean} [props.invalid=false] - force the invalid border (sets aria-invalid).
 * @param {number} [props.rows=3] - visible rows.
 * @param {boolean} [props.readOnly=false] - native readonly.
 * @param {boolean} [props.disabled=false] - native disabled.
 * @param {string} [props.value] - controlled value.
 * @param {string} [props.defaultValue] - initial value for uncontrolled use.
 * @param {(e:React.ChangeEvent<HTMLTextAreaElement>)=>void} [props.onChange] - change handler.
 * @param {string} [props.id] - id; auto-generated + associated with the label when omitted.
 * @returns {JSX.Element}
 */
export function Textarea({
  label,
  lock,
  hint,
  error,
  invalid = false,
  rows = 3,
  readOnly = false,
  disabled = false,
  value,
  defaultValue,
  onChange,
  id,
  ...rest
}) {
  const [current, handleChange] = useControllable(value, defaultValue, onChange);
  return (
    <Field label={label} lock={lock} hint={hint} error={error} id={id}>
      {({ id: fieldId, describedBy, invalid: errInvalid }) => (
        <textarea
          id={fieldId}
          className="input is-input"
          rows={rows}
          value={current}
          onChange={handleChange}
          readOnly={readOnly}
          disabled={disabled}
          aria-invalid={errInvalid || invalid || undefined}
          aria-describedby={describedBy}
          {...rest}
        />
      )}
    </Field>
  );
}

/**
 * Select — a styled native `<select>` inside a `.select-wrap` with a trailing ChevronDown (the chevron
 * is decorative and ignores pointer events per the CSS). Pass options either as `children` (raw
 * `<option>` elements) or an `options` array of {value,label}. Same label/hint/error +
 * controlled/uncontrolled wiring as Input.
 *
 * Emits `<div class="is-field"><label/><div class="select-wrap"><select class="select"/>chevron</div>…</div>`.
 *
 * @param {Object} props
 * @param {React.ReactNode} [props.label] - label above the field.
 * @param {React.ComponentType<{size?:number}>} [props.lock] - optional lucide icon beside the label (.is-lk).
 * @param {string} [props.hint] - helper text under the field.
 * @param {string} [props.error] - error message; non-empty marks the field invalid.
 * @param {boolean} [props.invalid=false] - force the invalid border (sets aria-invalid).
 * @param {{value:string,label:string}[]} [props.options] - option list; alternative to passing <option> children.
 * @param {React.ReactNode} [props.children] - raw <option> elements (used when `options` is omitted).
 * @param {boolean} [props.disabled=false] - native disabled.
 * @param {string} [props.value] - controlled value.
 * @param {string} [props.defaultValue] - initial value for uncontrolled use.
 * @param {(e:React.ChangeEvent<HTMLSelectElement>)=>void} [props.onChange] - change handler.
 * @param {string} [props.id] - id; auto-generated + associated with the label when omitted.
 * @returns {JSX.Element}
 */
export function Select({
  label,
  lock,
  hint,
  error,
  invalid = false,
  options,
  children,
  disabled = false,
  value,
  defaultValue,
  onChange,
  id,
  ...rest
}) {
  const [current, handleChange] = useControllable(value, defaultValue, onChange);
  return (
    <Field label={label} lock={lock} hint={hint} error={error} id={id}>
      {({ id: fieldId, describedBy, invalid: errInvalid }) => (
        <div className="select-wrap">
          <select
            id={fieldId}
            className="select"
            value={current}
            onChange={handleChange}
            disabled={disabled}
            aria-invalid={errInvalid || invalid || undefined}
            aria-describedby={describedBy}
            {...rest}
          >
            {options
              ? options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))
              : children}
          </select>
          <ChevronDown className="lucide" aria-hidden="true" />
        </div>
      )}
    </Field>
  );
}
