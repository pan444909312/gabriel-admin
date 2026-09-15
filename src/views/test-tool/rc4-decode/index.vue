<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useMessage, useThemeVars } from 'naive-ui';
import JSON5 from 'json5';
import JsonNode from './modules/json-node.vue';

defineOptions({ name: 'Rc4DecodePage' });

type InputFormat = 'base64' | 'hex';

const message = useMessage();
const themeVars = useThemeVars();

const DEFAULT_SECRET_KEY = 'abcdefghijklmnopqrstuvwxyzABCDEF';

const secretKey = ref(DEFAULT_SECRET_KEY);
const cipherText = ref('');
const inputFormat = ref<InputFormat>('hex');
const plainText = ref('');
const errorMsg = ref('');

/** RC4 流密码，加解密为同一运算 */
function rc4(keyBytes: Uint8Array, dataBytes: Uint8Array) {
  const s = Array.from({ length: 256 }, (_, i) => i);

  let j = 0;
  for (let i = 0; i < 256; i += 1) {
    j = (j + s[i] + keyBytes[i % keyBytes.length]) % 256;
    [s[i], s[j]] = [s[j], s[i]];
  }

  const result = new Uint8Array(dataBytes.length);
  let x = 0;
  let y = 0;

  for (let i = 0; i < dataBytes.length; i += 1) {
    x = (x + 1) % 256;
    y = (y + s[x]) % 256;
    [s[x], s[y]] = [s[y], s[x]];
    result[i] = dataBytes[i] ^ s[(s[x] + s[y]) % 256];
  }

  return result;
}

