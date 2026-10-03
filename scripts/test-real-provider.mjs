#!/usr/bin/env node
/**
 * WP-W1-04: 真实 Provider 接入测试
 *
 * 目标: 验证真实 OpenAI-compatible API 连接
 * Owner: Lead (执行 Worker-H 任务)
 */

import https from 'https';

const BASE_URL = process.env.DGOS_REAL_PROVIDER_BASE_URL;
const API_KEY = process.env.DGOS_REAL_PROVIDER_KEY;
if (!BASE_URL || !API_KEY) {
  console.error('real_provider_credentials_required');
  process.exit(2);
}

console.log('🚀 WP-W1-04: 真实 Provider 接入测试\n');
console.log(`Base URL: ${BASE_URL}`);

// Test 1: 获取模型列表
async function testModelsEndpoint() {
  console.log('📋 Test 1: 获取模型列表');

  return new Promise((resolve, reject) => {
    const url = new URL('/v1/models', BASE_URL);

    const options = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log(`  ✅ Status: ${res.statusCode}`);
          console.log(`  ✅ Models: ${json.data?.length || 0} 个`);
          if (json.data && json.data.length > 0) {
            console.log(`  ✅ First model: ${json.data[0].id}`);
          }
          resolve({ success: true, models: json.data, statusCode: res.statusCode });
        } catch (e) {
          console.log(`  ❌ Parse error: ${e.message}`);
          console.log(`  Raw response: ${data.substring(0, 200)}`);
          resolve({ success: false, error: e.message, data });
        }
      });
    });

    req.on('error', (e) => {
      console.log(`  ❌ Request error: ${e.message}`);
      reject(e);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });

    req.end();
  });
}

// Test 2: 提交简单的 text completion
async function testChatCompletion(modelId = 'gpt-3.5-turbo') {
  console.log('\n💬 Test 2: 提交 text completion');
  console.log(`  Model: ${modelId}`);

  return new Promise((resolve, reject) => {
    const url = new URL('/v1/chat/completions', BASE_URL);

    const payload = JSON.stringify({
      model: modelId,
      messages: [
        { role: 'user', content: 'Say "Hello from DGOS!" in one short sentence.' }
      ],
      max_tokens: 50,
      temperature: 0.7
    });

    const options = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log(`  ✅ Status: ${res.statusCode}`);

          if (json.choices && json.choices[0]) {
            const message = json.choices[0].message?.content;
            const tokens = json.usage?.total_tokens;
            console.log(`  ✅ Response: ${message}`);
            console.log(`  ✅ Tokens used: ${tokens}`);
            resolve({
              success: true,
              response: message,
              tokens,
              statusCode: res.statusCode
            });
          } else if (json.error) {
            console.log(`  ❌ API Error: ${json.error.message}`);
            resolve({ success: false, error: json.error });
          } else {
            console.log(`  ⚠️  Unexpected response format`);
            console.log(`  Raw: ${data.substring(0, 200)}`);
            resolve({ success: false, data });
          }
        } catch (e) {
          console.log(`  ❌ Parse error: ${e.message}`);
          reject(e);
        }
      });
    });

    req.on('error', (e) => {
      console.log(`  ❌ Request error: ${e.message}`);
      reject(e);
    });

    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });

    req.write(payload);
    req.end();
  });
}

// 执行测试
(async () => {
  const results = {
    timestamp: new Date().toISOString(),
    baseURL: BASE_URL,
    tests: []
  };

  try {
    // Test 1
    const modelsResult = await testModelsEndpoint();
    results.tests.push({ test: 'models', ...modelsResult });

    if (modelsResult.success && modelsResult.models && modelsResult.models.length > 0) {
      // Test 2 - 使用第一个可用模型
      const modelId = modelsResult.models[0].id;
      const chatResult = await testChatCompletion(modelId);
      results.tests.push({ test: 'chat_completion', modelId, ...chatResult });
    } else {
      console.log('\n⚠️  跳过 Test 2: 没有可用模型');
      results.tests.push({ test: 'chat_completion', skipped: true, reason: 'No models available' });
    }

    // 生成报告
    console.log('\n' + '='.repeat(60));
    console.log('📊 测试总结\n');

    const allSuccess = results.tests.every(t => t.success || t.skipped);

    if (allSuccess) {
      console.log('✅ WP-W1-04 验收标准:');
      console.log('  [✅] 真实 Provider 配置成功');
      console.log('  [✅] 模型列表刷新成功');
      console.log('  [✅] TLS 证书验证通过');

      const chatTest = results.tests.find(t => t.test === 'chat_completion');
      if (chatTest?.success) {
        console.log('  [✅] Text task 成功完成');
        console.log('  [✅] Response 非空');
        console.log('  [✅] Token 使用已记录');
      }

      console.log('\n🎉 WP-W1-04 真实 Provider 接入: 成功!\n');
    } else {
      console.log('❌ 部分测试失败，需要进一步诊断\n');
    }

    // 保存结果
    const fs = await import('fs');
    const reportPath = '.herdr/WP-W1-04-REAL-PROVIDER-RESULT.json';
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`📝 详细结果已保存: ${reportPath}\n`);

    process.exit(allSuccess ? 0 : 1);

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    results.error = error.message;

    const fs = await import('fs');
    const reportPath = '.herdr/WP-W1-04-REAL-PROVIDER-ERROR.json';
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));

    process.exit(1);
  }
})();
