// @ts-nocheck
import net from 'node:net'
import os from 'node:os'

// Custom error class for when a port is locked
class Locked extends Error {
  constructor(port: number) {
    super(`${port} is locked`)
    this.name = 'Locked' // Good practice for custom errors
  }
}

// Interface for the global lockedPorts object
interface LockedPorts {
  old: Set<number>
  young: Set<number>
}

// Global sets to keep track of locked ports
const lockedPorts: LockedPorts = {
  old: new Set<number>(),
  young: new Set<number>(),
}

// Interval in milliseconds to clear old locked ports
const releaseOldLockedPortsIntervalMs: number = 1000 * 15

// Minimum and maximum port numbers
const minPort: number = 1024
const maxPort: number = 65_535

// Lazily created timeout for clearing locked ports
let timeout: NodeJS.Timeout | undefined

/**
 * Retrieves all local network interface addresses, including undefined for default host.
 * @returns A Set of local host addresses (strings or undefined).
 */
const getLocalHosts = (): Set<string | undefined> => {
  const interfaces = os.networkInterfaces()
  // Add undefined for createServer to use default host, and '0.0.0.0' for IPv4.
  const results = new Set<string | undefined>([undefined, '0.0.0.0'])

  for (const _interface of Object.values(interfaces)) {
    // Ensure _interface is not null/undefined before iterating its configs
    if (_interface) {
      for (const config of _interface) {
        results.add(config.address)
      }
    }
  }

  return results
}

/**
 * Checks if a specific port is available on a given host.
 * @param options - net.ListenOptions containing port and optional host.
 * @returns A Promise that resolves with the port number if available, or rejects on error.
 */
const checkAvailablePort = (options: net.ListenOptions): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref() // Allow the program to exit even if this server is still open
    server.on('error', reject)

    server.listen(options, () => {
      const address = server.address()
      // Type guard: address can be string, null, or AddressInfo
      if (typeof address === 'object' && address !== null) {
        const { port } = address
        server.close(() => {
          resolve(port)
        })
      } else {
        reject(new Error('Server address could not be determined.'))
      }
    })
  })

/**
 * Finds an available port based on options and local hosts.
 * If a specific port is requested and it's available on any local interface, it returns that port.
 * If port is 0, it asks the OS for a random available port.
 * @param options - net.ListenOptions.
 * @param hosts - A Set of local host addresses to check against.
 * @returns A Promise that resolves with an available port number.
 */
const getAvailablePort = async (options: net.ListenOptions, hosts: Set<string | undefined>): Promise<number> => {
  // If a specific host is provided or port is 0 (find any available), try directly.
  if (options.host || options.port === 0) {
    return checkAvailablePort(options)
  }

  // If a specific port is requested without a host, check its availability on all local hosts.
  // The port is considered available if it can be listened on *any* local interface.
  for (const host of hosts) {
    try {
      // Temporarily add host to options for checking.
      await checkAvailablePort({ ...options, host })
      // If checkAvailablePort succeeds, it means the requested port is available on this host.
      // We can immediately return the requested port.
      return options.port as number // options.port is guaranteed to be a number here
    } catch (error: any) {
      // If the error indicates the address is not available on this interface (e.g., IPv6 only interface),
      // or an invalid argument for this specific host, continue to the next host.
      if (!['EADDRNOTAVAIL', 'EINVAL'].includes(error.code)) {
        throw error // Re-throw other types of errors
      }
    }
  }

  // If the loop completes without throwing, it means the requested port is effectively
  // available across suitable local interfaces (not in use or denied globally).
  // The previous logic returned options.port here, mirroring that behavior.
  return options.port as number
}

/**
 * Generator function to yield ports to check.
 * If specific ports are provided, it yields them first, then falls back to 0.
 * @param ports - An iterable of port numbers or undefined.
 * @returns A Generator yielding port numbers.
 */
const portCheckSequence = function* (ports: Iterable<number> | undefined): Generator<number> {
  if (ports) {
    yield* ports
  }
  yield 0 // Fall back to 0 (find any available port) if specific ports fail or none were given
}

// Interface for the options object passed to the main getPorts function
interface GetPortsOptions extends net.ListenOptions {
  port?: number | Iterable<number>
  exclude?: Iterable<number>
}

