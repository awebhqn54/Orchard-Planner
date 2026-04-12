/**
 * Rootstock-aware mature size research workflow using Firecrawl.
 *
 * Usage:
 *   node scripts/research-mature-size.mjs queue
 *   node scripts/research-mature-size.mjs run [--queue <path>] [--concurrency <n>] [--limit <n>]
 *   node scripts/research-mature-size.mjs report [--queue <path>] [--candidates <path>]
 *   node scripts/research-mature-size.mjs apply-approved --approved <path>
 */
import { spawn } from 'child_process'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')
const firecrawlRoot = join(repoRoot, '.firecrawl', 'mature-size-research')
const generatedPath = join(repoRoot, 'src', 'data', 'tendolleSheetExtract.generated.ts')
const overridesPath = join(repoRoot, 'src', 'data', 'matureSizeResearchOverrides.ts')

function ensureDirs() {
  mkdirSync(firecrawlRoot, { recursive: true })
}

function nowRunId() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

function parseArgs(argv) {
  const args = { _: [] }
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) {
      args._.push(token)
      continue
    }
    const key = token.slice(2)
    const value = argv[i + 1]
    if (!value || value.startsWith('--')) {
      args[key] = true
      continue
    }
    args[key] = value
    i += 1
  }
  return args
}

function runCommand(command, cmdArgs, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, cmdArgs, {
      cwd: repoRoot,
      stdio: opts.captureOutput ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      env: process.env,
    })

    let stdout = ''
    let stderr = ''
    if (opts.captureOutput) {
      child.stdout?.on('data', (chunk) => {
        stdout += chunk.toString()
      })
      child.stderr?.on('data', (chunk) => {
        stderr += chunk.toString()
      })
    }

    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr })
        return
      }
      reject(new Error(`${command} ${cmdArgs.join(' ')} failed with exit code ${code}\n${stderr}`))
    })
  })
}

function normalizeRootstockKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function normalizeVendorFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return undefined
  }
}

function normalizeMatureSizeLabel(value) {
  const text = String(value || '').toLowerCase()
  if (/\bsemi[\s-]?dwarf\b/.test(text)) return 'semi-dwarf'
  if (/\bdwarf\b/.test(text)) return 'dwarf'
  if (/\bcolumnar\b/.test(text)) return 'columnar'
  if (/\bstandard\b/.test(text)) return 'standard'
  return 'unknown'
}

function parseRangeOrSingleFeet(value) {
  const range = String(value || '').match(/(\d+(?:\.\d+)?)\s*(?:to|[-–])\s*(\d+(?:\.\d+)?)/i)
  if (range) {
    const low = Number(range[1])
    const high = Number(range[2])
    if (Number.isFinite(low) && Number.isFinite(high)) {
      return Math.round((low + high) / 2)
    }
  }
  const single = String(value || '').match(/(\d+(?:\.\d+)?)/)
  if (!single) return undefined
  const n = Number(single[1])
  return Number.isFinite(n) ? Math.round(n) : undefined
}

function parseHeightFeetFromText(value) {
  if (!value) return undefined
  const explicit = String(value).match(
    /(mature\s+height|height)\s*[:\-]?\s*(\d+(?:\.\d+)?(?:\s*(?:to|[-–])\s*\d+(?:\.\d+)?)?)/i,
  )
  if (explicit) return parseRangeOrSingleFeet(explicit[2])
  const withFeet = String(value).match(/(\d+(?:\.\d+)?(?:\s*(?:to|[-–])\s*\d+(?:\.\d+)?)?)\s*(?:ft|feet|foot)\b/i)
  if (withFeet) return parseRangeOrSingleFeet(withFeet[1])
  return undefined
}

function parseWidthFeetFromText(value) {
  if (!value) return undefined
  const explicit = String(value).match(
    /(mature\s+(?:width|spread|canopy)|spread|canopy)\s*[:\-]?\s*(\d+(?:\.\d+)?(?:\s*(?:to|[-–])\s*\d+(?:\.\d+)?)?)/i,
  )
  if (explicit) return parseRangeOrSingleFeet(explicit[2])
  return undefined
}

