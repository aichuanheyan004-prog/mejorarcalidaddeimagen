import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const siteHost = 'www.mejorarcalidaddeimagen.net'
const siteOrigin = 'https://' + siteHost
const indexNowKey = '87d732c0193c32ca25fe92f7729b65d5aba7e964e112f8260308d85a7d0a8efd'
const keyLocation = siteOrigin + '/' + indexNowKey + '.txt'
const endpoint = 'https://api.indexnow.org/indexnow'

const args = new Set(process.argv.slice(2))
const live = args.has('--live')
const skipKeyCheck = args.has('--skip-key-check')

async function readSitemapUrls() {
  const sitemapPath = resolve('public', 'sitemap.xml')
  const xml = await readFile(sitemapPath, 'utf8')
  const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1].trim())
  const invalid = urls.filter((url) => !url.startsWith(siteOrigin + '/'))
  if (invalid.length > 0) {
    throw new Error('Sitemap contains non-canonical URLs: ' + invalid.join(', '))
  }
  return [...new Set(urls)]
}

async function assertRemoteKey() {
  const response = await fetch(keyLocation, { cache: 'no-store' })
  const body = (await response.text()).trim()
  if (!response.ok || body !== indexNowKey) {
    throw new Error('IndexNow key is not publicly verifiable at ' + keyLocation)
  }
}

async function submit(urlList) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: siteHost,
      key: indexNowKey,
      keyLocation,
      urlList,
    }),
  })

  const body = await response.text()
  if (![200, 202].includes(response.status)) {
    throw new Error('IndexNow submission failed: ' + response.status + ' ' + body)
  }
  return { status: response.status, body }
}

const urlList = await readSitemapUrls()

if (!live) {
  console.log('[dry-run] IndexNow payload:')
  console.log(JSON.stringify({ host: siteHost, keyLocation, urlList }, null, 2))
  console.log('Run with --live after production deploy to submit these URLs.')
  process.exit(0)
}

if (!skipKeyCheck) {
  await assertRemoteKey()
}

const result = await submit(urlList)
console.log(JSON.stringify({ submitted: urlList.length, ...result }, null, 2))
