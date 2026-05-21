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
const current = ref(1);
const size = ref(10);
const searchName = ref('');

let pollTimer: ReturnType<typeof setInterval> | null = null;

const hasInProgress = computed(() => data.value.some(row => row.status === 1 || row.status === 3));

async function loadData() {
  loading.value = true;
  const { data: res, error } = await fetchRequirementPage({
    current: current.value,
    size: size.value,
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
      current: current.value,
      size: size.value,
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

type StatusTagType = 'default' | 'warning' | 'info' | 'success' | 'error';

const statusTagMap: Record<
  Api.Requirement.Status,
  { type: StatusTagType; labelKey: App.I18n.I18nKey; spinning?: boolean }
> = {
  0: { type: 'default', labelKey: 'page.requirement.status.pending' },
  1: { type: 'warning', labelKey: 'page.requirement.status.decomposing', spinning: true },
  2: { type: 'info', labelKey: 'page.requirement.status.decomposed' },
  3: { type: 'warning', labelKey: 'page.requirement.status.generating', spinning: true },
  4: { type: 'success', labelKey: 'page.requirement.status.done' },
  5: { type: 'error', labelKey: 'page.requirement.status.failed' }
};

const columns = computed<DataTableColumns<Api.Requirement.Item>>(() => [
  {
    key: 'index',
    title: $t('page.requirement.columns.index'),
    width: 60,
    render: (_row, index) => (current.value - 1) * size.value + index + 1
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
                    default: () => [h(NSpin, { size: 12 }), $t(cfg.labelKey)]
                  }
                )
              : $t(cfg.labelKey)
        }
      );
    }
  },
  {
    key: 'createTime',
    title: $t('page.requirement.columns.createTime'),
    width: 160,
    render: row => row.createTime?.slice(0, 16).replace('T', ' ') ?? '-'
  },
  {
    key: 'action',
    title: $t('page.requirement.columns.action'),
    width: 300,
    render: row => {
      const btns: ReturnType<typeof h>[] = [];
      const { status, id, requirementFilePath, errorMessage } = row;

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
  <div>
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
            v-model:page="current"
            v-model:page-size="size"
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
  </div>
</template>
