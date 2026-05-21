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
  try {
    const { error } = await fetchUploadRequirement(formData);
    if (!error) {
      message.success('上传成功');
      visible.value = false;
      emit('success');
    } else {
      message.error(error.message || '上传失败');
    }
  } finally {
    loading.value = false;
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
