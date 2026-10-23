<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useMessage, useThemeVars } from 'naive-ui';
import JSON5 from 'json5';
import JsonNode from '../rc4-decode/modules/json-node.vue';

defineOptions({ name: 'AesCryptoPage' });

type CryptoMode = 'encrypt' | 'decrypt';

const message = useMessage();
const themeVars = useThemeVars();

// 测试密钥：16 字节 → AES-128。请勿使用线上密钥。
const DEFAULT_SECRET_KEY = '6W0bPs4YYFpBAzmc';

const IV_LEN = 12;
const TAG_LEN = 16;

const secretKey = ref(DEFAULT_SECRET_KEY);
const inputText = ref('');
const mode = ref<CryptoMode>('decrypt');
const outputText = ref('');
const errorMsg = ref('');
const loading = ref(false);

/** 密钥字节数及对应的 AES 位数提示 */
const keyInfo = computed(() => {
  const len = new TextEncoder().encode(secretKey.value).length;
  const bitsMap: Record<number, number> = { 16: 128, 24: 192, 32: 256 };
  const bits = bitsMap[len];
  return { len, bits, valid: bits !== undefined };
});

function toBase64(bytes: Uint8Array) {
  let binary = '';
  // 逐字节拼接，避免大数组 apply 展开爆栈
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function fromBase64(b64: string) {
  const binary = window.atob(b64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function importKey(secret: string) {
  const keyBytes = new TextEncoder().encode(secret);
  if (![16, 24, 32].includes(keyBytes.length)) {
    throw new Error(`密钥必须是 16/24/32 字节（UTF-8），当前 ${keyBytes.length} 字节`);
  }
  return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/** 加密：明文 → urlencode(base64(IV ‖ 密文 ‖ Tag)) */
async function encrypt(plain: string, secret: string) {
  const key = await importKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const ctTag = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain))
  );

  const raw = new Uint8Array(IV_LEN + ctTag.length);
  raw.set(iv);
  raw.set(ctTag, IV_LEN);

  return encodeURIComponent(toBase64(raw));
}

/** 解密：urldecode → base64decode → 切 IV / 密文+Tag → AES-GCM 解密 */
async function decrypt(encoded: string, secret: string) {
  const key = await importKey(secret);

  let raw: Uint8Array;
  try {
    // decodeURIComponent 不会把 + 当空格；未做 URL 编码的原始 Base64 也能直接解
    raw = fromBase64(decodeURIComponent(encoded.trim()));
  } catch (error) {
    throw new Error('不是合法的 Base64 / URL 编码密文', { cause: error });
  }

  if (raw.length < IV_LEN + TAG_LEN) {
    throw new Error('密文过短：不足 IV(12) + Tag(16) 字节');
  }

  try {
    const iv = raw.slice(0, IV_LEN);
    const ctTag = raw.slice(IV_LEN);
    const plainBytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ctTag);
    return new TextDecoder('utf-8').decode(plainBytes);
  } catch (error) {
    throw new Error('认证失败：密钥不对，或密文被截断 / 篡改', { cause: error });
  }
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

/** 仅解密模式下才尝试把结果渲染成 JSON 树 */
const parsedJson = computed(() => (mode.value === 'decrypt' ? tryParseJson(outputText.value) : undefined));
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

/** 复制内容：JSON 时复制美化后的文本，否则复制原始输出 */
const copyText = computed(() =>
  parsedJson.value === undefined ? outputText.value : JSON.stringify(parsedJson.value, null, 2)
);

// 自增序号，解决异步加解密的竞态：只采纳最新一次执行的结果
let runId = 0;

async function handleRun() {
  const currentRun = (runId += 1);

  errorMsg.value = '';
  outputText.value = '';

  if (!inputText.value.trim()) return;

  const currentMode = mode.value;
  loading.value = true;
  try {
    const result =
      currentMode === 'encrypt'
        ? await encrypt(inputText.value, secretKey.value)
        : await decrypt(inputText.value, secretKey.value);

    // 期间若又触发了新的执行，则丢弃本次结果
    if (currentRun !== runId) return;
    outputText.value = result;
  } catch (error) {
    if (currentRun !== runId) return;
    const action = currentMode === 'encrypt' ? '加密' : '解密';
    errorMsg.value = `${action}失败：${error instanceof Error ? error.message : '输入格式不正确'}`;
  } finally {
    if (currentRun === runId) loading.value = false;
  }
}

function handleReset() {
  secretKey.value = DEFAULT_SECRET_KEY;
  inputText.value = '';
  outputText.value = '';
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

// 输入、密钥或操作变化时自动执行（带防抖，避免逐字符输入时频繁计算与报错闪烁）
let runTimer: ReturnType<typeof setTimeout> | undefined;

watch([inputText, secretKey, mode], () => {
  if (runTimer) clearTimeout(runTimer);
  runTimer = setTimeout(handleRun, 300);
});
</script>

<template>
  <NGrid :x-gap="16" :y-gap="16" responsive="screen" item-responsive>
    <!-- 左侧：输入区，占约 30% -->
    <NGi span="24 m:7">
      <NCard :bordered="false" class="card-wrapper h-full">
        <NSpace vertical :size="16">
          <NAlert type="info" :bordered="false">
            AES-GCM 加解密在浏览器本地完成，密钥与数据不会上传。密钥按 UTF-8 直接作为原始密钥（16/24/32 字节对应
            AES-128/192/256）。
          </NAlert>

          <NForm label-placement="top">
            <NFormItem label="操作">
              <NRadioGroup v-model:value="mode">
                <NSpace>
                  <NRadio value="decrypt">解密</NRadio>
                  <NRadio value="encrypt">加密</NRadio>
                </NSpace>
              </NRadioGroup>
            </NFormItem>

            <NFormItem label="密钥 Key" required>
              <NSpace vertical :size="4" class="w-full">
                <NInput v-model:value="secretKey" placeholder="请输入 AES 密钥" clearable />
                <NText :type="keyInfo.valid ? 'success' : 'error'" depth="3" style="font-size: 12px">
                  <template v-if="keyInfo.valid">{{ keyInfo.len }} 字节 · AES-{{ keyInfo.bits }}</template>
                  <template v-else>{{ keyInfo.len }} 字节 · 长度必须为 16 / 24 / 32</template>
                </NText>
              </NSpace>
            </NFormItem>

            <NFormItem :label="mode === 'encrypt' ? '明文（字符串或 JSON）' : '密文'" required>
              <NInput
                v-model:value="inputText"
                type="textarea"
                :placeholder="mode === 'encrypt' ? '请输入要加密的明文' : '请粘贴密文（Base64 / URL 编码）'"
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

    <!-- 右侧：结果，占约 70% -->
    <NGi span="24 m:17">
      <NCard :bordered="false" class="card-wrapper h-full">
        <NSpace vertical :size="8">
          <NSpace align="center" justify="space-between">
            <NSpace align="center" :size="8">
              <NText depth="2">{{ mode === 'encrypt' ? '加密结果' : '解密结果' }}</NText>
              <NTag v-if="isJson" size="small" type="success" :bordered="false">JSON</NTag>
            </NSpace>
            <NSpace align="center" :size="8">
              <template v-if="isJson">
                <NButton size="small" text @click="expandAll">展开全部</NButton>
                <NButton size="small" text @click="collapseAll">收起全部</NButton>
              </template>
              <NButton size="small" text :disabled="!outputText" @click="handleCopy">复制</NButton>
            </NSpace>
          </NSpace>

          <div v-if="isJson" class="json-viewer">
            <JsonNode :key="treeKey" :value="parsedJson" :default-expanded="treeExpanded" />
          </div>

          <NInput
            v-else
            :value="outputText"
            type="textarea"
            readonly
            placeholder="结果将显示在这里"
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
