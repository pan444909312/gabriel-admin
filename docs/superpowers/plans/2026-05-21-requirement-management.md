# Requirement Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "需求管理" top-level menu page that lets users create requirements, upload MD files, trigger async decompose/generate operations, and download test cases — all inline in the list table.

**Architecture:** Three Vue components (list page + two modals) backed by a typed API service layer. The list polls every 3s when any row is in-progress (status 1 or 3). Router, i18n, and type declarations are manually patched since elegant-router generates those files.

**Tech Stack:** Vue 3.5, Naive UI 2.44, Pinia, vue-i18n 11, SoybeanAdmin `createFlatRequest`, elegant-router

---

### Task 1: API Type Declarations

**Files:**

- Create: `src/typings/api/requirement.d.ts`

- [ ] **Step 1: Create the type declaration file**

```ts
declare namespace Api {
  namespace Requirement {
    type Status = 0 | 1 | 2 | 3 | 4 | 5;

    interface Item {
      id: number;
      name: string;
      status: Status;
      requirementFilePath: string | null;
      features: string | null;
      errorMessage: string | null;
      createTime: string;
    }

    type PageParams = Api.Common.CommonSearchParams & { name?: string };
    type PageResult = Api.Common.PaginatingQueryRecord<Item>;
  }
}
```

- [ ] **Step 2: Verify TypeScript picks it up**

Run: `pnpm typecheck` (or `vue-tsc --noEmit`)
Expected: no errors related to `Api.Requirement`

- [ ] **Step 3: Commit**

```bash
git add src/typings/api/requirement.d.ts
git commit -m "feat(types): add Requirement API type declarations"
```

---

### Task 2: API Service Layer

**Files:**

- Create: `src/service/api/requirement.ts`

- [ ] **Step 1: Create the API service file**

