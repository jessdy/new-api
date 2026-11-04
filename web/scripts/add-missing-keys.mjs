import fs from 'node:fs/promises'
import path from 'node:path'

const LOCALES_DIR = path.resolve('src/i18n/locales')

function stableStringify(obj) {
  return JSON.stringify(obj, null, 2) + '\n'
}

const newKeys = {
  en: {
    'Sign in to continue': 'Sign in to continue',
    'One account for every model and protocol':
      'One account for every model and protocol',
  },
  zh: {
    'Sign in to continue': '登录以继续',
    'One account for every model and protocol': '一个账号，畅用全部模型与协议',
  },
  'zh-TW': {
    'Sign in to continue': '登入以繼續',
    'One account for every model and protocol': '一個帳號，暢用全部模型與協定',
  },
  fr: {
    'Sign in to continue': 'Connectez-vous pour continuer',
    'One account for every model and protocol':
      'Un compte pour tous les modèles et protocoles',
  },
  ja: {
    'Sign in to continue': '続行するにはサインインしてください',
    'One account for every model and protocol':
      '1 つのアカウントで、すべてのモデルとプロトコルに対応',
  },
  ru: {
    'Sign in to continue': 'Войдите, чтобы продолжить',
    'One account for every model and protocol':
      'Один аккаунт — все модели и протоколы',
  },
  vi: {
    'Sign in to continue': 'Đăng nhập để tiếp tục',
    'One account for every model and protocol':
      'Một tài khoản cho mọi mô hình và giao thức',
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
