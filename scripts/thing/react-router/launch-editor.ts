import * as child_process from 'node:child_process'
import { existsSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { promisify } from 'node:util'

const execAsync = promisify(child_process.exec)

// 缓存 which 命令的结果
const editorPathCache = new Map<string, string>()

// 添加超时控制的 findEditorPath
async function findEditorPath(editorName: string): Promise<string | null> {
  if (editorPathCache.has(editorName)) {
    return editorPathCache.get(editorName) || null
  }

  try {
    // 添加超时控制
    const timeoutPromise = new Promise<{ stdout: string }>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout finding editor')), 2000)
    })

    const { stdout } = await Promise.race([execAsync(`which ${editorName}`), timeoutPromise])

    const editorPath = stdout.trim()
    if (editorPath && existsSync(editorPath)) {
      // 使用同步检查，因为这个路径通常在系统PATH中
      editorPathCache.set(editorName, editorPath)
      return editorPath
    }
  } catch (error) {
    console.debug(`Error finding editor ${editorName}:`, error)
    return null
  }

  return null
}

function getArgumentsForLineNumber(
  {
    absolutePath,
    lineNumber,
    colNumber,
  }: {
    absolutePath: string
    colNumber: number
    lineNumber: number
  },
  editorName: string,
): string[] {
  switch (editorName) {
    case 'code': {
      // 将 VSCode 重定向到 Cursor
      const args = ['--goto', `${absolutePath}:${lineNumber}:${colNumber}`]
      args.push('--reuse-window')
      args.push('--wait=false')
      return args
    }
    case 'codium': // VSCodium
    case 'cursor': {
      const args = ['--goto', `${absolutePath}:${lineNumber}:${colNumber}`]
      args.push('--reuse-window')
      args.push('--wait=false')
      return args
    }
    case 'zed':
    case 'zed-preview':
      return ['-a', `${absolutePath}:${lineNumber}:${colNumber}`]
    case 'subl': // Sublime
      return [`${absolutePath}:${lineNumber}:${colNumber}`]
    case 'webstorm':
    case 'idea': // WebStorm, IntelliJ
      return ['--line', lineNumber.toString(), absolutePath]
    default:
      return [absolutePath]
  }
}

async function _findVSCodeWorkspace(filePath: string): Promise<string | undefined> {
  let currentDir = path.dirname(filePath)
  const root = path.parse(currentDir).root

  // 向上查找 .vscode 目录或 .code-workspace 文件
  while (currentDir !== root) {
    const vscodePath = path.join(currentDir, '.vscode')
    const workspaceFiles = await fs.readdir(currentDir).catch(() => [])

    if (existsSync(vscodePath) || workspaceFiles.some((f) => f.endsWith('.code-workspace'))) {
      return currentDir
    }

    currentDir = path.dirname(currentDir)
  }

  return undefined
}

async function launchEditor(
  {
    filePath,
    lineNumber,
    colNumber,
  }: {
    filePath: string
    colNumber: number
    lineNumber: number
  },
  editorNames: string[],
): Promise<void> {
  try {
    const editors = Array.isArray(editorNames) ? editorNames : [editorNames]

    // 并行执行文件检查和所有编辑器路径查找
    const [fileExists, ...editorPaths] = await Promise.all([
      fs
        .access(filePath)
        .then(() => true)
        .catch(() => false),
      ...editors.map((editor) => findEditorPath(editor)),
    ])

    if (!fileExists) {
      console.log(`File ${filePath} does not exist`)
      return
    }

    // 启动每个可用的编辑器
    for (let i = 0; i < editors.length; i++) {
      const editorPath = editorPaths[i]
      const editorName = editors[i]

      if (!editorPath) {
        console.log(`Editor command '${editorName}' not found in PATH`)
        continue
      }

      const args = getArgumentsForLineNumber({ absolutePath: filePath, lineNumber, colNumber }, editorName)

      const childProcess = child_process.spawn(editorPath, args, {
        stdio: 'ignore',
        detached: true,
      })

      const timeout = setTimeout(() => {
        console.log(`Editor ${editorName} launch timeout, killing process`)
        childProcess.kill()
      }, 5000)

      childProcess.on('spawn', () => {
        clearTimeout(timeout)
        childProcess.unref()
      })

      childProcess.on('error', (error) => {
        clearTimeout(timeout)
        console.log(`Failed to launch editor ${editorName}: ${error.message}`)
      })
    }
  } catch (error) {
    if (error instanceof Error) {
      console.log(`Failed to launch editors: ${error.message}`)
    }
  }
}

export { launchEditor }
