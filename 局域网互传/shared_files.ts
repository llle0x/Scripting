import { Path } from "scripting"

const QUEUE_KEY = "lan-transfer.pending-shared-files"
const STAGING_DIR = Path.join(FileManager.appGroupDocumentsDirectory, "lan-transfer-share-inbox")
const STAGED_FILE_TTL = 24 * 60 * 60 * 1_000

type PendingSharedFile = { path: string; createdAt: number }

function readQueue(): PendingSharedFile[] {
  const value = Storage.get<PendingSharedFile[]>(QUEUE_KEY, { shared: true })
  if (!Array.isArray(value)) return []
  const cutoff = Date.now() - STAGED_FILE_TTL
  const valid: PendingSharedFile[] = []
  for (const item of value) {
    if (!item || typeof item.path !== "string" || !isStagedSharedFile(item.path)
      || !Number.isSafeInteger(item.createdAt) || item.createdAt <= 0 || item.createdAt > Date.now()) continue
    if (item.createdAt >= cutoff) {
      valid.push(item)
      continue
    }
    try {
      const directory = Path.dirname(item.path)
      if (FileManager.existsSync(directory)) FileManager.removeSync(directory)
    } catch {}
  }
  return valid
}

function safeName(path: string): string {
  return Path.basename(path).replace(/[\\/]/g, "_").trim() || "未命名"
}

function uniqueStagingTarget(source: string): { directory: string; path: string } {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  const directory = Path.join(STAGING_DIR, id)
  return { directory, path: Path.join(directory, safeName(source)) }
}

/** Intent 入口：把安全作用域可能很短的分享文件复制到 App Group，并追加共享队列。 */
export async function stageSharedFiles(paths: string[]): Promise<number> {
  await FileManager.createDirectory(STAGING_DIR, true)
  const staged: PendingSharedFile[] = []
  const stagingDirectories: string[] = []
  try {
    for (const source of paths) {
      if (!source || !(await FileManager.exists(source))) continue
      const destination = uniqueStagingTarget(source)
      await FileManager.createDirectory(destination.directory, true)
      stagingDirectories.push(destination.directory)
      await FileManager.copyFile(source, destination.path)
      staged.push({ path: destination.path, createdAt: Date.now() })
    }
  } catch (error) {
    for (const directory of stagingDirectories) {
      try { await FileManager.remove(directory) } catch {}
    }
    throw new Error(`暂存分享文件失败：${String(error)}`)
  }
  if (staged.length === 0) return 0
  if (!Storage.set(QUEUE_KEY, [...readQueue(), ...staged], { shared: true })) {
    for (const directory of stagingDirectories) {
      try { await FileManager.remove(directory) } catch {}
    }
    throw new Error("无法保存分享文件队列")
  }
  return staged.length
}

/** 主脚本入口/恢复：取走当前队列，文件由服务器在会话结束时清理。 */
export function claimSharedFiles(): string[] {
  const queued = readQueue()
  Storage.remove(QUEUE_KEY, { shared: true })
  return queued.map(item => item.path).filter(path => FileManager.existsSync(path))
}

export function isStagedSharedFile(path: string): boolean {
  if (!path.startsWith(`${STAGING_DIR}/`)) return false
  const parts = path.slice(STAGING_DIR.length + 1).split("/")
  return parts.length === 2 && /^[a-z0-9]+-[a-z0-9]+$/.test(parts[0])
    && parts[1].length > 0 && parts[1] !== "." && parts[1] !== ".."
    && !/[\\\u0000-\u001f\u007f]/.test(parts[1])
}