function parseObjectBlocks(arrayBody) {
  const blocks = arrayBody.match(/  \{[\s\S]*?\n  \},?/g) ?? []
  return blocks
    .map((block) => {
      const record = {}
      const fieldLines = block.split('\n').map((line) => line.trim())
      for (const line of fieldLines) {
        const hit = line.match(/^([A-Za-z0-9_]+): (.+),$/)
        if (!hit) continue
        const [, key, rawValue] = hit
        if (rawValue.startsWith('"')) {
          record[key] = JSON.parse(rawValue)
        } else if (rawValue === 'true' || rawValue === 'false') {
          record[key] = rawValue === 'true'
        } else if (/^-?\d+(\.\d+)?$/.test(rawValue)) {
          record[key] = Number(rawValue)
        }
      }
      return record
    })
    .filter((record) => record.id && record.varietyName)
}

function parseGeneratedRecords() {
  const src = readFileSync(generatedPath, 'utf8')
  const activeStart = src.indexOf('export const tendolleInventoryRecordsRaw: TreeSeedRecord[] = [')
  const inactiveStart = src.indexOf('export const tendolleInactiveInventoryRecordsRaw: TreeSeedRecord[] = [')
  if (activeStart < 0 || inactiveStart < 0) {
    throw new Error('Could not locate generated record arrays in tendolleSheetExtract.generated.ts')
  }

  const activeBodyStart = src.indexOf('[', activeStart) + 1
  const activeBodyEnd = src.indexOf(']\n\nexport const tendolleInactiveInventoryRecordsRaw', activeBodyStart)
  const inactiveBodyStart = src.indexOf('[', inactiveStart) + 1
  const inactiveBodyEnd = src.lastIndexOf(']\n')

  const active = parseObjectBlocks(src.slice(activeBodyStart, activeBodyEnd))
  const inactive = parseObjectBlocks(src.slice(inactiveBodyStart, inactiveBodyEnd))
  return { active, inactive }
}

function createQueueFile() {
  ensureDirs()
  const { active } = parseGeneratedRecords()
  const queue = active
    .filter((record) => record.quantity > 0 && record.link)
    .map((record) => ({
      recordId: record.id,
      varietyName: record.varietyName,
      supplier: record.supplier ?? null,
      rootstockCode: record.rootstockCode ?? null,
      rootstock: record.rootstock ?? null,
      link: record.link,
      existingMatureHeightFt: record.matureHeightFt ?? null,
      existingMatureWidthFt: record.matureWidthFt ?? null,
      existingMatureSizeText: record.matureSizeText ?? null,
    }))
  const queuePath = join(firecrawlRoot, 'queue.json')
  writeFileSync(queuePath, JSON.stringify(queue, null, 2))
  console.log(`Wrote ${queue.length} queue rows to ${queuePath}`)
  return queuePath
}

function writeAgentSchema(schemaPath) {
  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      matchedRootstock: { type: 'string' },
      matchConfidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      variantEvidence: { type: 'string' },
      matureHeightFt: { type: 'number' },
      matureWidthFt: { type: 'number' },
      matureSizeText: { type: 'string' },
      matureSizeLabel: { type: 'string', enum: ['dwarf', 'semi-dwarf', 'standard', 'columnar', 'unknown'] },
      notes: { type: 'string' },
    },
    required: ['matchConfidence'],
  }
  writeFileSync(schemaPath, JSON.stringify(schema, null, 2))
}

