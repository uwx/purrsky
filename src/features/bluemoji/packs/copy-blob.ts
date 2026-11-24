import {
  cacheDirectory,
  downloadAsync,
  getInfoAsync,
} from 'expo-file-system/legacy'
import {type Client} from '@atproto/lex'
import {nanoid} from 'nanoid/non-secure'

import {uploadBlob} from '#/lib/api'
import {safeDelete} from '#/lib/media/manip'

/**
 * Copies a blob from another PDS into the signed-in account by downloading it
 * and uploading it again. Blobs cannot be referenced across repos, so this is
 * the only way to keep an emoji after its source account deletes it.
 *
 * Native reads through a cache file: RN's fetch cannot reliably produce a
 * `Blob` on Android for a remote URL, and `uploadBlob` already accepts a path.
 */
export async function copyBlobToOwnRepo(
  client: Client,
  url: string,
  mimeType?: string,
) {
  if (!cacheDirectory) throw new Error('No cache directory for the download')
  const target = `${cacheDirectory}bluemoji-${nanoid()}.bin`
  try {
    const result = await downloadAsync(url, target)
    if (result.status < 200 || result.status >= 300) {
      throw new Error(`Blob download failed: ${result.status}`)
    }
    const info = await getInfoAsync(target)
    if (!info.exists || !info.size) throw new Error('Blob download was empty')
    const encoding = mimeType ?? result.mimeType ?? 'application/octet-stream'
    return (await uploadBlob(client, target, encoding)).blob
  } finally {
    safeDelete(target)
  }
}
