/* global process */
const os = require('os')
const args = require('yargs').argv

const DEFAULT_GREP = /.*/
const grep = args.grep ? new RegExp(args.grep) : DEFAULT_GREP

const benchmarks = require('./benchmarks')

const runOne = async (benchmark) => {
  console.log(`\rRunning ${benchmark.name}`)

  let stats = {
    count: 0
  }

  let memory = {
    before: process.memoryUsage()
  }

  const log = await benchmark.prepare()

  const startTime = process.hrtime()
  while (benchmark.while(stats, startTime)) {
    process.stdout.write(`\rCycles: ${stats.count}`)
    await benchmark.cycle(log)
    stats.count++
  }

  elapsed = process.hrtime(startTime)
  memory.after = process.memoryUsage()

  await benchmark.teardown()

  stats.avg = Math.round(stats.count / elapsed[0])
  return {
    name: benchmark.name,
    cpus: os.cpus(),
    loadavg: os.loadavg(),
    elapsed,
    stats,
    memory
  }
}

const start = async () => {
  let results = []

  try {
    for (const benchmark of benchmarks) {
      if (!grep.test(benchmark.name)) {
        continue
      }
      const result = await runOne(benchmark)
      results.push(result)
    }
    console.log(results)
  } catch (e) {
    console.log(e)
  }

  //TODO: compare/delta to cached version
}

start()