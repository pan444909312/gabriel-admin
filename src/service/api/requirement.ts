import { request } from '../request';

export function fetchRequirementPage(params: Api.Requirement.PageParams) {
  return request<Api.Requirement.PageResult>({
    url: '/api/gabriel/requirement/page',
    method: 'get',
    params
  });
}

export function fetchCreateRequirement(name: string) {
  return request<null>({
    url: '/api/gabriel/requirement/create',
    method: 'post',
    data: { name }
  });
}

export function fetchUploadRequirement(formData: FormData) {
  return request<null>({
    url: '/api/gabriel/requirement/upload',
    method: 'post',
    data: formData,
    headers: { 'Content-Type': 'multipart/form-data' }
  });
}

export function fetchDecomposeRequirement(id: number) {
  return request<null>({
    url: '/api/gabriel/requirement/decompose',
    method: 'post',
    data: { id }
  });
}

export function fetchGenerateRequirement(id: number) {
  return request<null>({
    url: '/api/gabriel/requirement/generate',
    method: 'post',
    data: { id }
  });
}

export function fetchDeleteRequirement(id: number) {
  return request<null>({
    url: '/api/gabriel/requirement/delete',
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
