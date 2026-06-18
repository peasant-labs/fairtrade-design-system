import { ChevronRight, Check } from 'lucide-react';

/**
 * @typedef {Object} CrumbItem
 * @property {string} label - the crumb text
 * @property {string} [href] - optional link target; when present the crumb renders as an <a>
 * @property {React.ComponentType<{className?: string}>} [icon] - optional leading lucide icon component (e.g. icon={Folder})
 */

/**
 * Breadcrumb — names the path back. Items are joined by ChevronRight separators;
 * the last item is marked `.cur` (bold ink) as the current location.
 *
 * Emits `<nav><div class="crumb">…</div></nav>` matching src/index.css with zero new CSS.
 *
 * @param {Object} props
 * @param {CrumbItem[]} props.items - ordered crumbs from root to current; the last is the current page.
 * @param {string} [props.label='breadcrumb'] - aria-label for the nav landmark.
 * @returns {JSX.Element}
 */
export default function Breadcrumb({ items = [], label = 'breadcrumb' }) {
  return (
    <nav aria-label={label}>
      <div className="crumb">
        {items.map((item, i) => {
          const isCur = i === items.length - 1;
          const Icon = item.icon;
          const content = (
            <span className="crumb-item">
              {Icon ? <Icon className="lucide" aria-hidden="true" /> : null}
              {item.label}
            </span>
          );
          return (
            <span key={item.href || item.label + i} style={{ display: 'contents' }}>
              {item.href && !isCur ? (
                <a href={item.href}>{content}</a>
              ) : isCur ? (
                <span className="cur" aria-current="page">
                  {content}
                </span>
              ) : (
                content
              )}
              {!isCur ? <ChevronRight className="lucide" aria-hidden="true" /> : null}
            </span>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * @typedef {Object} StepItem
 * @property {string} label - the step text
 * @property {'done'|'cur'|'todo'} [status='todo'] - 'done' shows a Check, 'cur' is the active step, 'todo' shows its number.
 */

/**
 * Steps — a step wizard marking progress through a flow. Completed steps show a Check,
 * the current step is highlighted (amber number), pending steps show their index.
 * Steps are joined by `.step-line` dividers. State reads from icon/number, never color alone.
 *
 * Emits `<div class="steps">…</div>` matching src/index.css with zero new CSS.
 *
 * @param {Object} props
 * @param {StepItem[]} props.steps - ordered steps; numbering is derived from position (1-based).
 * @returns {JSX.Element}
 */
export function Steps({ steps = [] }) {
  return (
    <div className="steps">
      {steps.map((step, i) => {
        const status = step.status || 'todo';
        const cls =
          'step' + (status === 'done' ? ' done' : status === 'cur' ? ' cur' : '');
        return (
          <span key={step.label + i} style={{ display: 'contents' }}>
            <span className={cls}>
              <span className="num tnum">
                {status === 'done' ? (
                  <Check className="lucide" aria-hidden="true" />
                ) : (
                  i + 1
                )}
              </span>{' '}
              {step.label}
            </span>
            {i < steps.length - 1 ? <span className="step-line" /> : null}
          </span>
        );
      })}
    </div>
  );
}
