# AES-GCM 加解密工具 · 实施文档

> 来源：本仓库 `app/tools/aes_crypto.py` + `templates/tools/aes_crypto.html`，
> 与小程序前端（Web Crypto）、`apifox_tt_crypto_cli.mjs`（Node）使用同一协议。
> 本文给出在其他项目复刻该工具所需的协议规范、参考实现与验收方法；
> 参考实现相对原实现修了 4 处边界问题（见第 7 节），协议本身不变，两边密文互通。

## 1. 工具要做什么

- 一个网页：输入框 + 「加密 / 解密」单选 + 密钥下拉 + 执行 / 清空 / 复制。
- 一个后端接口：收 `{text, mode, secret_id}`，返回 `{ok, result, error}`。
- 密钥只在后端：前端下拉框只拿到密钥标识（`secret` / `secret_bak`），真实值从环境变量读。
- 解密结果如果是 JSON，自动缩进 2 格美化。

## 2. 协议规范（各端必须一致）

| 项 | 取值 |
|---|---|
| 算法 | AES-GCM，**无填充** |
| 密钥 | 配置字符串按 **UTF-8 编码后直接作为原始密钥**，不做 KDF / 哈希；长度 16 → AES-128，24 → AES-192，32 → AES-256，其他长度非法 |
| IV（nonce） | 12 字节，每次加密随机生成 |
| Tag | 16 字节（128 位），**拼在密文末尾** |
| AAD | 无（空） |
| 二进制布局 | `IV(12) ‖ 密文 ‖ Tag(16)` |
| 文本编码 | 明文 UTF-8 → 加密 → 布局字节 → **标准 Base64**（`+` `/` `=`，非 URL-safe）→ **URL 编码**（等价 `encodeURIComponent`） |

### 加密步骤

1. `key = utf8(secret)`，校验长度 ∈ {16, 24, 32}
2. `iv = random(12)`
3. `ct_tag = AES-GCM-Encrypt(key, iv, utf8(plaintext), aad=空)`（输出已含末尾 16 字节 Tag）
4. `out = urlencode(base64(iv ‖ ct_tag))`

### 解密步骤

1. `s = urldecode(trim(input))`。**`+` 必须保留为 `+`**，不能当空格（Python 用 `unquote` 不用 `unquote_plus`；Java 不能直接用 `URLDecoder`，见第 6 节）
2. `raw = base64_decode(s)`，长度必须 ≥ 28（12 + 16）
3. `iv = raw[0:12]`，`ct_tag = raw[12:]`
4. `plaintext = AES-GCM-Decrypt(key, iv, ct_tag, aad=空)`。先校验 Tag，失败直接报错，不输出任何明文
5. `utf8_decode(plaintext)`

## 3. 后端参考实现（Python / FastAPI）

依赖（固定版本，与本仓库一致）：

```text
fastapi==0.115.6
pydantic==2.13.4
cryptography==46.0.7
jinja2==3.1.5
```

### 3.1 加解密核心（与框架无关，可单独成模块）

```python
"""AES-GCM 加解密核心：IV(12) + 密文 + Tag(16) → Base64 → URL 编码。"""
from __future__ import annotations

import base64
import binascii
import os
from urllib.parse import quote, unquote

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

IV_LEN = 12
TAG_LEN = 16


def _key(secret: str) -> bytes:
    """密钥字符串按 UTF-8 直接作为 AES 密钥，长度决定 AES-128/192/256。"""
    key = secret.encode("utf-8")
    if len(key) not in (16, 24, 32):
        raise ValueError(f"密钥必须是 16/24/32 字节（UTF-8），当前 {len(key)} 字节")
    return key


def encrypt(plaintext: str, secret: str) -> str:
    iv = os.urandom(IV_LEN)
    # AESGCM.encrypt 返回 密文 + Tag(16)
    ct_tag = AESGCM(_key(secret)).encrypt(iv, plaintext.encode("utf-8"), None)
    # safe="" 才与 encodeURIComponent 一致（会把 / 编成 %2F）
    return quote(base64.b64encode(iv + ct_tag).decode("ascii"), safe="")


def decrypt(ciphertext: str, secret: str) -> str:
    # unquote 不会把 + 变空格；未做过 URL 编码的原始 Base64 也能直接解
    try:
        raw = base64.b64decode(unquote(ciphertext.strip()), validate=True)
    except binascii.Error as exc:
        raise ValueError(f"不是合法的标准 Base64：{exc}") from exc
    if len(raw) < IV_LEN + TAG_LEN:
        raise ValueError("密文过短：不足 IV(12) + Tag(16) 字节")
    try:
        plaintext = AESGCM(_key(secret)).decrypt(raw[:IV_LEN], raw[IV_LEN:], None)
    except InvalidTag:
        # InvalidTag 的 str() 为空，必须自己给出可读原因
        raise ValueError("认证失败：密钥不对，或密文被截断 / 篡改") from None
    return plaintext.decode("utf-8")
```

