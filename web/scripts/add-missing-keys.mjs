import fs from 'node:fs/promises'
import path from 'node:path'

const LOCALES_DIR = path.resolve('src/i18n/locales')

function stableStringify(obj) {
  return JSON.stringify(obj, null, 2) + '\n'
}

const newKeys = {
  en: {
    'Avg latency': 'Avg latency',
    Concurrency: 'Concurrency',
    'Full test': 'Full test',
    'Full test completed: {{count}} succeeded':
      'Full test completed: {{count}} succeeded',
    'Full test completed: {{success}} succeeded, {{failed}} failed':
      'Full test completed: {{success}} succeeded, {{failed}} failed',
    'Full test for {{model}}': 'Full test for {{model}}',
    'Full test stopped: {{completed}}/{{total}} completed, {{success}} succeeded, {{failed}} failed':
      'Full test stopped: {{completed}}/{{total}} completed, {{success}} succeeded, {{failed}} failed',
    'Full testing...': 'Full testing...',
    'Last error': 'Last error',
    Max: 'Max',
    Min: 'Min',
    P50: 'P50',
    P95: 'P95',
    'Range: {{min}}–{{max}}': 'Range: {{min}}–{{max}}',
    'Start full test': 'Start full test',
    'This will send real upstream requests and may incur usage charges.':
      'This will send real upstream requests and may incur usage charges.',
  },
  zh: {
    'Avg latency': '平均延迟',
    Concurrency: '并发数',
    'Full test': '全面测试',
    'Full test completed: {{count}} succeeded':
      '全面测试完成：{{count}} 个成功',
    'Full test completed: {{success}} succeeded, {{failed}} failed':
      '全面测试完成：{{success}} 个成功，{{failed}} 个失败',
    'Full test for {{model}}': '全面测试 {{model}}',
    'Full test stopped: {{completed}}/{{total}} completed, {{success}} succeeded, {{failed}} failed':
      '全面测试已停止：已完成 {{completed}}/{{total}}，成功 {{success}}，失败 {{failed}}',
    'Full testing...': '全面测试中...',
    'Last error': '最近错误',
    Max: '最大',
    Min: '最小',
    P50: 'P50',
    P95: 'P95',
    'Range: {{min}}–{{max}}': '范围：{{min}}–{{max}}',
    'Start full test': '开始全面测试',
    'This will send real upstream requests and may incur usage charges.':
      '将真实请求上游，可能产生费用。',
  },
  'zh-TW': {
    'Avg latency': '平均延遲',
    Concurrency: '並發數',
    'Full test': '全面測試',
    'Full test completed: {{count}} succeeded':
      '全面測試完成：{{count}} 個成功',
    'Full test completed: {{success}} succeeded, {{failed}} failed':
      '全面測試完成：{{success}} 個成功，{{failed}} 個失敗',
    'Full test for {{model}}': '全面測試 {{model}}',
    'Full test stopped: {{completed}}/{{total}} completed, {{success}} succeeded, {{failed}} failed':
      '全面測試已停止：已完成 {{completed}}/{{total}}，成功 {{success}}，失敗 {{failed}}',
    'Full testing...': '全面測試中...',
    'Last error': '最近錯誤',
    Max: '最大',
    Min: '最小',
    P50: 'P50',
    P95: 'P95',
    'Range: {{min}}–{{max}}': '範圍：{{min}}–{{max}}',
    'Start full test': '開始全面測試',
    'This will send real upstream requests and may incur usage charges.':
      '將真實請求上游，可能產生費用。',
  },
  fr: {
    'Avg latency': 'Latence moyenne',
    Concurrency: 'Simultanéité',
    'Full test': 'Test complet',
    'Full test completed: {{count}} succeeded':
      'Test complet terminé : {{count}} réussis',
    'Full test completed: {{success}} succeeded, {{failed}} failed':
      'Test complet terminé : {{success}} réussis, {{failed}} échoués',
    'Full test for {{model}}': 'Test complet pour {{model}}',
    'Full test stopped: {{completed}}/{{total}} completed, {{success}} succeeded, {{failed}} failed':
      'Test complet arrêté : {{completed}}/{{total}} terminés, {{success}} réussis, {{failed}} échoués',
    'Full testing...': 'Test complet...',
    'Last error': 'Dernière erreur',
    Max: 'Max',
    Min: 'Min',
    P50: 'P50',
    P95: 'P95',
    'Range: {{min}}–{{max}}': 'Plage : {{min}}–{{max}}',
    'Start full test': 'Démarrer le test complet',
    'This will send real upstream requests and may incur usage charges.':
      'Cela enverra de vraies requêtes en amont et peut engendrer des frais.',
  },
  ja: {
    'Avg latency': '平均レイテンシ',
    Concurrency: '同時実行数',
    'Full test': '全面テスト',
    'Full test completed: {{count}} succeeded':
      '全面テスト完了：{{count}} 件成功',
    'Full test completed: {{success}} succeeded, {{failed}} failed':
      '全面テスト完了：成功 {{success}}、失敗 {{failed}}',
    'Full test for {{model}}': '{{model}} の全面テスト',
    'Full test stopped: {{completed}}/{{total}} completed, {{success}} succeeded, {{failed}} failed':
      '全面テストを停止：{{completed}}/{{total}} 完了、成功 {{success}}、失敗 {{failed}}',
    'Full testing...': '全面テスト中...',
    'Last error': '直近のエラー',
    Max: '最大',
    Min: '最小',
    P50: 'P50',
    P95: 'P95',
    'Range: {{min}}–{{max}}': '範囲：{{min}}–{{max}}',
    'Start full test': '全面テストを開始',
    'This will send real upstream requests and may incur usage charges.':
      '実際に上流へリクエストを送り、料金が発生する可能性があります。',
  },
  ru: {
    'Avg latency': 'Средняя задержка',
    Concurrency: 'Параллельность',
    'Full test': 'Полный тест',
    'Full test completed: {{count}} succeeded':
      'Полный тест завершён: {{count}} успешно',
    'Full test completed: {{success}} succeeded, {{failed}} failed':
      'Полный тест завершён: {{success}} успешно, {{failed}} с ошибкой',
    'Full test for {{model}}': 'Полный тест для {{model}}',
    'Full test stopped: {{completed}}/{{total}} completed, {{success}} succeeded, {{failed}} failed':
      'Полный тест остановлен: {{completed}}/{{total}} завершено, {{success}} успешно, {{failed}} с ошибкой',
    'Full testing...': 'Полный тест...',
    'Last error': 'Последняя ошибка',
    Max: 'Макс.',
    Min: 'Мин.',
    P50: 'P50',
    P95: 'P95',
    'Range: {{min}}–{{max}}': 'Диапазон: {{min}}–{{max}}',
    'Start full test': 'Запустить полный тест',
    'This will send real upstream requests and may incur usage charges.':
      'Будут отправлены реальные запросы к апстриму; возможна оплата использования.',
  },
  vi: {
    'Avg latency': 'Độ trễ trung bình',
    Concurrency: 'Đồng thời',
    'Full test': 'Kiểm tra toàn diện',
    'Full test completed: {{count}} succeeded':
      'Kiểm tra toàn diện hoàn tất: {{count}} thành công',
    'Full test completed: {{success}} succeeded, {{failed}} failed':
      'Kiểm tra toàn diện hoàn tất: {{success}} thành công, {{failed}} thất bại',
    'Full test for {{model}}': 'Kiểm tra toàn diện {{model}}',
    'Full test stopped: {{completed}}/{{total}} completed, {{success}} succeeded, {{failed}} failed':
      'Đã dừng kiểm tra toàn diện: {{completed}}/{{total}} hoàn thành, {{success}} thành công, {{failed}} thất bại',
    'Full testing...': 'Đang kiểm tra toàn diện...',
    'Last error': 'Lỗi gần nhất',
    Max: 'Tối đa',
    Min: 'Tối thiểu',
    P50: 'P50',
    P95: 'P95',
    'Range: {{min}}–{{max}}': 'Phạm vi: {{min}}–{{max}}',
    'Start full test': 'Bắt đầu kiểm tra toàn diện',
    'This will send real upstream requests and may incur usage charges.':
      'Sẽ gửi yêu cầu thực đến upstream và có thể phát sinh phí.',
  },
}

async function main() {
  let totalAdded = 0

  for (const [locale, trans] of Object.entries(newKeys)) {
    const filePath = path.join(LOCALES_DIR, `${locale}.json`)
    const json = JSON.parse(await fs.readFile(filePath, 'utf8'))

    let count = 0
    for (const [key, value] of Object.entries(trans)) {
      if (!Object.prototype.hasOwnProperty.call(json.translation, key)) {
        json.translation[key] = value
        count++
      } else if (json.translation[key] !== value) {
        json.translation[key] = value
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
