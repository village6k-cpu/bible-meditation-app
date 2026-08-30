import { Platform } from 'react-native';
import { newId } from '../core/ids';

// SDK 54: 콜백 파일 API는 'expo-file-system/legacy'에 산다.
// 웹은 SQLite도 파일도 없으므로 모든 함수가 조용히 무해하게 동작해야 한다.

function fs() {
  return require('expo-file-system/legacy');
}

// 픽커의 캐시 파일은 언제든 지워질 수 있고, documentDirectory의 절대 경로는
// 앱 업데이트마다 바뀐다 — 복사해 두고 상대 경로만 저장한다.
export async function persistImage(tempUri: string): Promise<string> {
  if (Platform.OS === 'web') return tempUri;
  const FileSystem = fs();
  const dir = `${FileSystem.documentDirectory}images`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
  const ext = /\.[A-Za-z0-9]{2,5}$/.exec(tempUri)?.[0] ?? '.jpg';
  const name = `${newId()}${ext}`;
  await FileSystem.copyAsync({ from: tempUri, to: `${dir}/${name}` });
  return `images/${name}`;
}

export function imageAbs(rel: string | null): string | null {
  if (!rel) return null;
  if (!rel.startsWith('images/')) return rel;
  if (Platform.OS === 'web') return rel;
  return `${fs().documentDirectory}${rel}`;
}

// 단일 마크다운을 캐시에 쓰고 공유 시트로 — 옵시디언·파일 앱·에어드랍으로 나간다.
// iOS 파일 API의 한글은 NFD로 풀리므로 파일명은 NFC로 고정한다.
export async function shareMarkdown(content: string, filename: string): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const FileSystem = fs();
  const Sharing = require('expo-sharing');
  const safeName = filename.normalize('NFC');
  const fileUri = `${FileSystem.cacheDirectory}${safeName}`;
  await FileSystem.writeAsStringAsync(fileUri, content);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, { mimeType: 'text/markdown', dialogTitle: safeName });
    return true;
  }
  return false;
}
