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

// 영상 썸네일은 한 번 내려받아 둔다 — 지하철에서도 카드에 얼굴이 있어야 하니까.
// 실패하면 null: 썸네일 없이도 기록은 남는다.
export async function cacheRemoteImage(remoteUrl: string | null): Promise<string | null> {
  if (!remoteUrl || Platform.OS === 'web') return null;
  const FileSystem = fs();
  const dir = `${FileSystem.documentDirectory}images`;
  const name = `thumb-${newId()}.jpg`;
  const dest = `${dir}/${name}`;
  const discard = () => FileSystem.deleteAsync(dest, { idempotent: true }).catch(() => {});
  let dl: { downloadAsync: () => Promise<any>; cancelAsync?: () => Promise<void> } | null = null;
  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
    // 포그라운드 세션 + 8초 제한 — 저장이 끊긴 연결에 매달리지 않게
    dl = FileSystem.createDownloadResumable(remoteUrl, dest, {
      sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const result = await Promise.race([
      dl!.downloadAsync(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), 8000);
      }),
    ]).finally(() => clearTimeout(timer));
    if (!result || result.status !== 200 || !looksLikeImage(result)) {
      await discard();
      return null;
    }
    return `images/${name}`;
  } catch {
    await dl?.cancelAsync?.().catch(() => {});
    await discard();
    return null;
  }
}

// 핫링크 차단 페이지(HTML)를 이미지로 저장하지 않는다. 타입이 비어 있거나 octet-stream이면 믿어 준다.
function looksLikeImage(result: { mimeType?: string | null; headers?: Record<string, string> }): boolean {
  const headers = result.headers ?? {};
  const key = Object.keys(headers).find((k) => k.toLowerCase() === 'content-type');
  const type = (result.mimeType ?? (key ? headers[key] : '') ?? '').toLowerCase();
  return !/^(text\/|application\/(json|xml|xhtml))/.test(type);
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
