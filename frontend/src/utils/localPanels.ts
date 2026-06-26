export interface NoticeItem {
  id: number;
  title: string;
  message: string;
  author: string;
  created_at: string;
}

export interface ServiceTask {
  id: number;
  machine: string;
  description: string;
  available_from: string;
  created_by: string;
  created_at: string;
}

const noticesKey = 'adw_notice_board';
const serviceTasksKey = 'adw_service_tasks';

function readJson<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getNotices() {
  const seed: NoticeItem[] = [
    {
      id: 1,
      title: 'Pozor na termíny výkazů',
      message: 'Prosíme doplňovat výkazy průběžně každý pracovní den.',
      author: 'Vedení',
      created_at: '2026-06-26T08:00:00.000Z'
    }
  ];
  return readJson<NoticeItem[]>(noticesKey, seed).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function addNotice(input: Omit<NoticeItem, 'id' | 'created_at'>) {
  const items = getNotices();
  const item = {
    ...input,
    id: items.reduce((max, value) => Math.max(max, value.id), 0) + 1,
    created_at: new Date().toISOString()
  };
  writeJson(noticesKey, [item, ...items]);
  return item;
}

export function getServiceTasks() {
  const seed: ServiceTask[] = [
    {
      id: 1,
      machine: 'FENDT VARIO 724',
      description: 'Kontrola před sezónou a výměna filtrů.',
      available_from: '2026-06-30',
      created_by: 'Mechanizace',
      created_at: '2026-06-26T08:00:00.000Z'
    }
  ];
  return readJson<ServiceTask[]>(serviceTasksKey, seed).sort((a, b) => a.available_from.localeCompare(b.available_from));
}

export function addServiceTask(input: Omit<ServiceTask, 'id' | 'created_at'>) {
  const items = getServiceTasks();
  const item = {
    ...input,
    id: items.reduce((max, value) => Math.max(max, value.id), 0) + 1,
    created_at: new Date().toISOString()
  };
  writeJson(serviceTasksKey, [item, ...items]);
  return item;
}
