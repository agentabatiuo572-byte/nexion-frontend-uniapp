import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const reportPath = process.argv[2]

if (!reportPath) {
  console.error('Usage: npm run qa:page -- <report-file>')
  process.exit(2)
}

const absolutePath = resolve(reportPath)
let report

try {
  report = JSON.parse(readFileSync(absolutePath, 'utf8'))
} catch (error) {
  console.error(`Failed to read QA report: ${absolutePath}`)
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(2)
}

const requiredTextFields = [
  'pageName',
  'prototypeRoute',
  'uniappRoute',
  'prototypeScreenshot',
  'uniappScreenshot'
]

const missingFields = requiredTextFields.filter((field) => {
  return typeof report[field] !== 'string' || report[field].trim() === ''
})

if (missingFields.length > 0) {
  console.error(`Missing required fields: ${missingFields.join(', ')}`)
  process.exit(1)
}

const weights = {
  visualFidelity: 35,
  interactionCompleteness: 25,
  backendIntegration: 25,
  appAdaptation: 15
}

const score = report.score ?? {}
const errors = []
let total = 0

for (const [field, max] of Object.entries(weights)) {
  const value = Number(score[field])
  if (!Number.isFinite(value) || value < 0 || value > max) {
    errors.push(`${field} must be a number between 0 and ${max}`)
    continue
  }
  total += value
}

if (!Array.isArray(report.checks) || report.checks.length === 0) {
  errors.push('checks must contain at least one item')
}

if (!Array.isArray(report.differences)) {
  errors.push('differences must be an array')
}

if (report.accepted !== true) {
  errors.push('accepted must be true for a passing report')
}

if (errors.length > 0) {
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log(`QA score for ${report.pageName}: ${total}/100`)

if (total < 95) {
  console.error('Page QA failed: score must be at least 95/100')
  process.exit(1)
}

console.log('Page QA passed')
