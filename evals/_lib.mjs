/** Tiny eval harness lib — assertion collector shared by all fixtures. */
export function suite(name) {
  const failures = [];
  let pass = 0;
  return {
    name,
    ok(label, cond, detail = '') {
      if (cond) pass++;
      else failures.push(`${label}${detail ? ' — ' + detail : ''}`);
    },
    eq(label, got, want, tol = 0.005) {
      const numeric = typeof want === 'number';
      const same = numeric ? Math.abs((got ?? NaN) - want) < tol : got === want;
      this.ok(label, same, numeric ? `got ${got}, want ${want}` : `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
    },
    done() { return { pass, fail: failures.length, failures }; },
  };
}