function firstObjectCandidate(value) {
  if (!value || typeof value !== 'object') {
    return null
  }
  const objectKeys = ['matchedRootstock', 'matchConfidence', 'matureHeightFt', 'matureWidthFt', 'matureSizeText']
  const hasTargetKey = objectKeys.some((key) => Object.prototype.hasOwnProperty.call(value, key))
  if (hasTargetKey) {
    return value
  }
  for (const nested of Object.values(value)) {
    const hit = firstObjectCandidate(nested)
    if (hit) return hit
  }
  return null
}

function parseAgentResult(agentPath) {
  if (!existsSync(agentPath)) {
    return null
  }
  try {
    const parsed = JSON.parse(readFileSync(agentPath, 'utf8'))
    return firstObjectCandidate(parsed)
  } catch {
    return null
  }
}

function extractEvidenceFromMarkdown(markdownPath) {
  if (!existsSync(markdownPath)) {
    return ''
  }
  const raw = readFileSync(markdownPath, 'utf8')
  const lines = raw.split('\n')
  const matching = lines.filter((line) => /mature|height|spread|canopy|rootstock|dwarf|standard/i.test(line))
  return matching.slice(0, 6).join(' ').slice(0, 400)
}

function chooseConfidence(agentOutput, expectedRootstock) {
  const byAgent = String(agentOutput?.matchConfidence || '').toLowerCase()
  if (['high', 'medium', 'low'].includes(byAgent)) {
    return byAgent
  }
  const matched = normalizeRootstockKey(agentOutput?.matchedRootstock)
  const expected = normalizeRootstockKey(expectedRootstock)
  if (matched && expected && matched === expected) {
    return 'high'
  }
  if (matched || expected) {
    return 'medium'
  }
  return 'low'
}

function buildCandidate(queueRow, scrapePath, agentPath) {
  const agentOutput = parseAgentResult(agentPath) ?? {}
  const evidenceSnippet = String(agentOutput.variantEvidence || '').trim() || extractEvidenceFromMarkdown(scrapePath)

  const candidateHeight =
    Number.isFinite(agentOutput.matureHeightFt) && agentOutput.matureHeightFt > 0
      ? Math.round(agentOutput.matureHeightFt)
      : parseHeightFeetFromText(`${agentOutput.matureSizeText || ''} ${evidenceSnippet}`)
  const candidateWidth =
    Number.isFinite(agentOutput.matureWidthFt) && agentOutput.matureWidthFt > 0
      ? Math.round(agentOutput.matureWidthFt)
      : parseWidthFeetFromText(`${agentOutput.matureSizeText || ''} ${evidenceSnippet}`)
  const sizeText = String(agentOutput.matureSizeText || '').trim()
  const matchedRootstock = String(agentOutput.matchedRootstock || '').trim()
  const confidence = chooseConfidence(agentOutput, queueRow.rootstockCode || queueRow.rootstock)
  const normalizedLabel = normalizeMatureSizeLabel(agentOutput.matureSizeLabel || sizeText || evidenceSnippet)

  return {
    recordId: queueRow.recordId,
    rootstockCode: queueRow.rootstockCode || undefined,
    rootstock: queueRow.rootstock || undefined,
    matureSizeResearch: {
      researchedMatureHeightFt: candidateHeight,
      researchedMatureWidthFt: candidateWidth,
      researchedSizeLabel: normalizedLabel,
      researchSourceUrl: queueRow.link,
      researchSourceVendor: normalizeVendorFromUrl(queueRow.link),
      researchEvidenceSnippet: evidenceSnippet || undefined,
      researchMatchedRootstock: matchedRootstock || undefined,
      researchConfidence: confidence,
      researchApproved: false,
    },
  }
}

