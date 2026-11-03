import autocannon from "autocannon";
import fs from "fs";
import path from "path";

const BASE_URL = "http://localhost:3000";

const scenarios = [
  {
    name: "Scenario 1: Home Page (/) - Peak Browsing Traffic",
    url: `${BASE_URL}/`,
    method: "GET",
    connections: 25,
    duration: 5,
  },
  {
    name: "Scenario 2: Menu Page (/menu) - Catalog Exploration",
    url: `${BASE_URL}/menu`,
    method: "GET",
    connections: 25,
    duration: 5,
  },
  {
    name: "Scenario 3: Biryani Picker (/biryani) - Weight Calculator",
    url: `${BASE_URL}/biryani`,
    method: "GET",
    connections: 25,
    duration: 5,
  },
  {
    name: "Scenario 4: High Concurrency Burst (/) - Lunch/Dinner Rush (100 Connections)",
    url: `${BASE_URL}/`,
    method: "GET",
    connections: 100,
    duration: 5,
  },
  {
    name: "Scenario 5: Ola Maps Autocomplete API Gate (/api/maps/autocomplete)",
    url: `${BASE_URL}/api/maps/autocomplete?q=JP+Nagar`,
    method: "GET",
    connections: 30,
    duration: 5,
  },
  {
    name: "Scenario 6: Payment Order Creation Gate (/api/payments/create-order)",
    url: `${BASE_URL}/api/payments/create-order`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mealSlot: "Lunch", items: [{ menuId: "biryani-chicken-1kg", qty: 1 }] }),
    connections: 30,
    duration: 5,
  },
];

async function runScenario(scenario) {
  console.log(`\n==========================================================`);
  console.log(`  RUNNING: ${scenario.name}`);
  console.log(`  Target: ${scenario.url} | Connections: ${scenario.connections} | Duration: ${scenario.duration}s`);
  console.log(`==========================================================`);

  return new Promise((resolve, reject) => {
    autocannon(
      {
        url: scenario.url,
        method: scenario.method || "GET",
        headers: scenario.headers || {},
        body: scenario.body || undefined,
        connections: scenario.connections,
        duration: scenario.duration,
        pipelining: 1,
      },
      (err, result) => {
        if (err) return reject(err);
        
        console.log(`  -> Total Requests: ${result.requests.total}`);
        console.log(`  -> Requests/sec (Avg): ${result.requests.average.toFixed(1)} req/s`);
        console.log(`  -> Throughput: ${(result.throughput.average / (1024 * 1024)).toFixed(2)} MB/s`);
        console.log(`  -> Latency p50: ${result.latency.p50} ms`);
        console.log(`  -> Latency p90: ${result.latency.p90} ms`);
        console.log(`  -> Latency p99: ${result.latency.p99} ms`);
        console.log(`  -> Non-2xx Responses: ${result.non2xx || 0}`);
        console.log(`  -> 1xx/2xx/3xx/4xx/5xx Breakdown:`, result.statusCodeStats || {});
        resolve({
          name: scenario.name,
          url: scenario.url,
          connections: scenario.connections,
          duration: scenario.duration,
          requests: result.requests,
          latency: result.latency,
          throughput: result.throughput,
          errors: result.errors,
          timeouts: result.timeouts,
          non2xx: result.non2xx,
          statusCodeStats: result.statusCodeStats,
        });
      }
    );
  });
}

async function main() {
  console.log("==========================================================");
  console.log("       RAKU'S KITCHEN — COMPREHENSIVE LOAD TEST SUITE     ");
  console.log("==========================================================");

  const results = [];
  for (const s of scenarios) {
    try {
      const res = await runScenario(s);
      results.push(res);
      // Brief cooldown between scenarios
      await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      console.error(`Error executing ${s.name}:`, e);
    }
  }

  const reportPath = path.resolve("./docs/LOAD_TEST_RESULTS.json");
  fs.writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2));

  console.log("\n==========================================================");
  console.log("                 LOAD TEST SUMMARY TABLE                  ");
  console.log("==========================================================");
  console.table(
    results.map(r => ({
      Scenario: r.name.split(":")[0],
      Connections: r.connections,
      "Total Req": r.requests.total,
      "Req/sec": r.requests.average.toFixed(1),
      "p50 Latency": `${r.latency.p50} ms`,
      "p90 Latency": `${r.latency.p90} ms`,
      "p99 Latency": `${r.latency.p99} ms`,
      "Non-2xx": r.non2xx,
      Timeouts: r.timeouts,
    }))
  );
  console.log(`\nDetailed raw metrics written to: ${reportPath}`);
}

main();
