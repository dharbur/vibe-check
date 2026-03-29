const GITHUB_REPO_URL_PATTERN =
  /^https?:\/\/github\.com\/(?<owner>[^/]+)\/(?<repo>[^/]+?)(?:\.git)?(?:\/)?$/i

const SUPPORTED_EXTENSIONS = new Set(['.js', '.ts', '.tsx', '.py', '.go'])
const MAX_FILE_SIZE_BYTES = 50 * 1024
const MAX_FILES = 5

interface GitHubRepoDetails {
  default_branch: string
}

interface GitHubTreeEntry {
  path: string
  size?: number
  type: 'blob' | 'tree'
}

interface GitHubTreeResponse {
  tree?: GitHubTreeEntry[]
  truncated?: boolean
}

export interface ParsedGitHubRepo {
  owner: string
  repo: string
}

export interface FetchGitHubRepoCodeResult {
  code: string
  filesFetched: string[]
}

export function parseGitHubRepoUrl(url: string): ParsedGitHubRepo {
  const trimmedUrl = url.trim()
  const match = trimmedUrl.match(GITHUB_REPO_URL_PATTERN)

  if (!match?.groups?.owner || !match.groups.repo) {
    throw new Error('Enter a valid GitHub repo URL like https://github.com/owner/repo.')
  }

  return {
    owner: match.groups.owner,
    repo: match.groups.repo,
  }
}

function isEligibleCodeFile(entry: GitHubTreeEntry) {
  if (entry.type !== 'blob' || !entry.path || entry.path.includes('node_modules/')) {
    return false
  }

  if (typeof entry.size !== 'number' || entry.size > MAX_FILE_SIZE_BYTES) {
    return false
  }

  const lowerPath = entry.path.toLowerCase()
  return Array.from(SUPPORTED_EXTENSIONS).some((extension) =>
    lowerPath.endsWith(extension),
  )
}

async function fetchJson<T>(url: string, errorMessage: string): Promise<T> {
  const response = await fetch(url)

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(errorMessage)
    }

    throw new Error(`GitHub request failed with status ${response.status}.`)
  }

  return (await response.json()) as T
}

export async function fetchGitHubRepoCode(
  repoUrl: string,
): Promise<FetchGitHubRepoCodeResult> {
  const { owner, repo } = parseGitHubRepoUrl(repoUrl)

  const repoDetails = await fetchJson<GitHubRepoDetails>(
    `https://api.github.com/repos/${owner}/${repo}`,
    'GitHub repo not found. Double-check the owner and repo name.',
  )

  const treeResponse = await fetchJson<GitHubTreeResponse>(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`,
    'Could not fetch the repository tree from GitHub.',
  )

  const eligibleFiles = (treeResponse.tree ?? [])
    .filter(isEligibleCodeFile)
    .sort((left, right) => left.path.localeCompare(right.path))
    .slice(0, MAX_FILES)

  if (eligibleFiles.length === 0) {
    throw new Error(
      'No supported code files were found. Try a repo with js, ts, tsx, py, or go files under 50kb.',
    )
  }

  const fileContents = await Promise.all(
    eligibleFiles.map(async (file) => {
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${repoDetails.default_branch}/${file.path}`
      const response = await fetch(rawUrl)

      if (!response.ok) {
        throw new Error(`Failed to fetch ${file.path} from GitHub.`)
      }

      const content = await response.text()
      return `// File: ${file.path}\n${content}`.trim()
    }),
  )

  return {
    code: fileContents.join('\n\n'),
    filesFetched: eligibleFiles.map((file) => file.path),
  }
}