### 3.2 密钥配置

```python
import os
from dataclasses import dataclass


@dataclass(frozen=True)
class CryptoSecret:
    id: str      # 前端下拉框的 value
    label: str   # 前端展示名
    value: str   # 真实密钥，只在后端使用


_PRESETS = (
    ("secret", "默认密钥 (CRYPTO_SECRET)", "CRYPTO_SECRET"),
    ("secret_bak", "备用密钥 (CRYPTO_SECRET_BAK)", "CRYPTO_SECRET_BAK"),
)


def get_crypto_secrets() -> list[CryptoSecret]:
    """只返回已配置的密钥；仓库内不放任何明文默认值。"""
    result = []
    for sid, label, env_name in _PRESETS:
        value = os.getenv(env_name, "").strip()
        if value:
            result.append(CryptoSecret(sid, label, value))
    return result
```

环境变量写进已 gitignore 的 `.env` / `prod.env`：

```dotenv
CRYPTO_SECRET=<16 字节密钥，与前端 VITE_APP_SECRET 相同>
CRYPTO_SECRET_BAK=<可选，备用密钥>
```

### 3.3 路由

```python
import json
from typing import Literal

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

router = APIRouter(prefix="/tools/aes-crypto")


class CryptoRequest(BaseModel):
    text: str
    mode: Literal["encrypt", "decrypt"] = "decrypt"
    secret_id: str = "secret"


class CryptoResponse(BaseModel):
    ok: bool
    result: str = ""
    error: str = ""


@router.get("", response_class=HTMLResponse)
async def page(request: Request):
    # 只把 id / label 交给模板，真实密钥不进渲染上下文
    options = [{"id": s.id, "label": s.label} for s in get_crypto_secrets()]
    return templates.TemplateResponse(
        "tools/aes_crypto.html", {"request": request, "secrets": options}
    )


@router.post("/api", response_model=CryptoResponse)
async def process(payload: CryptoRequest) -> CryptoResponse:
    if not payload.text.strip():
        return CryptoResponse(ok=False, error="请输入内容")

    secrets = get_crypto_secrets()
    secret = next((s.value for s in secrets if s.id == payload.secret_id), None)
    if secret is None:
        if not secrets:
            return CryptoResponse(ok=False, error="未配置预设密钥：请设置 CRYPTO_SECRET 后重启服务")
        return CryptoResponse(ok=False, error=f"未知密钥: {payload.secret_id}")

    action = "加密" if payload.mode == "encrypt" else "解密"
    try:
        if payload.mode == "encrypt":
            result = encrypt(payload.text, secret)
        else:
            result = decrypt(payload.text, secret)
            try:  # JSON 则美化
                result = json.dumps(json.loads(result), indent=2, ensure_ascii=False)
            except ValueError:
                pass
    except (ValueError, UnicodeDecodeError) as exc:
        return CryptoResponse(ok=False, error=f"{action}失败: {exc}")

    return CryptoResponse(ok=True, result=result)
```

### 3.4 接口契约

`POST /tools/aes-crypto/api`，`Content-Type: application/json`

| 字段 | 类型 | 说明 |
|---|---|---|
| `text` | string | 加密时为明文（字符串或 JSON 文本）；解密时为密文 |
| `mode` | `"encrypt"` \| `"decrypt"` | 默认 `decrypt` |
| `secret_id` | string | `secret` / `secret_bak` |

响应始终是 HTTP 200：

```json
{"ok": true,  "result": "...", "error": ""}
{"ok": false, "result": "",    "error": "解密失败: 认证失败：密钥不对，或密文被截断 / 篡改"}
```

## 4. 前端页面

原生 HTML + JS 即可，页面不做任何加解密，只负责收集输入和展示结果。