async function runQueue(args) {
  ensureDirs()
  const queuePath = args.queue ? join(repoRoot, args.queue) : join(firecrawlRoot, 'queue.json')
  if (!existsSync(queuePath)) {
    throw new Error(`Queue file not found: ${queuePath}. Run queue command first.`)
  }
  const runId = nowRunId()
  const runDir = join(firecrawlRoot, runId)
  mkdirSync(runDir, { recursive: true })
  const scrapeDir = join(runDir, 'scrapes')
  const agentDir = join(runDir, 'agent')
  mkdirSync(scrapeDir, { recursive: true })
  mkdirSync(agentDir, { recursive: true })
  const schemaPath = join(runDir, 'rootstock-schema.json')
  writeAgentSchema(schemaPath)

  await runCommand('firecrawl', ['--status'])
  const queueRows = JSON.parse(readFileSync(queuePath, 'utf8'))
  const limit = args.limit ? Number(args.limit) : undefined
  const selectedRows = Number.isFinite(limit) && limit > 0 ? queueRows.slice(0, limit) : queueRows
  const concurrency = Math.max(1, Number(args.concurrency || 4))
  const maxCreditsPerAgent = Math.max(10, Number(args.maxCredits || 30))

  const candidates = []
  const errors = []
  let cursor = 0
  async function worker() {
    while (cursor < selectedRows.length) {
      const current = selectedRows[cursor]
      cursor += 1
      const baseName = current.recordId.replace(/[^a-z0-9-]+/gi, '-').toLowerCase()
      const scrapePath = join(scrapeDir, `${baseName}.md`)
      const agentPath = join(agentDir, `${baseName}.json`)

      await runCommand('firecrawl', ['scrape', current.link, '--only-main-content', '--wait-for', '2500', '-o', scrapePath])
      const taskPrompt = [
        `You are matching tree variant/rootstock on a product page.`,
        `Expected rootstock code: ${current.rootstockCode || 'unknown'}.`,
        `Fallback rootstock text: ${current.rootstock || 'unknown'}.`,
        `Return mature tree size for the matching variant only.`,
        `If uncertain, set matchConfidence=low and explain in variantEvidence.`,
      ].join(' ')
      try {
        await runCommand('firecrawl', [
          'agent',
          taskPrompt,
          '--urls',
          current.link,
          '--schema-file',
          schemaPath,
          '--max-credits',
          String(maxCreditsPerAgent),
          '--wait',
          '--json',
          '-o',
          agentPath,
        ])
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        errors.push({
          recordId: current.recordId,
          stage: 'agent',
          message,
        })
        // Keep pipeline moving: scrape-only evidence still produces a candidate row for manual review.
        if (!existsSync(agentPath)) {
          writeFileSync(
            agentPath,
            JSON.stringify(
              {
                matchConfidence: 'low',
                variantEvidence: `Agent extraction failed; fallback to scrape evidence. ${message}`,
              },
              null,
              2,
            ),
          )
        }
      }

      candidates.push(buildCandidate(current, scrapePath, agentPath))
      console.log(`Processed ${current.recordId}`)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, selectedRows.length) }, () => worker()))

  const candidatePath = join(runDir, 'candidates.json')
  writeFileSync(candidatePath, JSON.stringify(candidates, null, 2))
  if (errors.length > 0) {
    writeFileSync(join(runDir, 'errors.json'), JSON.stringify(errors, null, 2))
  }
  writeFileSync(join(firecrawlRoot, 'latest-run.txt'), `${runId}\n`, 'utf8')
  console.log(`Wrote ${candidates.length} candidate rows to ${candidatePath}`)
  if (errors.length > 0) {
    console.log(`Completed with ${errors.length} non-fatal agent errors (see ${join(runDir, 'errors.json')})`)
  }
  console.log(`Run directory: ${runDir}`)
}

function loadLatestRunDir() {
  const latestPath = join(firecrawlRoot, 'latest-run.txt')
  if (!existsSync(latestPath)) {
    return null
  }
  const runId = readFileSync(latestPath, 'utf8').trim()
  return runId ? join(firecrawlRoot, runId) : null
}

