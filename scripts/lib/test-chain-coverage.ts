import fs from 'node:fs'

export function collectTestFiles(testsDir: string): string[] {
  return fs
    .readdirSync(testsDir)
    .filter((name) => name.endsWith('.test.ts'))
    .sort()
}

export function collectChainReferencedFiles(packageJsonPath: string): Set<string> {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
    scripts: Record<string, string>
  }
  const referenced = new Set<string>()
  const pattern = /tests\/([A-Za-z0-9._-]+\.test\.ts)/g

  for (const [key, command] of Object.entries(pkg.scripts)) {
    if (!key.startsWith('test:')) continue
    let match: RegExpExecArray | null
    while ((match = pattern.exec(command))) {
      referenced.add(match[1])
    }
  }

  return referenced
}

export function readExemptList(exemptListPath: string): Set<string> {
  if (!fs.existsSync(exemptListPath)) return new Set()
  return new Set(
    fs
      .readFileSync(exemptListPath, 'utf8')
      .split('\n')
      .map((line) => line.split('#')[0].trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'))
  )
}

export function computeUnapproved(
  all: string[],
  referenced: Set<string>,
  exempt: Set<string>
): { orphans: string[]; unapproved: string[] } {
  const orphans = all.filter((file) => !referenced.has(file))
  const unapproved = orphans.filter((file) => !exempt.has(file))
  return { orphans, unapproved }
}