/**
 * Finds an available and unlocked port.
 * @param options - An object with optional `port` (number or iterable), `exclude` (iterable of numbers), and `host` (string) properties.
 * @returns A Promise that resolves with an available port number.
 * @throws {TypeError} If `exclude` is not iterable or contains non-numeric values.
 * @throws {RangeError} If port numbers are out of range.
 * @throws {Locked} If a specific requested port is locked.
 * @throws {Error} If no available ports are found.
 */
export default async function getPorts(options: GetPortsOptions = {}): Promise<number> {
  let portsToTry: Iterable<number> | undefined
  const excludePorts: Set<number> = new Set<number>()

  // Process 'port' option
  if (options.port !== undefined) {
    portsToTry = typeof options.port === 'number' ? [options.port] : options.port
  }

  // Process 'exclude' option
  if (options.exclude !== undefined) {
    const excludeIterable: Iterable<number> = options.exclude

    if (typeof excludeIterable[Symbol.iterator] !== 'function') {
      throw new TypeError('The `exclude` option must be an iterable.')
    }

    for (const element of excludeIterable) {
      if (typeof element !== 'number' || !Number.isSafeInteger(element)) {
        throw new TypeError(
          `Each item in the \`exclude\` option must be a safe integer number corresponding to the port you want excluded. Received: ${element}`,
        )
      }
      excludePorts.add(element)
    }
  }

  // Initialize the locked ports timeout if it's not already running
  if (timeout === undefined) {
    timeout = setTimeout(() => {
      timeout = undefined
      lockedPorts.old = lockedPorts.young
      lockedPorts.young = new Set<number>()
    }, releaseOldLockedPortsIntervalMs)

    if (timeout.unref) {
      timeout.unref()
    }
  }

  const hosts: Set<string | undefined> = getLocalHosts()

  // Iterate through the sequence of ports to check
  for (const port of portCheckSequence(portsToTry)) {
    try {
      if (excludePorts.has(port)) {
        continue // Skip explicitly excluded ports
      }

      // Prepare options for checking the current port.
      const currentCheckOptions: net.ListenOptions = { ...options, port }

      let availablePort: number = await getAvailablePort(currentCheckOptions, hosts)

      // Handle locked ports. The logic differs if a specific port was requested (port !== 0)
      // versus when any available port was requested (port === 0).
      if (port !== 0) {
        // If a specific port was requested and it's currently locked, throw immediately.
        if (lockedPorts.old.has(availablePort) || lockedPorts.young.has(availablePort)) {
          throw new Locked(port)
        }
      } else {
        // If 'find any available port' was requested (port === 0),
        // and the found 'availablePort' is locked, try finding another random port.
        while (lockedPorts.old.has(availablePort) || lockedPorts.young.has(availablePort)) {
          availablePort = await getAvailablePort({ ...options, port: 0 }, hosts)
        }
      }

      // Once an available and unlocked port is found, mark it as young-locked and return.
      lockedPorts.young.add(availablePort)
      return availablePort
    } catch (error: any) {
      // If the port is in use, access denied, or explicitly locked, try the next port in sequence.
      if (!['EADDRINUSE', 'EACCES'].includes(error.code) && !(error instanceof Locked)) {
        throw error // Re-throw other unexpected errors
      }
    }
  }

  throw new Error('No available ports found')
}

/**
 * Generator function to create an iterable sequence of port numbers within a range.
 * @param from - The starting port number (inclusive).
 * @param to - The ending port number (inclusive).
 * @returns A Generator yielding port numbers from `from` to `to`.
 * @throws {TypeError} If `from` or `to` are not integer numbers.
 * @throws {RangeError} If `from` or `to` are outside the valid port range, or `to` is less than `from`.
 */
export function portNumbers(from: number, to: number): Generator<number> {
  if (!Number.isInteger(from) || !Number.isInteger(to)) {
    throw new TypeError('`from` and `to` must be integer numbers')
  }

  if (from < minPort || from > maxPort) {
    throw new RangeError(`'from' must be between ${minPort} and ${maxPort}`)
  }

  if (to < minPort || to > maxPort) {
    throw new RangeError(`'to' must be between ${minPort} and ${maxPort}`)
  }

  if (from > to) {
    throw new RangeError('`to` must be greater than or equal to `from`')
  }

  return (function* (start: number, end: number) {
    for (let port = start; port <= end; port++) {
      yield port
    }
  })(from, to)
}

/**
 * Clears all currently locked ports.
 */
export function clearLockedPorts(): void {
  lockedPorts.old.clear()
  lockedPorts.young.clear()
}