function base64ToBytes(input: string) {
  const normalized = input.replaceAll(/\s/g, '').replaceAll('-', '+').replaceAll('_', '/');
  const binary = window.atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function hexToBytes(input: string) {
  const normalized = input.replaceAll(/[\s:]/g, '').replace(/^0x/i, '');

  if (normalized.length % 2 !== 0) {
    throw new Error('Hex 长度必须为偶数');
  }
  if (!/^[0-9a-f]*$/i.test(normalized)) {
    throw new Error('Hex 含非法字符');
  }

  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** 尝试把文本解析为 JSON 对象/数组，失败返回 undefined */
function tryParseJson(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return undefined;

  const first = trimmed[0];
  if (first !== '{' && first !== '[') return undefined;

  try {
    const obj = JSON5.parse(trimmed);
    if (obj === null || typeof obj !== 'object') return undefined;
    return obj as Record<string, unknown> | unknown[];
  } catch {
    return undefined;
  }
}

/** 解析后的 JSON 对象/数组，非 JSON 时为 undefined */
const parsedJson = computed(() => tryParseJson(plainText.value));
const isJson = computed(() => parsedJson.value !== undefined);

/** 控制树节点默认展开状态；改变时通过 key 强制重挂载 */
const treeExpanded = ref(true);
const treeKey = ref(0);

function expandAll() {
  treeExpanded.value = true;
  treeKey.value += 1;
}

function collapseAll() {
  treeExpanded.value = false;
  treeKey.value += 1;
}

/** 复制内容：JSON 时复制美化后的文本，否则复制原始明文 */
const copyText = computed(() =>
  parsedJson.value === undefined ? plainText.value : JSON.stringify(parsedJson.value, null, 2)
);

/**
 * 从输入中提取真正的密文。
 * 支持两种格式：
 * 1. 纯密文串，直接返回；
 * 2. JSON 格式 {"result":"密文"}，提取 result 字段的值。
 */
function extractCipher(input: string) {
  const trimmed = input.trim();

  if (trimmed.startsWith('{')) {
    try {
      const obj = JSON5.parse(trimmed);
      if (obj && typeof obj === 'object' && typeof (obj as Record<string, unknown>).result === 'string') {
        return (obj as Record<string, string>).result.trim();
      }
      throw new Error('JSON 中未找到字符串类型的 result 字段');
    } catch (error) {
      if (error instanceof Error && error.message.includes('result')) {
        throw error;
      }
      throw new Error('JSON 格式的密文解析失败', { cause: error });
    }
  }

  return trimmed;
}

function handleDecode() {
  errorMsg.value = '';
  plainText.value = '';

  if (!cipherText.value.trim()) return;

  try {
    const cipher = extractCipher(cipherText.value);
    const keyBytes = new TextEncoder().encode(secretKey.value);
    const dataBytes = inputFormat.value === 'base64' ? base64ToBytes(cipher) : hexToBytes(cipher);

    const decoded = rc4(keyBytes, dataBytes);
    plainText.value = new TextDecoder('utf-8').decode(decoded);
  } catch (error) {
    errorMsg.value = `解码失败：${error instanceof Error ? error.message : '密文格式不正确'}`;
  }
}

function handleReset() {
  secretKey.value = DEFAULT_SECRET_KEY;
  cipherText.value = '';
  plainText.value = '';
  errorMsg.value = '';
}

async function handleCopy() {
  if (!copyText.value) return;

  try {
    await navigator.clipboard.writeText(copyText.value);
    message.success('已复制到剪贴板');
  } catch {
    message.error('复制失败，请手动选择文本');
  }
}

// 密文、密钥或格式变化时自动解码（带防抖，避免逐字符输入时频繁计算与报错闪烁）
let decodeTimer: ReturnType<typeof setTimeout> | undefined;

watch([cipherText, secretKey, inputFormat], () => {
  if (decodeTimer) clearTimeout(decodeTimer);
  decodeTimer = setTimeout(handleDecode, 300);
});
</script>

<template>
  <NGrid :x-gap="16" :y-gap="16" responsive="screen" item-responsive>
    <!-- 左侧：输入区，占约 30% -->
    <NGi span="24 m:7">
      <NCard :bordered="false" class="card-wrapper h-full">
        <NSpace vertical :size="16">
          <NAlert type="info" :bordered="false">RC4 为对称流密码，解码在浏览器本地完成，密钥与密文不会上传。</NAlert>

          <NForm label-placement="top">
            <NFormItem label="密钥 Key" required>
              <NInput v-model:value="secretKey" placeholder="请输入 RC4 密钥" clearable />
            </NFormItem>

            <NFormItem label="密文格式">
              <NRadioGroup v-model:value="inputFormat">
                <NSpace>
                  <NRadio value="hex">Hex</NRadio>
                  <NRadio value="base64">Base64</NRadio>
                </NSpace>
              </NRadioGroup>
            </NFormItem>

            <NFormItem label="密文 Ciphertext" required>
              <NInput
                v-model:value="cipherText"
                type="textarea"
                placeholder='支持纯密文，或 {"result":"密文"} 格式'
                :autosize="{ minRows: 6, maxRows: 14 }"
                clearable
              />
            </NFormItem>
          </NForm>

          <NSpace>
            <NButton @click="handleReset">重置</NButton>
          </NSpace>

          <NAlert v-if="errorMsg" type="error" :bordered="false">
            {{ errorMsg }}
          </NAlert>
        </NSpace>
      </NCard>
    </NGi>

    <!-- 右侧：解码结果，占约 70% -->
    <NGi span="24 m:17">
      <NCard :bordered="false" class="card-wrapper h-full">
        <NSpace vertical :size="8">
          <NSpace align="center" justify="space-between">
            <NSpace align="center" :size="8">
              <NText depth="2">解码结果</NText>
              <NTag v-if="isJson" size="small" type="success" :bordered="false">JSON</NTag>
            </NSpace>
            <NSpace align="center" :size="8">
              <template v-if="isJson">
                <NButton size="small" text @click="expandAll">展开全部</NButton>
                <NButton size="small" text @click="collapseAll">收起全部</NButton>
              </template>
              <NButton size="small" text :disabled="!plainText" @click="handleCopy">复制</NButton>
            </NSpace>
          </NSpace>

          <div v-if="isJson" class="json-viewer">
            <JsonNode :key="treeKey" :value="parsedJson" :default-expanded="treeExpanded" />
          </div>

          <NInput
            v-else
            :value="plainText"
            type="textarea"
            readonly
            placeholder="解码结果将显示在这里"
            :autosize="{ minRows: 12, maxRows: 24 }"
          />
        </NSpace>
      </NCard>
    </NGi>
  </NGrid>
</template>

<style scoped>
.json-viewer {
  max-height: 640px;
  overflow: auto;
  padding: 16px;
  border-radius: 6px;
  background-color: v-bind('themeVars.codeColor');
  border: 1px solid v-bind('themeVars.borderColor');
}
</style>
