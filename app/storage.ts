import * as SecureStore from 'expo-secure-store';

export type Account = { id: string; uri: string };

// Each account lives under its own key (Keychain/Keystore) to stay under per-value size limits.
const INDEX = 'accounts_index';

export async function loadAccounts(): Promise<Account[]> {
  const ids: string[] = JSON.parse((await SecureStore.getItemAsync(INDEX)) ?? '[]');
  const uris = await Promise.all(ids.map((id) => SecureStore.getItemAsync(`acct_${id}`)));
  return ids.flatMap((id, i) => (uris[i] ? [{ id, uri: uris[i]! }] : []));
}

export async function saveAccount(accounts: Account[], uri: string): Promise<Account[]> {
  const id = Date.now().toString(36);
  await SecureStore.setItemAsync(`acct_${id}`, uri);
  const next = [...accounts, { id, uri }];
  await SecureStore.setItemAsync(INDEX, JSON.stringify(next.map((a) => a.id)));
  return next;
}

export async function deleteAccount(accounts: Account[], id: string): Promise<Account[]> {
  const next = accounts.filter((a) => a.id !== id);
  await SecureStore.setItemAsync(INDEX, JSON.stringify(next.map((a) => a.id)));
  await SecureStore.deleteItemAsync(`acct_${id}`);
  return next;
}
