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
  try {
    const { error } = await fetchCreateRequirement(name.value.trim());
    if (!error) {
      message.success('创建成功');
      visible.value = false;
      emit('success');
    } else {
      message.error(error.message || '创建失败');
    }
  } finally {
    loading.value = false;
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
