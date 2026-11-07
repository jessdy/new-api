import fs from 'node:fs/promises'
import path from 'node:path'

const LOCALES_DIR = path.resolve('src/i18n/locales')

function stableStringify(obj) {
  return JSON.stringify(obj, null, 2) + '\n'
}

const newKeys = {
  en: {
    'Higher values appear first': 'Higher values appear first',
  },
  zh: {
    'Higher values appear first': '数值越大越靠前',
  },
  'zh-TW': {
    'Higher values appear first': '數值越大越靠前',
  },
  fr: {
    'Higher values appear first': 'Les valeurs plus élevées apparaissent en premier',
  },
  ja: {
    'Higher values appear first': '数値が大きいほど前に表示されます',
  },
  ru: {
    'Higher values appear first': 'Большие значения отображаются первыми',
  },
  vi: {
    'Higher values appear first': 'Giá trị lớn hơn sẽ hiện trước',
  },
}

async function main() {
  let totalAdded = 0

  for (const [locale, trans] of Object.entries(newKeys)) {
    const filePath = path.join(LOCALES_DIR, `${locale}.json`)
    const raw = await fs.readFile(filePath, 'utf8')
    const data = JSON.parse(raw)
    const translation = data.translation || data
    let added = 0

    for (const [key, value] of Object.entries(trans)) {
      if (!(key in translation)) {
        translation[key] = value
        added++
      } else if (translation[key] === key && value !== key) {
        translation[key] = value
        added++
      }
    }

    const sorted = Object.fromEntries(
      Object.keys(translation)
        .sort((a, b) => a.localeCompare(b))
        .map((k) => [k, translation[k]])
    )

    if (data.translation) {
      data.translation = sorted
      await fs.writeFile(filePath, stableStringify(data))
    } else {
      await fs.writeFile(filePath, stableStringify(sorted))
    }

    console.log(`${locale}: ${added} translations applied`)
    totalAdded += added
  }

  console.log(`Total: ${totalAdded}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