```html
<textarea id="input" placeholder="加密：粘贴明文（字符串或 JSON）&#10;解密：粘贴密文"></textarea>

<label><input type="radio" name="mode" value="encrypt"> 加密</label>
<label><input type="radio" name="mode" value="decrypt" checked> 解密</label>
<label>密钥
  <select id="secret">
    {% for s in secrets %}<option value="{{ s.id }}">{{ s.label }}</option>{% endfor %}
  </select>
</label>

<button id="run">执行</button>
<button id="clear">清空</button>
<button id="copy">复制</button>
<pre id="output" aria-live="polite"></pre>

<script>
  const input = document.getElementById('input');
  const output = document.getElementById('output');

  document.getElementById('run').addEventListener('click', async () => {
    const res = await fetch('/tools/aes-crypto/api', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        text: input.value,
        mode: document.querySelector('input[name="mode"]:checked').value,
        secret_id: document.getElementById('secret').value,
      }),
    }).then(r => r.json());
    output.textContent = res.ok ? res.result : res.error;   // 用 textContent，防 XSS
    output.classList.toggle('error', !res.ok);
  });
  document.getElementById('clear').addEventListener('click', () => {
    input.value = ''; output.textContent = ''; output.classList.remove('error');
  });
  document.getElementById('copy').addEventListener('click', () =>
    navigator.clipboard.writeText(output.textContent));
</script>
```

## 5. 安全要求

- **接口必须挂在登录鉴权之后**。这个接口实际上就是「用线上密钥替任何人解密 / 伪造请求」的入口，不能匿名暴露。
- 真实密钥只从环境变量读，不进仓库、不进模板上下文、不进日志、不进错误信息。
- 密钥轮换：新密钥配到 `CRYPTO_SECRET_BAK` 先验证，再互换。

## 6. 其他语言对照（同一协议）

### Node.js

本仓库 `apifox_tt_crypto_cli.mjs` 的 `encryptBody` / `decryptBody` 可直接搬。要点：Node 的 `createCipheriv` 不会自动拼 Tag，要手动 `getAuthTag()` 拼到末尾；解密时手动切出末尾 16 字节再 `setAuthTag()`。

```js
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function aes(secret) {
  const key = Buffer.from(secret, 'utf8');
  if (![16, 24, 32].includes(key.length)) throw new Error(`AES key must be 16/24/32 bytes, got ${key.length}`);
  return { algorithm: `aes-${key.length * 8}-gcm`, key };
}

export function encrypt(plain, secret) {
  const { algorithm, key } = aes(secret);
  const iv = randomBytes(12);
  const c = createCipheriv(algorithm, key, iv);
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return encodeURIComponent(Buffer.concat([iv, ct, c.getAuthTag()]).toString('base64'));
}

export function decrypt(encoded, secret) {
  const { algorithm, key } = aes(secret);
  const raw = Buffer.from(decodeURIComponent(encoded.trim()), 'base64');
  if (raw.length < 28) throw new Error('ciphertext shorter than IV + tag');
  const d = createDecipheriv(algorithm, key, raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(raw.length - 16));
  return Buffer.concat([d.update(raw.subarray(12, raw.length - 16)), d.final()]).toString('utf8');
}
```

### 浏览器 Web Crypto（小程序前端同款）

`subtle.encrypt` 输出本身就是 `密文 ‖ Tag`，与 Python `AESGCM` 一致。

```js
const enc = new TextEncoder();
const dec = new TextDecoder();

const importKey = (secret) =>
  crypto.subtle.importKey('raw', enc.encode(secret), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);

function toB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);  // 逐字节，避免大数组展开爆栈
  return btoa(s);
}
const fromB64 = (b64) => Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));

export async function encrypt(plain, secret) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await importKey(secret), enc.encode(plain)));
  const raw = new Uint8Array(12 + ct.length);
  raw.set(iv);
  raw.set(ct, 12);
  return encodeURIComponent(toB64(raw));
}

export async function decrypt(encoded, secret) {
  const raw = fromB64(decodeURIComponent(encoded.trim()));
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.subarray(0, 12) }, await importKey(secret), raw.subarray(12));
  return dec.decode(pt);
}
```

### Java（JDK 8+）

`Cipher` 的 `AES/GCM/NoPadding` 在 `doFinal` 时输出 / 校验的同样是 `密文 ‖ Tag`。
**不要直接用 `URLDecoder.decode`**：它按表单规则把 `+` 当空格，会把未 URL 编码的 Base64 解坏；先把 `+` 转成 `%2B` 再解码。