function formatReviewReport(queueRows, candidates) {
  const lowConfidence = candidates.filter((item) => item.matureSizeResearch?.researchConfidence === 'low')
  const missingMatureData = candidates.filter(
    (item) =>
      item.matureSizeResearch?.researchedMatureHeightFt === undefined &&
      item.matureSizeResearch?.researchedMatureWidthFt === undefined,
  )
  const lines = [
    '# Mature Size Research Review',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Rows in queue: ${queueRows.length}`,
    `Candidates generated: ${candidates.length}`,
    '',
    '## Requires review',
    '',
    `- Low confidence matches: ${lowConfidence.length}`,
    `- Missing mature height/width extraction: ${missingMatureData.length}`,
    '',
    '## Candidate preview',
    '',
  ]

  for (const candidate of candidates) {
    const queueRow = queueRows.find((row) => row.recordId === candidate.recordId)
    const matched = candidate.matureSizeResearch?.researchMatchedRootstock || 'none'
    const confidence = candidate.matureSizeResearch?.researchConfidence || 'low'
    lines.push(
      `- **${candidate.recordId}** (${queueRow?.varietyName || 'Unknown'}) — expected: \`${queueRow?.rootstockCode || queueRow?.rootstock || 'unknown'}\`; matched: \`${matched}\`; confidence: \`${confidence}\`; height: \`${candidate.matureSizeResearch?.researchedMatureHeightFt ?? 'n/a'}\`; width: \`${candidate.matureSizeResearch?.researchedMatureWidthFt ?? 'n/a'}\``,
    )
  }

  lines.push('', '## Approval instructions', '')
  lines.push(
    '- Copy `candidates.json` to `approved.json`, keep only reviewed rows, and set `matureSizeResearch.researchApproved = true` plus `researchReviewedAt`.',
  )
  lines.push('- Then run: `node scripts/research-mature-size.mjs apply-approved --approved <path-to-approved.json>`')
  lines.push(
    '- Only approved rows are written to `src/data/matureSizeResearchOverrides.ts`; unapproved rows are ignored by enrichment.',
  )
  lines.push('')
  return lines.join('\n')
}

function runReport(args) {
  ensureDirs()
  const runDir = args.run ? join(firecrawlRoot, args.run) : loadLatestRunDir()
  if (!runDir) {
    throw new Error('No run directory found. Run the queue/run commands first.')
  }
  const queuePath = args.queue ? join(repoRoot, args.queue) : join(firecrawlRoot, 'queue.json')
  const candidatePath = args.candidates ? join(repoRoot, args.candidates) : join(runDir, 'candidates.json')
  const queueRows = JSON.parse(readFileSync(queuePath, 'utf8'))
  const candidates = JSON.parse(readFileSync(candidatePath, 'utf8'))
  const report = formatReviewReport(queueRows, candidates)
  const reportPath = join(runDir, 'review-report.md')
  writeFileSync(reportPath, report)
  console.log(`Wrote review report to ${reportPath}`)
}

function tsString(value) {
  return JSON.stringify(String(value))
}

function tsNumber(value) {
  return Number.isFinite(value) ? `${Math.round(value)}` : undefined
}

