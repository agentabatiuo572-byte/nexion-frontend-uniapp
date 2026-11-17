// Diagnostic-branch instrumentation. No reactive writes, timers, or event history.
export function diagnosticCounter() {
  let total = 0;
  const buckets = Array.from({ length: 10 }, () => ({ second: -1, count: 0 }));
  return {
    hit() {
      total += 1;
      const second = Math.floor(Date.now() / 1000);
      const bucket = buckets[second % 10];
      if (bucket.second !== second) { bucket.second = second; bucket.count = 0; }
      bucket.count += 1;
    },
    read() {
      const second = Math.floor(Date.now() / 1000);
      return { total, perSecond10s: buckets.reduce((sum, bucket) =>
        sum + (bucket.second > second - 10 && bucket.second <= second ? bucket.count : 0), 0) / 10 };
    },
    reset() { total = 0; buckets.forEach(bucket => { bucket.second = -1; bucket.count = 0; }); },
  };
}
