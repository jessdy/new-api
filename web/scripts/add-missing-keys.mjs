import fs from 'node:fs/promises'
import path from 'node:path'

const LOCALES_DIR = path.resolve('src/i18n/locales')

function stableStringify(obj) {
  return JSON.stringify(obj, null, 2) + '\n'
}

const key =
  'Request samples from oldest to newest: green succeeded, yellow mixed, red failed, gray pending.'

const newKeys = {
  en: {
    [key]: key,
  },
  zh: {
    [key]:
      '请求样本按从旧到新排列：绿色成功，黄色部分失败，红色失败，浅灰待测。',
  },
  'zh-TW': {
    [key]:
      '請求樣本按從舊到新排列：綠色成功，黃色部分失敗，紅色失敗，淺灰待測。',
  },
  fr: {
    [key]:
      'Échantillons de requêtes du plus ancien au plus récent : vert réussi, jaune mixte, rouge échoué, gris en attente.',
  },
  ja: {
    [key]:
      'リクエストサンプル（古い→新しい）：緑は成功、黄は一部失敗、赤は失敗、灰は未実施。',
  },
  ru: {
    [key]:
      'Выборки запросов от старых к новым: зелёный — успех, жёлтый — частично, красный — ошибка, серый — ожидание.',
  },
  vi: {
    [key]:
      'Mẫu yêu cầu từ cũ đến mới: xanh thành công, vàng hỗn hợp, đỏ thất bại, xám đang chờ.',
  },
}

async function main() {
  let totalAdded = 0

  for (const [locale, trans] of Object.entries(newKeys)) {
    const filePath = path.join(LOCALES_DIR, `${locale}.json`)
    const json = JSON.parse(await fs.readFile(filePath, 'utf8'))

    let count = 0
    for (const [nextKey, value] of Object.entries(trans)) {
      if (!Object.prototype.hasOwnProperty.call(json.translation, nextKey)) {
        json.translation[nextKey] = value
        count++
      } else if (json.translation[nextKey] !== value) {
        json.translation[nextKey] = value
        count++
      }
    }

    if (count > 0) {
      json.translation = Object.fromEntries(
        Object.entries(json.translation).sort(([a], [b]) => a.localeCompare(b))
      )
      await fs.writeFile(filePath, stableStringify(json), 'utf8')
    }

    console.log(`${locale}: ${count} translations applied`)
    totalAdded += count
  }

  console.log(`Total: ${totalAdded}`)
}

await main()