function serializeApprovedOverrides(rows) {
  const blocks = rows.map((row) => {
    const lines = ['  {', `    recordId: ${tsString(row.recordId)},`]
    if (row.rootstockCode) {
      lines.push(`    rootstockCode: ${tsString(row.rootstockCode)},`)
    }
    if (row.rootstock) {
      lines.push(`    rootstock: ${tsString(row.rootstock)},`)
    }
    const research = row.matureSizeResearch || {}
    lines.push('    matureSizeResearch: {')
    const height = tsNumber(research.researchedMatureHeightFt)
    const width = tsNumber(research.researchedMatureWidthFt)
    if (height) lines.push(`      researchedMatureHeightFt: ${height},`)
    if (width) lines.push(`      researchedMatureWidthFt: ${width},`)
    if (research.researchedSizeLabel) lines.push(`      researchedSizeLabel: ${tsString(research.researchedSizeLabel)},`)
    if (research.researchSourceUrl) lines.push(`      researchSourceUrl: ${tsString(research.researchSourceUrl)},`)
    if (research.researchSourceVendor) lines.push(`      researchSourceVendor: ${tsString(research.researchSourceVendor)},`)
    if (research.researchEvidenceSnippet)
      lines.push(`      researchEvidenceSnippet: ${tsString(research.researchEvidenceSnippet)},`)
    if (research.researchMatchedRootstock)
      lines.push(`      researchMatchedRootstock: ${tsString(research.researchMatchedRootstock)},`)
    if (research.researchConfidence) lines.push(`      researchConfidence: ${tsString(research.researchConfidence)},`)
    if (research.researchReviewedAt) lines.push(`      researchReviewedAt: ${tsString(research.researchReviewedAt)},`)
    lines.push('      researchApproved: true,')
    lines.push('    },')
    lines.push('  },')
    return lines.join('\n')
  })

  return `import type { MatureSizeResearch } from '../types'

export interface MatureSizeResearchOverride {
  recordId: string
  /** Preferred key for variant matching when product pages have multiple rootstocks. */
  rootstockCode?: string
  /** Fallback textual rootstock matcher when no code exists. */
  rootstock?: string
  matureSizeResearch: MatureSizeResearch
}

/**
 * Manually curated mature-size research entries.
 * Notes:
 * - Keep spacing-driving fields (\`matureHeightFt\`, \`matureWidthFt\`) unchanged.
 * - Add only reviewed entries and set \`researchApproved: true\`.
 */
export const MATURE_SIZE_RESEARCH_OVERRIDES: MatureSizeResearchOverride[] = [
${blocks.join('\n')}
]
`
}

function runApplyApproved(args) {
  const approvedPath = args.approved ? join(repoRoot, args.approved) : null
  if (!approvedPath) {
    throw new Error('Missing --approved <path>')
  }
  const rows = JSON.parse(readFileSync(approvedPath, 'utf8'))
  const approved = rows.filter((row) => row?.matureSizeResearch?.researchApproved === true)
  const invalid = approved.filter((row) => !row?.matureSizeResearch?.researchReviewedAt)
  if (invalid.length > 0) {
    throw new Error('All approved rows must include matureSizeResearch.researchReviewedAt')
  }
  const out = serializeApprovedOverrides(approved)
  writeFileSync(overridesPath, out, 'utf8')
  console.log(`Wrote ${approved.length} approved rows to ${overridesPath}`)
}

function runSeedFromCandidates(args) {
  const candidatesPath = args.candidates ? join(repoRoot, args.candidates) : null
  if (!candidatesPath) {
    throw new Error('Missing --candidates <path>')
  }
  const rows = JSON.parse(readFileSync(candidatesPath, 'utf8'))
  const proposals = rows
    .filter((row) => row?.recordId && row?.matureSizeResearch)
    .map((row) => ({
      ...row,
      matureSizeResearch: {
        ...row.matureSizeResearch,
        researchApproved: false,
      },
    }))
  const out = serializeApprovedOverrides(proposals).replace(/researchApproved: true,/g, 'researchApproved: false,')
  writeFileSync(overridesPath, out, 'utf8')
  console.log(`Seeded ${proposals.length} proposal rows to ${overridesPath}`)
}

async function main() {
  const args = parseArgs(process.argv)
  const command = args._[0]

  if (!command || command === 'help') {
    console.log('Usage: node scripts/research-mature-size.mjs <queue|run|report|apply-approved> [options]')
    return
  }
  if (command === 'queue') {
    createQueueFile()
    return
  }
  if (command === 'run') {
    await runQueue(args)
    return
  }
  if (command === 'report') {
    runReport(args)
    return
  }
  if (command === 'apply-approved') {
    runApplyApproved(args)
    return
  }
  if (command === 'seed-from-candidates') {
    runSeedFromCandidates(args)
    return
  }
  throw new Error(`Unknown command: ${command}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
