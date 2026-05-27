# 需求管理前端设计文档

**日期：** 2026-05-21
**状态：** 已确认

---

## 1. 功能概述

为后台管理系统新增「需求管理」一级菜单，提供需求的创建、文件上传、功能点拆解、测试用例生成和下载的完整操作链路。所有操作均在列表页内完成，无需跳转子页面。

核心链路：

1. 新建需求（填写名称）
2. 上传需求 MD / 技术方案 MD
3. 触发功能点拆解（调用后端异步接口）
4. 触发测试用例生成（调用后端异步接口）
5. 下载测试用例（Markdown / XMind）

---

## 2. 页面结构

### 2.1 路由

| 属性     | 值                             |
| -------- | ------------------------------ |
| 路由名称 | `requirement`                  |
| 路径     | `/requirement`                 |
| 组件     | `layout.base$view.requirement` |
| 菜单图标 | `mdi:file-document-outline`    |
| 菜单顺序 | `2`                            |
| i18n Key | `route.requirement`            |

### 2.2 布局

- 顶部工具栏：「新建需求」按钮 + 需求名称搜索框 + 刷新按钮
- NDataTable：展示需求列表，含分页
- 弹窗：新建需求弹窗、上传文件弹窗

---

## 3. 表格列定义

| 列       | 宽度  | 内容                        |
| -------- | ----- | --------------------------- |
| 序号     | 60px  | 自动编号（基于分页偏移）    |
| 需求名称 | —     | 文本，flex 撑满             |
| 状态     | 120px | NTag 彩色标签（见状态映射） |
| 创建时间 | 160px | 格式化为 `YYYY-MM-DD HH:mm` |
| 操作     | 280px | 根据状态动态渲染按钮组      |

---

## 4. 状态映射

| 状态值 | 文案     | NTag 类型 | 备注                             |
| ------ | -------- | --------- | -------------------------------- |
| 0      | 待处理   | default   | 文件已上传未拆解；或刚创建未上传 |
| 1      | 拆解中   | warning   | 显示旋转图标，异步进行中         |
| 2      | 拆解完成 | info      | 可触发生成                       |
| 3      | 生成中   | warning   | 显示旋转图标，异步进行中         |
| 4      | 已完成   | success   | 可下载                           |
| 5      | 失败     | error     | 行内显示 error_message           |

---

## 5. 操作按钮逻辑

每行操作列根据当前状态动态渲染：

| 状态      | 按钮                                                      | 说明                               |
| --------- | --------------------------------------------------------- | ---------------------------------- |
| 0，无文件 | `上传文件`（blue）、`触发拆解`（灰色禁用）、`删除`（red） | requirementFilePath 为空时禁用拆解 |
| 0，有文件 | `重新上传`（blue）、`触发拆解`（green）、`删除`（red）    |                                    |
| 1         | `拆解中...`（禁用）、`删除`（red）                        |                                    |
| 2         | `生成用例`（green）、`删除`（red）                        |                                    |
| 3         | `生成中...`（禁用）、`删除`（red）                        |                                    |
| 4         | `下载 MD`（blue）、`下载 XMind`（purple）、`删除`（red）  |                                    |
| 5         | `重试`（orange）、`删除`（red）+ 行内错误文案             | 重试根据上次失败阶段调用对应接口   |

> **重试逻辑**：后端 `error_message` 中可判断失败阶段；前端简化为：若 `features` 为空则重试拆解，否则重试生成。

---

## 6. 弹窗

### 6.1 新建需求弹窗

- 触发：点击「新建需求」按钮
- 字段：需求名称（必填，NInput，maxlength=255）
- 操作：取消 / 确认（调用 POST `/create`，成功后刷新列表）

### 6.2 上传文件弹窗

- 触发：点击「上传文件」或「重新上传」按钮
- 字段：
  - 需求文档（必填，NUpload，accept=`.md`，单文件）
  - 技术方案（选填，NUpload，accept=`.md`，单文件）
- 操作：取消 / 上传（调用 POST `/upload`，multipart，成功后刷新列表）

