export const VERSION = '0.1.0'
export const MIN_NODE = '22.13.0'
export const PRODUCT = 'DOC CLI'

export function compareSemver(a: string, b: string): number {
  const parse = (v: string) => {
    const clean = v.replace(/^v/, '')
    const [core = '', pre = ''] = clean.split('+')[0]!.split('-', 2) as [string, string?]
    const nums = core.split('.').map((n) => Number.parseInt(n, 10) || 0)
    while (nums.length < 3) nums.push(0)
    return { nums, pre: pre ?? '' }
  }
  const pa = parse(a)
  const pb = parse(b)
  for (let i = 0; i < 3; i++) {
    const d = (pa.nums[i] ?? 0) - (pb.nums[i] ?? 0)
    if (d !== 0) return d < 0 ? -1 : 1
  }
  if (pa.pre === pb.pre) return 0
  if (pa.pre === '') return 1
  if (pb.pre === '') return -1
  return pa.pre < pb.pre ? -1 : 1
}

export function nodeSupported(version: string, min = MIN_NODE): boolean {
  return compareSemver(version, min) >= 0
}