```java
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;

public final class AesGcmCodec {
    private static final int IV_LEN = 12, TAG_BITS = 128;
    private static final SecureRandom RANDOM = new SecureRandom();

    private static SecretKeySpec key(String secret) {
        byte[] k = secret.getBytes(StandardCharsets.UTF_8);
        if (k.length != 16 && k.length != 24 && k.length != 32)
            throw new IllegalArgumentException("AES key must be 16/24/32 bytes, got " + k.length);
        return new SecretKeySpec(k, "AES");
    }

    public static String encrypt(String plain, String secret) throws Exception {
        byte[] iv = new byte[IV_LEN];
        RANDOM.nextBytes(iv);
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.ENCRYPT_MODE, key(secret), new GCMParameterSpec(TAG_BITS, iv));
        byte[] ctTag = c.doFinal(plain.getBytes(StandardCharsets.UTF_8));
        byte[] raw = ByteBuffer.allocate(IV_LEN + ctTag.length).put(iv).put(ctTag).array();
        // Base64 字符集里只有 + / = 需要编码，URLEncoder 对它们的结果与 encodeURIComponent 相同
        return URLEncoder.encode(Base64.getEncoder().encodeToString(raw), "UTF-8");
    }

    public static String decrypt(String encoded, String secret) throws Exception {
        String b64 = URLDecoder.decode(encoded.trim().replace("+", "%2B"), "UTF-8");
        byte[] raw = Base64.getDecoder().decode(b64);
        if (raw.length < IV_LEN + TAG_BITS / 8) throw new IllegalArgumentException("ciphertext too short");
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.DECRYPT_MODE, key(secret), new GCMParameterSpec(TAG_BITS, Arrays.copyOfRange(raw, 0, IV_LEN)));
        return new String(c.doFinal(raw, IV_LEN, raw.length - IV_LEN), StandardCharsets.UTF_8);
    }
}
```

## 7. 相对原实现的修正点

| # | 原实现 | 问题 | 参考实现 |
|---|---|---|---|
| 1 | `quote(b64)` | 默认 `safe='/'`，`/` 不编码，与 `encodeURIComponent` 输出不逐字一致（能互解，但字符串比对会不同） | `quote(b64, safe="")` |
| 2 | 捕获 `Exception` 后 `f"{exc}"` | `InvalidTag` 的文本为空，页面只显示「解密失败: 」 | 捕获 `InvalidTag` 转成可读原因 |
| 3 | `b64decode` 不校验 | 非法字符被静默丢弃；URL-safe Base64（`-` `_`）会解出错误字节，最后报成 Tag 失败，误导为密钥问题 | `validate=True`，格式错误单独报 |
| 4 | 无长度校验 | 密钥长度不对时报 cryptography 内部异常；密文过短报 Tag 失败 | 显式校验密钥 16/24/32、密文 ≥ 28 字节 |

另：原实现把含 `value` 的 `CryptoSecret` 对象整体传进模板（模板只渲染了 id / label，未泄漏），参考实现改为只传 id / label，避免以后模板改动误把密钥渲染出去。

## 8. 验收清单

用一个**测试密钥**（不要用线上密钥），逐条验证：

- [ ] 往返：任意明文（含中文、emoji、JSON）加密后再解密，结果与原文一致
- [ ] 随机性：同一明文加密两次，密文不同（IV 随机）
- [ ] 跨端互通：本项目加密 → 前端 / Node / Java 解密成功；反向同样成功
- [ ] 兼容输入：URL 编码后的密文、未 URL 编码的原始 Base64（含 `+`）都能解
- [ ] 输出格式：加密结果中不含裸 `+` `/` `=`（均为 `%2B` `%2F` `%3D`）
- [ ] 篡改：改动密文任意一个字符 → 报「认证失败」，不输出任何明文
- [ ] 错误密钥 → 报「认证失败」
- [ ] 密钥长度非 16/24/32 → 报长度错误
- [ ] JSON 明文解密后按 2 格缩进展示，中文不转义
- [ ] 未配置 `CRYPTO_SECRET` → 页面下拉为空，接口返回「未配置预设密钥」
- [ ] 未登录访问页面和 `/api` 均被拦截
- [ ] 页面源码与接口响应中搜不到真实密钥