```ts
import { request } from '../request';

export function fetchRequirementPage(params: Api.Requirement.PageParams) {
  return request<Api.Requirement.PageResult>({
    url: '/requirement/page',
    method: 'get',
    params
  });
}

export function fetchCreateRequirement(name: string) {
  return request<null>({
    url: '/requirement/create',
    method: 'post',
    data: { name }
  });
}

export function fetchUploadRequirement(formData: FormData) {
  return request<null>({
    url: '/requirement/upload',
    method: 'post',
    data: formData,
    headers: { 'Content-Type': 'multipart/form-data' }
  });
}

export function fetchDecomposeRequirement(id: number) {
  return request<null>({
    url: '/requirement/decompose',
    method: 'post',
    data: { id }
  });
}

export function fetchGenerateRequirement(id: number) {
  return request<null>({
    url: '/requirement/generate',
    method: 'post',
    data: { id }
  });
}

export function fetchDeleteRequirement(id: number) {
  return request<null>({
    url: '/requirement/delete',
    method: 'post',
    data: { id }
  });
}

export function downloadRequirementMarkdown(id: number) {
  const a = document.createElement('a');
  a.href = `/api/gabriel/requirement/download/markdown?id=${id}`;
  a.download = 'test-cases.md';
  a.click();
}

export function downloadRequirementXmind(id: number) {
  const a = document.createElement('a');
  a.href = `/api/gabriel/requirement/download/xmind?id=${id}`;
  a.download = 'test-cases.xmind';
  a.click();
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `pnpm typecheck`
Expected: no errors in `src/service/api/requirement.ts`

- [ ] **Step 3: Commit**

```bash
git add src/service/api/requirement.ts
git commit -m "feat(api): add requirement service functions"
```

---

### Task 3: Router Registration

**Files:**

- Modify: `src/router/elegant/routes.ts`
- Modify: `src/router/elegant/imports.ts`
- Modify: `src/typings/elegant-router.d.ts`

- [ ] **Step 1: Add route to routes.ts**

In `src/router/elegant/routes.ts`, find the `generatedRoutes` array and add after the last single-level route entry (e.g., after the `home` entry):

```ts
{
  name: 'requirement',
  path: '/requirement',
  component: 'layout.base$view.requirement',
  meta: {
    title: 'requirement',
    i18nKey: 'route.requirement',
    icon: 'mdi:file-document-outline',
    order: 2
  }
},
```

- [ ] **Step 2: Add view import to imports.ts**

In `src/router/elegant/imports.ts`, inside the `views` object, add:

```ts
requirement: () => import('@/views/requirement/index.vue'),
```

- [ ] **Step 3: Add type to elegant-router.d.ts**

In `src/typings/elegant-router.d.ts`, find the `RouteMap` interface and add:

```ts
requirement: '/requirement';
```

Find `FirstLevelRouteKey` (or `SingleLevelRouteKey`) union type and add `'requirement'` to it.

Find `LastLevelRouteKey` union type and add `'requirement'` to it.

- [ ] **Step 4: Verify TypeScript**

Run: `pnpm typecheck`
Expected: no errors about unknown route keys

- [ ] **Step 5: Commit**

```bash
git add src/router/elegant/routes.ts src/router/elegant/imports.ts src/typings/elegant-router.d.ts
git commit -m "feat(router): register requirement route"
```

---

### Task 4: i18n Translations

**Files:**

- Modify: `src/locales/langs/zh-cn.ts`
- Modify: `src/locales/langs/en-us.ts`

- [ ] **Step 1: Add zh-cn entries**

In `src/locales/langs/zh-cn.ts`, add to the `route` object:

```ts
requirement: '需求管理',
```

Add to the `page` object:

```ts
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
},
```

- [ ] **Step 2: Add en-us entries**

In `src/locales/langs/en-us.ts`, add to the `route` object:

```ts
requirement: 'Requirements',
```

Add to the `page` object:

```ts
requirement: {
  title: 'Requirements',
  createBtn: 'New Requirement',
  searchPlaceholder: 'Search requirement name...',
  columns: {
    index: '#',
    name: 'Name',
    status: 'Status',
    createTime: 'Created At',
    action: 'Actions'
  },
  status: {
    pending: 'Pending',
    decomposing: 'Decomposing',
    decomposed: 'Decomposed',
    generating: 'Generating',
    done: 'Done',
    failed: 'Failed'
  },
  actions: {
    upload: 'Upload',
    reUpload: 'Re-upload',
    decompose: 'Decompose',
    generate: 'Generate',
    downloadMd: 'Download MD',
    downloadXmind: 'Download XMind',
    retry: 'Retry',
    delete: 'Delete'
  },
  createModal: {
    title: 'New Requirement',
    namePlaceholder: 'Enter requirement name'
  },
  uploadModal: {
    title: 'Upload Files',
    requirementFile: 'Requirement Doc',
    techFile: 'Tech Spec',
    requirementFileTip: 'Upload a .md requirement document',
    techFileTip: 'Optional: upload a .md tech spec document'
  }
},
```

- [ ] **Step 3: Verify TypeScript**

Run: `pnpm typecheck`
Expected: no i18n key errors

- [ ] **Step 4: Commit**

```bash
git add src/locales/langs/zh-cn.ts src/locales/langs/en-us.ts
git commit -m "feat(i18n): add requirement management translations"
```

---

### Task 5: Create Modal Component

**Files:**

- Create: `src/views/requirement/modules/create-modal.vue`

- [ ] **Step 1: Create the component**

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { useMessage } from 'naive-ui';
import { $t } from '@/locales';
import { fetchCreateRequirement } from '@/service/api/requirement';

defineOptions({ name: 'RequirementCreateModal' });

const emit = defineEmits<{ (e: 'success'): void }>();

const message = useMessage();
const visible = ref(false);
const loading = ref(false);
const name = ref('');

function open() {
  name.value = '';
  visible.value = true;
}

async function handleConfirm() {
  if (!name.value.trim()) {
    message.warning('请输入需求名称');
    return;
  }
  loading.value = true;
  const { error } = await fetchCreateRequirement(name.value.trim());
  loading.value = false;
  if (!error) {
    message.success('创建成功');
    visible.value = false;
    emit('success');
  } else {
    message.error(error.message || '创建失败');
  }
}

defineExpose({ open });
</script>

<template>
  <NModal v-model:show="visible" preset="card" :title="$t('page.requirement.createModal.title')" style="width: 420px">
    <NForm label-placement="top">
      <NFormItem :label="$t('page.requirement.columns.name')" required>
        <NInput
          v-model:value="name"
          :placeholder="$t('page.requirement.createModal.namePlaceholder')"
          :maxlength="255"
          show-count
          @keydown.enter="handleConfirm"
        />
      </NFormItem>
    </NForm>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="visible = false">{{ $t('common.cancel') }}</NButton>
        <NButton type="primary" :loading="loading" @click="handleConfirm">{{ $t('common.confirm') }}</NButton>
      </NSpace>
    </template>
  </NModal>
</template>
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `pnpm typecheck`
Expected: no errors in `create-modal.vue`

- [ ] **Step 3: Commit**

```bash
git add src/views/requirement/modules/create-modal.vue
git commit -m "feat(requirement): add create requirement modal"
```

---

### Task 6: Upload Modal Component

**Files:**

- Create: `src/views/requirement/modules/upload-modal.vue`

- [ ] **Step 1: Create the component**

```vue
<script setup lang="ts">
import { ref } from 'vue';
import type { UploadFileInfo } from 'naive-ui';
import { useMessage } from 'naive-ui';
import { $t } from '@/locales';
import { fetchUploadRequirement } from '@/service/api/requirement';

