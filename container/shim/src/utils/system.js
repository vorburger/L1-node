import { cpus, freemem, totalmem, loadavg } from 'node:os'
import fsPromises from 'node:fs/promises'
import { debug as Debug } from './logging.js'
import { promisify } from 'node:util'
import { exec as CpExec } from 'node:child_process'

const exec = promisify(CpExec)

const debug = Debug.extend('system')

const memoryBytesToGB = (bytes) => bytes / 1_024_000_000
const meminfoKBToGB = (bytes) => bytes / 1_000_000

export async function getMemoryStats () {
  const nodeAvailableMemory = Number(memoryBytesToGB(freemem()).toFixed(1))
  const nodeTotalMemory = Number(memoryBytesToGB(totalmem()).toFixed(1))
  const result = await fsPromises.readFile('/proc/meminfo', 'utf-8')
  const values = result.trim().split('\n').slice(0, 3).map(res => res.split(':').map(kv => kv.trim())).reduce((acc, cv) => {
    return Object.assign(acc, { [cv[0]]: Number(meminfoKBToGB(cv[1].split(' ')[0]).toFixed(1)) })
  }, {})
  debug(`Total memory: ${values.MemTotal} GB / ${nodeTotalMemory} GB Free: ${values.MemFree} GB Available: ${values.MemAvailable} GB / ${nodeAvailableMemory} GB`)
  return { procTotalMemory: values.MemTotal, nodeTotalMemory, procFreeMemory: values.MemFree, procAvailableMemory: values.MemAvailable, nodeAvailableMemory }
}

export async function getDiskStats () {
  const { stdout: result } = await exec('df -B GB /usr/src/app/shared')
  const values = result.trim().split('\n')[1].split(/\s+/).map(res => res.replace('GB', ''))
  const totalDisk = Number(values[1])
  const usedDisk = Number(values[2])
  const availableDisk = Number(values[3])
  debug(`Total disk: ${totalDisk} GB Used: ${usedDisk} GB Available: ${availableDisk} GB`)
  return { totalDisk, usedDisk, availableDisk }
}

export async function getCPUStats () {
  const result = await fsPromises.readFile('/proc/cpuinfo', 'utf-8')
  const procCPUs = result.trim().split('\n\n').length
  const nodeCPUs = cpus().length
  const loadAvgs = loadavg()
  debug(`CPUs: ${procCPUs} / ${nodeCPUs} (${loadAvgs.join(', ')})`)
  return { procCPUs, nodeCPUs, loadAvgs }
}

export async function getNICStats () {
  const { stdout: result } = await exec('cat /proc/net/dev')
  const traffic = result.trim().split('\n').map(line => line.trim().split(/\s+/)).map((nic) => {
    const [parsedName, ...values] = nic
    const nicName = parsedName.replace(':', '')
    if (!Number(values[0]) || !Number(values[8]) || ['lo', 'docker0'].includes(nicName)) {
      return false
    }
    return {
      interface: nicName,
      bytesReceived: values[0],
      bytesSent: values[8],
      packetsReceived: values[1],
      packetsSent: values[9]
    }
  }).filter(Boolean).sort((a, b) => a.packetsSent - b.packetsSent)
  debug(traffic)
  return traffic[0]
}

export async function getSpeedtest () {
  debug('Executing speedtest')
  const { stdout: result } = await exec('speedtest --accept-license --accept-gdpr -f json')
  const values = JSON.parse(result)
  debug(values)
  return values
}