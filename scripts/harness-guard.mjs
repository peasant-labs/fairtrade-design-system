/* Shared harness guard: make a runaway fail fast instead of hanging or
   exhausting the machine.

   These bespoke Vite + jsdom harnesses previously had no bound at all: a bad
   assertion on a DOM node could build a multi-gigabyte inspect string, and a
   wedged browser navigation could block forever. The guard fails the RUN with
   a named reason so the fault is visible instead of silent.

   The ceiling is a resident-memory (RSS) check rather than a V8 heap cap,
   because that failure mode grew native memory while the V8 heap stayed flat;
   --max-old-space-size would never have caught it.

   Both bounds are overridable for slower CI:
     HARNESS_DEADLINE_MS   wall-clock deadline
     HARNESS_RSS_CEILING_MB resident-memory ceiling */

const DEFAULTS = { deadlineMs: 180_000, rssCeilingMb: 1536, intervalMs: 100 }

/**
 * Install the guard. Returns a disposer; the timer is unref'd so a passing run
 * is never held open by the guard itself.
 *
 * @param {{ label: string, deadlineMs?: number, rssCeilingMb?: number, intervalMs?: number }} options
 * @returns {() => void}
 */
export function installHarnessGuard({ label, deadlineMs, rssCeilingMb, intervalMs } = {}) {
  const deadline = Number(process.env.HARNESS_DEADLINE_MS || deadlineMs || DEFAULTS.deadlineMs)
  const ceiling = Number(process.env.HARNESS_RSS_CEILING_MB || rssCeilingMb || DEFAULTS.rssCeilingMb)
  const every = Number(intervalMs || DEFAULTS.intervalMs)
  const startedAt = Date.now()
  const timer = setInterval(() => {
    const rssMb = process.memoryUsage().rss / 1048576
    if (rssMb > ceiling) {
      throw new Error(`harness guard: ${label} reached ${Math.round(rssMb)}MB resident, above the ${ceiling}MB ceiling; failing before the machine is endangered.`)
    }
    const elapsed = Date.now() - startedAt
    if (elapsed > deadline) {
      throw new Error(`harness guard: ${label} ran ${elapsed}ms, past the ${deadline}ms deadline; failing rather than hanging.`)
    }
  }, every)
  timer.unref()
  return () => clearInterval(timer)
}