defineOptions({ name: 'RequirementUploadModal' });

const emit = defineEmits<{ (e: 'success'): void }>();

const message = useMessage();
const visible = ref(false);
const loading = ref(false);
const requirementId = ref<number>(0);
const requirementFiles = ref<UploadFileInfo[]>([]);
const techFiles = ref<UploadFileInfo[]>([]);

function open(id: number) {
  requirementId.value = id;
  requirementFiles.value = [];
  techFiles.value = [];
  visible.value = true;
}

async function handleUpload() {
  if (requirementFiles.value.length === 0) {
    message.warning('请上传需求文档');
    return;
  }
  const file = requirementFiles.value[0].file;
  if (!file) return;

  const formData = new FormData();
  formData.append('id', String(requirementId.value));
  formData.append('requirementFile', file);
  if (techFiles.value.length > 0 && techFiles.value[0].file) {
    formData.append('techFile', techFiles.value[0].file);
  }

  loading.value = true;
  const { error } = await fetchUploadRequirement(formData);
  loading.value = false;
  if (!error) {
    message.success('上传成功');
    visible.value = false;
    emit('success');
  } else {
    message.error(error.message || '上传失败');
  }
}

defineExpose({ open });
</script>

<template>
  <NModal v-model:show="visible" preset="card" :title="$t('page.requirement.uploadModal.title')" style="width: 480px">
    <NForm label-placement="top">
      <NFormItem required>
        <template #label>
          {{ $t('page.requirement.uploadModal.requirementFile') }}
          <NText type="error" style="margin-left: 4px">*</NText>
        </template>
        <NUpload v-model:file-list="requirementFiles" accept=".md" :max="1" :default-upload="false">
          <NUploadDragger>
            <NText depth="3" style="font-size: 13px">{{ $t('page.requirement.uploadModal.requirementFileTip') }}</NText>
          </NUploadDragger>
        </NUpload>
      </NFormItem>
      <NFormItem :label="$t('page.requirement.uploadModal.techFile')">
        <NUpload v-model:file-list="techFiles" accept=".md" :max="1" :default-upload="false">
          <NUploadDragger>
            <NText depth="3" style="font-size: 13px">{{ $t('page.requirement.uploadModal.techFileTip') }}</NText>
          </NUploadDragger>
        </NUpload>
      </NFormItem>
    </NForm>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="visible = false">{{ $t('common.cancel') }}</NButton>
        <NButton type="primary" :loading="loading" @click="handleUpload">{{ $t('common.confirm') }}</NButton>
      </NSpace>
    </template>
  </NModal>
</template>
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `pnpm typecheck`
Expected: no errors in `upload-modal.vue`

- [ ] **Step 3: Commit**

```bash
git add src/views/requirement/modules/upload-modal.vue
git commit -m "feat(requirement): add upload files modal"
```

---

### Task 7: Main List Page

**Files:**

- Create: `src/views/requirement/index.vue`

- [ ] **Step 1: Create the main page**