---

## 7. 自动轮询

当列表中存在状态为 `1`（拆解中）或 `3`（生成中）的行时，每 **3 秒**自动调用分页接口刷新列表。当所有行均不处于进行中状态时，停止轮询。使用 `setInterval` + `onUnmounted` 清理。

---

## 8. API 服务层

文件：`src/service/api/requirement.ts`

| 函数名                      | 方法 | 路径                             | 参数                                       |
| --------------------------- | ---- | -------------------------------- | ------------------------------------------ |
| `fetchRequirementPage`      | GET  | `/requirement/page`              | `pageNum, pageSize, name?`                 |
| `fetchCreateRequirement`    | POST | `/requirement/create`            | `{ name }`                                 |
| `fetchUploadRequirement`    | POST | `/requirement/upload`            | FormData: `id, requirementFile, techFile?` |
| `fetchDecomposeRequirement` | POST | `/requirement/decompose`         | `{ id }`                                   |
| `fetchGenerateRequirement`  | POST | `/requirement/generate`          | `{ id }`                                   |
| `fetchDeleteRequirement`    | POST | `/requirement/delete`            | `{ id }`                                   |
| `fetchDownloadMarkdown`     | GET  | `/requirement/download/markdown` | `id`（触发浏览器下载）                     |
| `fetchDownloadXmind`        | GET  | `/requirement/download/xmind`    | `id`（触发浏览器下载）                     |

下载接口通过 `window.open` 或创建 `<a>` 标签触发浏览器下载，不走 axios 拦截器。

---

## 9. 文件结构

```
src/
├── views/
│   └── requirement/
│       ├── index.vue                  # 主页面（列表 + 工具栏 + 分页）
│       └── modules/
│           ├── create-modal.vue       # 新建需求弹窗
│           └── upload-modal.vue       # 上传文件弹窗
├── service/
│   └── api/
│       └── requirement.ts             # API 函数
├── router/
│   └── elegant/
│       ├── routes.ts                  # 新增 requirement 路由
│       └── imports.ts                 # 新增 requirement 视图导入
└── locales/
    └── langs/
        ├── zh-cn.ts                   # 新增 route.requirement + page.requirement
        └── en-us.ts                   # 同上
```

---

## 10. i18n 词条

### zh-cn

```ts
route: {
  requirement: '需求管理'
}
page: {
  requirement: {
    title: '需求管理',
    createBtn: '新建需求',
    searchPlaceholder: '搜索需求名称...',
    columns: {
      index: '序号',
      name: '需求名称',
      status: '状态',
      createTime: '创建时间',
      action: '操作'
    },
    status: {
      pending: '待处理',
      decomposing: '拆解中',
      decomposed: '拆解完成',
      generating: '生成中',
      done: '已完成',
      failed: '失败'
    },
    actions: {
      upload: '上传文件',
      reUpload: '重新上传',
      decompose: '触发拆解',
      generate: '生成用例',
      downloadMd: '下载 MD',
      downloadXmind: '下载 XMind',
      retry: '重试',
      delete: '删除'
    },
    createModal: {
      title: '新建需求',
      namePlaceholder: '请输入需求名称'
    },
    uploadModal: {
      title: '上传文件',
      requirementFile: '需求文档',
      techFile: '技术方案',
      requirementFileTip: '请上传 .md 格式的需求文档',
      techFileTip: '选填，上传 .md 格式的技术方案文档'
    }
  }
}
```

### en-us（对应英文）

```ts
route: {
  requirement: 'Requirements'
}
page: {
  requirement: {
    title: 'Requirements',
    createBtn: 'New Requirement',
    searchPlaceholder: 'Search requirement name...',
    // ... (same structure, English values)
  }
}
```

---

## 11. 错误处理

- 所有 API 调用失败时通过 `window.$message.error` 显示错误信息
- 拆解/生成触发后若后端返回非 200，提示错误并不更新本地状态（等待下次刷新）
- 删除操作使用 NPopconfirm 二次确认
- 上传弹窗中文件格式校验在前端完成（accept=`.md`）
