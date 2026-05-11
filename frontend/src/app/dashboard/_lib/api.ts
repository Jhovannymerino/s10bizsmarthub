import { API } from './constants';

export async function fetchApi(path: string, token: string) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) throw new Error('unauthorized');
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}