```vue
<script setup lang="ts">
import { h, ref, computed, onMounted, onUnmounted } from 'vue';
import type { DataTableColumns } from 'naive-ui';
import { NButton, NTag, NPopconfirm, NSpace, NSpin, useMessage } from 'naive-ui';
import { $t } from '@/locales';
import {
  fetchRequirementPage,
  fetchDecomposeRequirement,
  fetchGenerateRequirement,
  fetchDeleteRequirement,
  downloadRequirementMarkdown,
  downloadRequirementXmind
} from '@/service/api/requirement';
import CreateModal from './modules/create-modal.vue';
import UploadModal from './modules/upload-modal.vue';

defineOptions({ name: 'RequirementPage' });

const message = useMessage();
const createModalRef = ref<InstanceType<typeof CreateModal>>();
const uploadModalRef = ref<InstanceType<typeof UploadModal>>();

const loading = ref(false);
const data = ref<Api.Requirement.Item[]>([]);
const total = ref(0);
const pageNum = ref(1);
const pageSize = ref(10);
const searchName = ref('');

let pollTimer: ReturnType<typeof setInterval> | null = null;

const hasInProgress = computed(() => data.value.some(row => row.status === 1 || row.status === 3));

async function loadData() {
  loading.value = true;
  const { data: res, error } = await fetchRequirementPage({
    pageNum: pageNum.value,
    pageSize: pageSize.value,
    name: searchName.value || undefined
  });
  loading.value = false;
  if (!error && res) {
    data.value = res.records;
    total.value = res.total;
  }
}

function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(async () => {
    if (!hasInProgress.value) {
      stopPolling();
      return;
    }
    const { data: res, error } = await fetchRequirementPage({
      pageNum: pageNum.value,
      pageSize: pageSize.value,
      name: searchName.value || undefined
    });
    if (!error && res) {
      data.value = res.records;
      total.value = res.total;
    }
  }, 3000);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function refresh() {
  await loadData();
  if (hasInProgress.value) startPolling();
  else stopPolling();
}

async function handleDecompose(id: number) {
  const { error } = await fetchDecomposeRequirement(id);
  if (!error) {
    message.success('已触发拆解');
    await refresh();
  } else {
    message.error(error.message || '触发失败');
  }
}

async function handleGenerate(id: number) {
  const { error } = await fetchGenerateRequirement(id);
  if (!error) {
    message.success('已触发生成');
    await refresh();
  } else {
    message.error(error.message || '触发失败');
  }
}

async function handleDelete(id: number) {
  const { error } = await fetchDeleteRequirement(id);
  if (!error) {
    message.success('删除成功');
    await refresh();
  } else {
    message.error(error.message || '删除失败');
  }
}

async function handleRetry(row: Api.Requirement.Item) {
  if (!row.features) {
    await handleDecompose(row.id);
  } else {
    await handleGenerate(row.id);
  }
}

const statusTagMap: Record<
  Api.Requirement.Status,
  { type: 'default' | 'warning' | 'info' | 'success' | 'error'; label: string; spinning?: boolean }
> = {
  0: { type: 'default', label: 'pending' },
  1: { type: 'warning', label: 'decomposing', spinning: true },
  2: { type: 'info', label: 'decomposed' },
  3: { type: 'warning', label: 'generating', spinning: true },
  4: { type: 'success', label: 'done' },
  5: { type: 'error', label: 'failed' }
};

const columns = computed<DataTableColumns<Api.Requirement.Item>>(() => [
  {
    key: 'index',
    title: $t('page.requirement.columns.index'),
    width: 60,
    render: (_row, index) => (pageNum.value - 1) * pageSize.value + index + 1
  },
  {
    key: 'name',
    title: $t('page.requirement.columns.name'),
    minWidth: 160
  },
  {
    key: 'status',
    title: $t('page.requirement.columns.status'),
    width: 120,
    render: row => {
      const cfg = statusTagMap[row.status];
      return h(
        NTag,
        { type: cfg.type, size: 'small' },
        {
          default: () =>
            cfg.spinning
              ? h(
                  NSpace,
                  { align: 'center', size: 4 },
                  {
                    default: () => [h(NSpin, { size: 12 }), $t(`page.requirement.status.${cfg.label}`)]
                  }
                )
              : $t(`page.requirement.status.${cfg.label}`)
        }
      );
    }
  },
  {
    key: 'createTime',
    title: $t('page.requirement.columns.createTime'),
    width: 160,
    render: row => row.createTime?.slice(0, 16) ?? '-'
  },
  {
    key: 'action',
    title: $t('page.requirement.columns.action'),
    width: 300,
    render: row => {
      const btns: ReturnType<typeof h>[] = [];
      const { status, id, requirementFilePath, features, errorMessage } = row;

      if (status === 0) {
        btns.push(
          h(
            NButton,
            { size: 'small', type: 'primary', ghost: true, onClick: () => uploadModalRef.value?.open(id) },
            {
              default: () =>
                requirementFilePath ? $t('page.requirement.actions.reUpload') : $t('page.requirement.actions.upload')
            }
          ),
          h(
            NButton,
            {
              size: 'small',
              type: 'primary',
              ghost: true,
              disabled: !requirementFilePath,
              onClick: () => handleDecompose(id)
            },
            { default: () => $t('page.requirement.actions.decompose') }
          )
        );
      } else if (status === 1) {
        btns.push(
          h(
            NButton,
            { size: 'small', disabled: true },
            { default: () => $t('page.requirement.status.decomposing') + '...' }
          )
        );
      } else if (status === 2) {
        btns.push(
          h(
            NButton,
            { size: 'small', type: 'primary', ghost: true, onClick: () => handleGenerate(id) },
            { default: () => $t('page.requirement.actions.generate') }
          )
        );
      } else if (status === 3) {
        btns.push(
          h(
            NButton,
            { size: 'small', disabled: true },
            { default: () => $t('page.requirement.status.generating') + '...' }
          )
        );
      } else if (status === 4) {
        btns.push(
          h(
            NButton,
            { size: 'small', type: 'info', ghost: true, onClick: () => downloadRequirementMarkdown(id) },
            { default: () => $t('page.requirement.actions.downloadMd') }
          ),
          h(
            NButton,
            {
              size: 'small',
              ghost: true,
              style: 'color:#9b59b6;border-color:rgba(155,89,182,0.4)',
              onClick: () => downloadRequirementXmind(id)
            },
            { default: () => $t('page.requirement.actions.downloadXmind') }
          )
        );
      } else if (status === 5) {
        btns.push(
          h(
            NButton,
            { size: 'small', type: 'warning', ghost: true, onClick: () => handleRetry(row) },
            { default: () => $t('page.requirement.actions.retry') }
          )
        );
        if (errorMessage) {
          btns.push(h('span', { style: 'font-size:12px;color:#d03050;margin-left:4px' }, errorMessage));
        }
      }

      btns.push(
        h(
          NPopconfirm,
          { onPositiveClick: () => handleDelete(id) },
          {
            default: () => '确认删除该需求？',
            trigger: () =>
              h(
                NButton,
                { size: 'small', type: 'error', ghost: true },
                { default: () => $t('page.requirement.actions.delete') }
              )
          }
        )
      );

      return h(NSpace, { size: 6, wrap: true }, { default: () => btns });
    }
  }
]);

onMounted(() => {
  loadData().then(() => {
    if (hasInProgress.value) startPolling();
  });
});

onUnmounted(() => stopPolling());
</script>

<template>
  <NCard>
    <NSpace vertical :size="12">
      <NSpace align="center">
        <NButton type="primary" @click="createModalRef?.open()">+ {{ $t('page.requirement.createBtn') }}</NButton>
        <NInput
          v-model:value="searchName"
          :placeholder="$t('page.requirement.searchPlaceholder')"
          clearable
          style="width: 260px"
          @keydown.enter="refresh"
        />
        <NButton @click="refresh">{{ $t('common.refresh') }}</NButton>
      </NSpace>

      <NDataTable :columns="columns" :data="data" :loading="loading" :pagination="false" size="small" />

      <NSpace justify="end">
        <NPagination
          v-model:page="pageNum"
          v-model:page-size="pageSize"
          :item-count="total"
          :page-sizes="[10, 20, 50]"
          show-size-picker
          @update:page="refresh"
          @update:page-size="refresh"
        />
      </NSpace>
    </NSpace>
  </NCard>

  <CreateModal ref="createModalRef" @success="refresh" />
  <UploadModal ref="uploadModalRef" @success="refresh" />
</template>
```

- [ ] **Step 2: Verify TypeScript**

Run: `pnpm typecheck`
Expected: no errors in `src/views/requirement/`

- [ ] **Step 3: Start dev server and verify the page loads**

Run: `pnpm dev`
Navigate to `http://localhost:9527/requirement` (or whatever port the project uses).
Expected: "需求管理" appears in the sidebar menu, page loads with toolbar and empty table.

- [ ] **Step 4: Commit**

```bash
git add src/views/requirement/index.vue
git commit -m "feat(requirement): add requirement management list page"
```

---

### Task 8: Smoke Test End-to-End

- [ ] **Step 1: Verify menu item appears**

With dev server running, confirm "需求管理" appears in the left sidebar at order position 2.

- [ ] **Step 2: Test create flow**

Click "新建需求", enter a name, click confirm. Verify the row appears in the table with status "待处理" and "上传文件" button.

- [ ] **Step 3: Test upload flow**

Click "上传文件" on a pending row. Verify the modal opens with two upload areas. Upload a `.md` file. Verify the row now shows "重新上传" and an enabled "触发拆解" button.

- [ ] **Step 4: Test polling**

Click "触发拆解". Verify the status tag changes to "拆解中" with a spinner. Verify the table auto-refreshes every 3 seconds without manual action.

- [ ] **Step 5: Test delete with confirmation**

Click "删除" on any row. Verify a popconfirm appears. Confirm deletion. Verify the row disappears.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(requirement): complete requirement management feature"
```
